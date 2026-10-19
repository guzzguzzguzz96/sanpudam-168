// Normalizes the captured legacy admin data into the target document shape
// (docs/mongodb-schema-spec.md) without connecting to any database.
//
//   node migration/scripts/build-content.mjs --dry-run   # summary only
//   node migration/scripts/build-content.mjs
//
// Input:  migration/content/raw/*.json, migration/manifests/media-manifest.json
// Output: migration/content/<collection>.json, migration/manifests/content-manifest.json,
//         and admin usage data merged into media-manifest.json.
import { createHash } from "node:crypto";
import { fromRoot, parseArgs, readJson, writeJson } from "./lib/files.mjs";

const args = parseArgs();
const RUN_AT = new Date().toISOString();
const raw = (name) => readJson(fromRoot("migration/content/raw", `${name}.json`))?.json?.items ?? [];
const mediaManifestPath = fromRoot("migration/manifests/media-manifest.json");
const mediaManifest = readJson(mediaManifestPath, { entries: [] });
const mediaByPath = new Map(mediaManifest.entries.map((entry) => [new URL(entry.sourceUrl).pathname, entry]));

// --- helpers ---------------------------------------------------------------

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const sha = (text) => createHash("sha256").update(text).digest("hex");

// Deterministic identity: the same legacy record always gets the same _id,
// so relationships (e.g. categoryId) can be written before insertion.
const importIdFor = (key) => sha(`sanpudam168:${key}`).slice(0, 24);

const usages = new Map(); // media path -> [{ collection, legacyId, field }]
function imageRef(image, { collection, legacyId, field, caption = null, focal = null }) {
  if (!image?.src) return null;
  const path = image.src.split("?")[0];
  const media = mediaByPath.get(path);
  (usages.get(path) ?? usages.set(path, []).get(path)).push({ collection, legacyId, field });
  return {
    assetManifestId: media?.id ?? null,
    assetSha256: media?.sha256 ?? null,
    alt: image.alt ?? "",
    caption,
    focalPoint: focal,
    mediaMapping: {
      status: media && media.status !== "failed" ? "resolved" : "missing",
      legacyUrl: image.src,
      legacyMobileUrl: image.mobile ?? null, // the legacy "mobile" image is the 800px resize, not a separate crop
      legacyWidth: image.w ?? null,
      legacyHeight: image.h ?? null,
    },
  };
}

function base(collection, legacyModule, item, placeholderMap) {
  const key = `${legacyModule}:id:${item.id}`;
  return {
    importId: importIdFor(key),
    status: "draft",
    review: { status: "pending_review" },
    legacy: {
      system: "sanpudam168-workers",
      module: legacyModule,
      id: item.id,
      key,
      keyStrength: "id",
      isPublished: item.published,
      isPlaceholder: item.is_placeholder ?? false,
      sortOrder: item.sort ?? null,
      createdAt: item.created_at ?? null,
      updatedAt: item.updated_at ?? null,
      checksum: sha(stableStringify({ data: item.data, published: item.published, sort: item.sort, placeholder: item.placeholder })),
      sourceType: "admin_ui_capture",
    },
    placeholderFields: (item.placeholder ?? []).map((field) => ({
      path: placeholderMap[field] ?? `unmapped:${field}`,
      legacyPath: field,
      status: "placeholder",
      source: "legacy",
      flaggedAt: item.updated_at ?? RUN_AT,
    })),
    migration: { runId: null, preparedAt: RUN_AT },
    _collection: collection,
  };
}

const text = (value) => (typeof value === "string" ? value : value ?? null);
const keyed = (list, prefix, map) => (list ?? []).map((entry, index) => ({ key: `${prefix}-${String(index + 1).padStart(2, "0")}`, sortOrder: index + 1, ...map(entry) }));

// --- module mappings (docs/legacy-data-mapping.md §3–§4) --------------------

const categoriesRaw = raw("categories");
const categoryImportId = new Map(categoriesRaw.map((c) => [c.id, importIdFor(`categories:id:${c.id}`)]));

const out = {};

out.categories = categoriesRaw.map((item) => ({
  ...base("categories", "categories", item, { name: "name", slug: "slug", description: "description" }),
  name: item.data.name,
  slug: item.data.slug ?? item.slug,
  description: text(item.data.description),
  sortOrder: item.sort,
}));

out.sacred_items = raw("sacred").map((item) => {
  const resolved = categoryImportId.get(item.data.category);
  const kind = { place: "shrine_worship", amulet: "sacred_object" }[item.data.kind] ?? null;
  return {
    ...base("sacred_items", "sacred", item, {
      title: "name", slug: "slug", category: "categoryId", kind: "type", image: "primaryImage", summary: "excerpt",
      body: "body", wish_for: "prayerTopics", offerings: "offerings", price_note: "inquiryText", variants: "variants",
      seo_title: "seo.title", seo_description: "seo.description",
    }),
    name: item.data.title,
    slug: item.data.slug ?? item.slug,
    type: kind,
    categoryId: resolved ?? null,
    categoryMapping: {
      status: resolved ? "resolved" : "unresolved",
      legacyValue: item.data.category ?? null,
      resolvedSlug: categoriesRaw.find((c) => c.id === item.data.category)?.data.slug ?? null,
    },
    primaryImage: imageRef(item.data.image, { collection: "sacred_items", legacyId: item.id, field: "primaryImage" }),
    excerpt: item.data.summary,
    body: text(item.data.body),
    bodyFormat: "legacy-text-v1",
    prayerTopics: text(item.data.wish_for),
    offerings: text(item.data.offerings),
    // Kept verbatim. A numeric price is flagged by the dry run, never removed here.
    inquiryText: text(item.data.price_note),
    variants: keyed(item.data.variants, "variant", (v) => ({
      name: v.name,
      quantity: Number.isFinite(v.qty) ? v.qty : null,
      quantityText: Number.isFinite(v.qty) ? null : text(v.qty),
      note: v.note || null,
    })),
    showVariantQuantities: false,
    sortOrder: item.sort,
    seo: { title: item.data.seo_title || null, description: item.data.seo_description || null },
  };
});

out.news = raw("news").map((item) => ({
  ...base("news", "news", item, {
    title: "title", slug: "slug", date: "date", cover: "coverImage", summary: "excerpt", body: "body",
    photos: "images", seo_title: "seo.title", seo_description: "seo.description",
  }),
  title: item.data.title,
  slug: item.data.slug ?? item.slug,
  date: item.data.date, // date-only string, never shifted through a timezone
  coverImage: imageRef(item.data.cover, { collection: "news", legacyId: item.id, field: "coverImage" }),
  excerpt: item.data.summary,
  body: item.data.body,
  bodyFormat: "legacy-text-v1",
  images: (item.data.photos ?? []).map((photo, index) => imageRef(photo.image, { collection: "news", legacyId: item.id, field: `images[${index}]` })),
  seo: { title: item.data.seo_title || null, description: item.data.seo_description || null },
}));

out.gallery_items = raw("gallery").map((item) => ({
  ...base("gallery_items", "gallery", item, { image: "image", caption: "image.caption" }),
  galleryKey: "shrine-main",
  image: imageRef(item.data.image, { collection: "gallery_items", legacyId: item.id, field: "image", caption: text(item.data.caption) }),
  sortOrder: item.sort,
}));

out.banners = raw("banners").map((item) => {
  const { fx, fy } = item.data.image ?? {};
  const focal = Number.isFinite(fx) && Number.isFinite(fy) ? { x: fx / 100, y: fy / 100 } : null; // legacy stores percentages
  const doc = {
    ...base("banners", "banners", item, { image: "image", title: "image.caption" }),
    image: imageRef(item.data.image, { collection: "banners", legacyId: item.id, field: "image", caption: text(item.data.title), focal }),
    mobileImage: null,
    sortOrder: item.sort,
  };
  doc.legacy.raw = { fx: fx ?? null, fy: fy ?? null, focalScale: "percent" };
  return doc;
});

out.videos = raw("videos").map((item) => ({
  ...base("videos", "videos", item, { title: "title", video: "videoAssetId", description: "description" }),
  title: item.data.title,
  videoAssetId: null,
  videoMapping: { status: item.data.video ? "pending" : "missing", legacyValue: item.data.video ?? null },
  posterMode: "auto",
  poster: null,
  description: text(item.data.description),
  sortOrder: item.sort,
}));

out.reviews = raw("reviews").map((item) => ({
  ...base("reviews", "reviews", item, { name: "displayName", role: "sourceLabel", text: "quote", rating: "rating" }),
  displayName: item.data.name,
  sourceLabel: text(item.data.role),
  quote: item.data.text,
  rating: Number.isFinite(item.data.rating) ? item.data.rating : null,
  consent: { status: "pending" },
  sortOrder: item.sort,
}));

out.faqs = raw("faqs").map((item) => ({
  ...base("faqs", "faqs", item, { question: "question", answer: "answer", on_home: "showOnHome" }),
  question: item.data.question,
  answer: item.data.answer,
  showOnHome: Boolean(item.data.on_home),
  sortOrder: item.sort,
}));

out.team_members = raw("team").map((item) => ({
  ...base("team_members", "team", item, { name: "name", role: "roleTitle", photo: "photo", bio: "bio" }),
  name: item.data.name,
  roleTitle: item.data.role,
  photo: imageRef(item.data.photo, { collection: "team_members", legacyId: item.id, field: "photo" }),
  bio: text(item.data.bio),
  consent: { status: "pending" },
  sortOrder: item.sort,
}));

out.pages = raw("about").map((item) => {
  const d = item.data;
  return {
    ...base("pages", "about", item, {
      history_title: "title", history_intro: "intro", history_body: "historyBody", history_image: "historyImage",
      home_heading: "homeIntroHeading", quote: "quote", emblem_title: "coatOfArms.heading", emblem_body: "coatOfArms.body",
      emblem_image: "coatOfArms.image", emblem_parts: "coatOfArms.parts", wishes: "wishTopics", worship_steps: "worshipSteps",
    }),
    key: "history",
    title: d.history_title,
    intro: d.history_intro,
    historyBody: d.history_body,
    historyImage: imageRef(d.history_image, { collection: "pages", legacyId: item.id, field: "historyImage" }),
    quote: text(d.quote),
    homeIntroHeading: d.home_heading,
    coatOfArms: {
      heading: d.emblem_title,
      body: d.emblem_body,
      image: imageRef(d.emblem_image, { collection: "pages", legacyId: item.id, field: "coatOfArms.image" }),
      parts: keyed(d.emblem_parts, "part", (p) => ({ part: p.title, meaning: p.meaning })),
    },
    wishTopics: keyed(d.wishes, "wish", (w) => ({ topic: w.title, description: text(w.desc), icon: w.icon })),
    worshipSteps: keyed(d.worship_steps, "step", (s) => ({ title: s.title, detail: text(s.desc) })),
    bodyFormat: "legacy-text-v1",
  };
});

out.site_settings = raw("settings").map((item) => {
  const d = item.data;
  const doc = {
    ...base("site_settings", "settings", item, {
      name: "identity.name", short_name: "identity.shortName", tagline: "identity.tagline", about_short: "identity.description",
      address: "contact.address", area: "contact.locationShort", hours_text: "openingHours.displayText",
      open_time: "openingHours.opens", close_time: "openingHours.closes", open_days: "openingHours.daysText",
      phone: "contact.phoneNumber", line_id: "contact.lineId", map_url: "contact.directionsUrl", map_query: "contact.mapEmbedQuery",
      facebook_url: "socialLinks.facebook", tiktok_url: "socialLinks.tiktok", youtube_url: "socialLinks.youtube",
      contact_topics: "contactTopics", og_image: "seo.defaultOgImage",
    }),
    key: "default",
    identity: { name: d.name, shortName: d.short_name, tagline: text(d.tagline), description: d.about_short },
    branding: { logo: null, logoNote: "Legacy CMS has no logo field; the logo is the static file /img/logo-192.png (manifest id brand-logo-mark)." },
    contact: {
      address: d.address,
      locationShort: d.area,
      phoneNumber: text(d.phone),
      lineId: text(d.line_id),
      directionsUrl: text(d.map_url),
      mapEmbedQuery: text(d.map_query),
      verified: false,
    },
    openingHours: { opens: d.open_time, closes: d.close_time, daysText: d.open_days, displayText: d.hours_text },
    socialLinks: [["facebook", d.facebook_url], ["tiktok", d.tiktok_url], ["youtube", d.youtube_url]]
      .filter(([, url]) => url)
      .map(([platform, url]) => ({ platform, url, verified: false })),
    contactTopics: keyed(d.contact_topics, "topic", (t) => ({ label: typeof t === "string" ? t : t.label })),
    seo: { defaultOgImage: imageRef(d.og_image, { collection: "site_settings", legacyId: item.id, field: "seo.defaultOgImage" }) },
    // Analytics/marketing IDs are excluded by policy (values were empty in the legacy CMS).
    analytics: { enabled: false, excluded: true, legacyValuesPresent: ["ga4_id", "gads_id", "fb_pixel_id"].filter((k) => d[k]?.wasSet) },
  };
  return doc;
});

// --- summary ---------------------------------------------------------------

const records = Object.values(out).flat();
const summary = {
  preparedAt: RUN_AT,
  collections: Object.fromEntries(Object.entries(out).map(([name, docs]) => [name, docs.length])),
  totalRecords: records.length,
  placeholderFields: records.reduce((total, doc) => total + doc.placeholderFields.length, 0),
  recordsWithPlaceholders: records.filter((doc) => doc.placeholderFields.length).length,
  unmappedPlaceholderPaths: records.flatMap((doc) => doc.placeholderFields.filter((p) => p.path.startsWith("unmapped:")).map((p) => `${doc._collection}:${p.legacyPath}`)),
  unresolvedCategories: out.sacred_items.filter((doc) => doc.categoryMapping.status !== "resolved").map((doc) => doc.slug),
};

if (args.dryRun) {
  console.log(JSON.stringify(summary, null, 1));
  process.exit(0);
}

for (const [collection, docs] of Object.entries(out)) {
  writeJson(fromRoot("migration/content", `${collection}.json`), { collection, preparedAt: RUN_AT, records: docs.map(({ _collection, ...doc }) => doc) });
}
writeJson(fromRoot("migration/manifests/content-manifest.json"), summary);

// Merge admin usages into the media manifest (source module/record per asset).
for (const entry of mediaManifest.entries) {
  const path = new URL(entry.sourceUrl).pathname;
  const used = usages.get(path) ?? [];
  entry.adminUsages = used;
  entry.sourceModules = [...new Set(["public-site", ...used.map((u) => u.collection)])];
  entry.sourceRecords = [...new Set(used.map((u) => `${u.collection}:${u.legacyId}`))];
}
mediaManifest.adminReferencedPaths = [...usages.keys()].sort();
mediaManifest.adminOnlyPaths = [...usages.keys()].filter((path) => !mediaByPath.has(path));
writeJson(mediaManifestPath, mediaManifest);
console.log(JSON.stringify(summary, null, 1));
