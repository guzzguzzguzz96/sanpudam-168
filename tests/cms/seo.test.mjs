// Public SEO data: titles, descriptions, social images, slugs, and JSON-LD
// from published records only. Offline: mock models only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContentService } from "../../src/server/cms/content-service.js";
import { buildSeoIndex, clip, faqPageJsonLd, newsArticleJsonLd, ogImageUrl, pageMetadata, plainText } from "../../src/server/site/seo.js";
import { serializeJsonLd } from "../../src/lib/json-ld.js";
import { asset, draft, ids, imageRef, mockModels, published, publishedSite } from "./fixtures.mjs";

const silent = { error() {} };

async function seoFor(site) {
  const repos = createContentService({ models: mockModels(site), connect: async () => {}, logger: silent }).public;
  const [siteSettings, historyPage, sacredItems, news, banners] = await Promise.all([
    repos.siteSettings(),
    repos.historyPage(),
    repos.sacredItems({ limit: 200 }),
    repos.news({ limit: 200 }),
    repos.banners({ limit: 20 }),
  ]);
  return buildSeoIndex({ siteSettings, historyPage, sacredItems, news, banners });
}

function seoSite() {
  const site = publishedSite();
  site.SiteSettings[0].identity.tagline = "ศรัทธาและบารมี ใจกลางพระนคร";
  site.SiteSettings[0].identity.description = "ศาลปู่ดำ168 และตราแผ่นดิน ".repeat(12).trim();
  site.SiteSettings[0].seo = { defaultOgImage: imageRef("og") };
  site.MediaAsset.push({ ...asset("og"), width: 1200, height: 630 });
  site.News = [
    published({ _id: "n1", title: "ข่าวหนึ่ง", slug: "news-one", date: "2026-03-20", excerpt: "ย่อข่าว", coverImage: imageRef(ids.approvedAsset), seo: { title: "หัวข้อ SEO ของข่าว", description: "คำอธิบาย SEO ของข่าว" } }),
    published({ _id: "n2", title: "ข่าวสอง", slug: "news-two", date: "2026-03-16", excerpt: "ย่อข่าวสอง", coverImage: imageRef(ids.pendingAsset), seo: { title: null, description: null } }),
    draft({ _id: "n3", title: "ข่าวร่าง", slug: "draft-news", date: "2026-01-01", excerpt: "ร่าง", coverImage: imageRef(ids.approvedAsset) }),
  ];
  return site;
}

test("seo: a record's own seo fields win; otherwise its own text is used", async () => {
  const index = await seoFor(seoSite());
  assert.equal(index.news["news-one"].title, "หัวข้อ SEO ของข่าว");
  assert.equal(index.news["news-one"].description, "คำอธิบาย SEO ของข่าว");
  assert.equal(index.news["news-two"].title, "ข่าวสอง");
  assert.equal(index.news["news-two"].description, "ย่อข่าวสอง");
  assert.equal(index.sacredItems["item-one"].title, "รายการหนึ่ง");
  assert.equal(index.sacredItems["item-one"].description, "รายการหนึ่ง สรุป ศาลปู่ดำ168 ถนนมหาราช");
  assert.equal(index.site.title, "ศาลปู่ดำ168 และตราแผ่นดิน | ศรัทธาและบารมี ใจกลางพระนคร");
  assert.ok(index.site.description.length <= 155 && index.site.description.endsWith("…"));
  assert.equal(index.pages.history.title, "ประวัติ");
});

test("seo: only published records; drafts never reach slugs, titles, or the sitemap", async () => {
  const index = await seoFor(seoSite());
  assert.deepEqual(index.slugs.news, ["news-one", "news-two"]);
  assert.deepEqual(index.slugs.sacredItems, ["item-one", "item-two"]);
  assert.ok(!JSON.stringify(index).includes("ข่าวร่าง"));
});

test("seo: social images are approved media cropped to 1200x630; og-default is used as is", async () => {
  const index = await seoFor(seoSite());
  assert.equal(index.site.image.url, asset("og").cloudinary.secureUrl, "an exact 1200x630 default is not re-cropped");
  assert.match(index.news["news-one"].image.url, /\/image\/upload\/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto\/v17\//);
  assert.equal(index.news["news-two"].image.url, index.site.image.url, "an unapproved cover falls back to the default image");
  assert.equal(index.news["news-two"].hasOwnImage, false);
  assert.equal(ogImageUrl("https://evil.example/image/upload/x.jpg"), null);
  assert.equal(ogImageUrl("not a url"), null);
});

test("seo: without a usable og-default the gate photo (cropped) is the default", async () => {
  const site = seoSite();
  site.SiteSettings[0].seo = { defaultOgImage: imageRef("missing") };
  const gate = asset("gate");
  gate.cloudinary.publicId = "sanpudam168/staging/legacy/shrine/exterior/front-entrance";
  site.MediaAsset.push(gate);
  site.Banner = [published({ _id: "b1", image: imageRef(ids.approvedAsset, { caption: "โถง" }), sortOrder: 1 }), published({ _id: "b2", image: imageRef("gate", { caption: "ซุ้ม" }), sortOrder: 2 })];
  const index = await seoFor(site);
  assert.match(index.site.image.url, /c_fill,g_auto,w_1200,h_630/);
  assert.match(index.site.image.url, /test\/gate\.webp$/);
});

test("seo: metadata carries canonical paths and Open Graph data", () => {
  const meta = pageMetadata({ path: "/news/news-one", title: "หัวข้อ", absoluteTitle: true, description: "คำอธิบาย", image: { url: "https://res.cloudinary.com/x.jpg", width: 1200, height: 630, alt: "" }, type: "article", publishedTime: "2026-03-20" });
  assert.deepEqual(meta.title, { absolute: "หัวข้อ" });
  assert.equal(meta.alternates.canonical, "/news/news-one");
  assert.equal(meta.openGraph.type, "article");
  assert.equal(meta.openGraph.publishedTime, "2026-03-20");
  assert.equal(meta.twitter.card, "summary_large_image");
});

test("seo: JSON-LD for FAQs and news articles, safely serialized", async () => {
  const faq = faqPageJsonLd([{ question: "ศาลเปิดกี่โมง", answer: "08:00 – 20:00 น." }, { question: "", answer: "x" }]);
  assert.equal(faq["@type"], "FAQPage");
  assert.equal(faq.mainEntity.length, 1);
  assert.equal(faqPageJsonLd([]), null);
  const index = await seoFor(seoSite());
  const article = newsArticleJsonLd(index.news["news-one"], { slug: "news-one", siteUrl: new URL("https://sanpudam168.com"), siteName: "ศาลปู่ดำ168" });
  assert.equal(article["@type"], "NewsArticle");
  assert.equal(article.headline, "ข่าวหนึ่ง");
  assert.equal(article.datePublished, "2026-03-20");
  assert.equal(article.url, "https://sanpudam168.com/news/news-one");
  assert.equal(newsArticleJsonLd(undefined, { slug: "x", siteUrl: null }), null);
  const json = serializeJsonLd({ text: "</script><script>alert(1)</script>" });
  assert.ok(!json.includes("<"));
  assert.deepEqual(JSON.parse(json), { text: "</script><script>alert(1)</script>" });
});

test("seo: helpers", () => {
  assert.equal(clip("  a   b  ", 10), "a b");
  assert.equal(clip("ข้อความ ".repeat(40), 30).length <= 30, true);
  assert.equal(clip(null, 10), null);
  assert.equal(plainText("**ตัวหนา** และ\n\nย่อหน้า"), "ตัวหนา และ ย่อหน้า");
});
