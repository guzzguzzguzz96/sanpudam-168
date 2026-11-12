// Static checks that database code and secrets stay on the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const rel = (path) => relative(root, path).replaceAll("\\", "/");

function walk(dir, pattern, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, pattern, out);
    else if (pattern.test(name)) out.push(path);
  }
  return out;
}

const sourceFiles = walk(join(root, "src"), /\.(js|jsx|mjs)$/);
const read = (path) => readFileSync(path, "utf8");
const SERVER_IMPORT = /from\s+["'](?:@\/server\/|@\/lib\/db|@\/models|mongoose|(?:\.\.?\/)+(?:server\/|lib\/db|models\/))/;

test("boundary: every module under src/server is marked server-only", () => {
  const serverFiles = walk(join(root, "src/server"), /\.js$/);
  assert.ok(serverFiles.length >= 7);
  for (const file of serverFiles) assert.match(read(file), /^import "server-only";/m, rel(file));
});

test("boundary: Client Components never import database or server modules", () => {
  const clientFiles = sourceFiles.filter((file) => /^\s*["']use client["']/.test(read(file)));
  for (const file of clientFiles) assert.doesNotMatch(read(file), SERVER_IMPORT, rel(file));
});

// Client Review Mode (C1.1) is the only data path wired into routes: the
// root page/layout and the private src/app/_review folder may import the
// review entry point (@/server/review) and nothing else on the server.
// The content pages (C2.1) may import only the site entry point
// (@/server/site), which picks the review or public scope itself.
// The admin sign-in routes may import only admin authentication modules.
const ADMIN_PAGE_WIRING = ["@/server/auth/admin-access", "@/server/auth/identity"];
const SERVER_WIRING = new Map([
  ["src/app/page.js", ["@/server/review"]],
  ["src/app/layout.js", ["@/server/review"]],
  ["src/app/_review/review-homepage.js", ["@/server/review"]],
  ["src/app/_review/review-chrome.js", ["@/server/review"]],
  ["src/app/history/page.js", ["@/server/site"]],
  ["src/app/sakkara/page.js", ["@/server/site"]],
  ["src/app/sakkara/[slug]/page.js", ["@/server/site"]],
  ["src/app/news/page.js", ["@/server/site"]],
  ["src/app/news/[slug]/page.js", ["@/server/site"]],
  ["src/app/visit/page.js", ["@/server/site"]],
  ["src/app/admin/page.js", ADMIN_PAGE_WIRING],
  ["src/app/admin/login/page.js", ADMIN_PAGE_WIRING],
  ["src/app/admin/content/page.js", ["@/server/admin/content-inventory", "@/server/auth/admin-access", "@/server/auth/config", "@/server/auth/identity"]],
  ["src/app/admin/actions.js", ["@/server/auth/auth", "@/server/auth/config", "@/server/auth/identity"]],
  ["src/app/api/auth/[...nextauth]/route.js", ["@/server/auth/auth", "@/server/auth/config"]],
]);
const ADMIN_ROUTES = ["src/app/admin/page.js", "src/app/admin/login/page.js", "src/app/admin/content/page.js", "src/app/admin/actions.js", "src/app/api/auth/[...nextauth]/route.js"];
const CONTENT_ROUTES = ["src/app/history/page.js", "src/app/sakkara/page.js", "src/app/sakkara/[slug]/page.js", "src/app/news/page.js", "src/app/news/[slug]/page.js", "src/app/visit/page.js"];

test("boundary: UI components never use the data layer; routes use only their entry point", () => {
  const uiFiles = sourceFiles.filter((file) => /src[\\/](app|components|data)[\\/]/.test(file));
  for (const file of uiFiles) {
    const text = read(file);
    if (!SERVER_WIRING.has(rel(file))) {
      assert.doesNotMatch(text, SERVER_IMPORT, rel(file));
      continue;
    }
    const serverImports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((s) => SERVER_IMPORT.test(`from "${s}"`));
    for (const specifier of serverImports) assert.ok(SERVER_WIRING.get(rel(file)).includes(specifier), `${rel(file)} imports ${specifier}`);
  }
});

test("boundary: review mode is decided from the environment only, never from request data", () => {
  const reviewFiles = [
    ...walk(join(root, "src/server/review"), /\.js$/),
    ...walk(join(root, "src/server/site"), /\.js$/),
    join(root, "src/lib/review-mode.js"),
    join(root, "src/server/cms/review-access.js"),
    ...walk(join(root, "src/app/_review"), /\.js$/),
  ];
  for (const file of reviewFiles) {
    const text = read(file);
    assert.doesNotMatch(text, /next\/headers|cookies\(|headers\(\)|searchParams|draftMode|NEXT_PUBLIC_/, rel(file));
  }
  for (const route of ["src/app/page.js", ...CONTENT_ROUTES]) {
    assert.doesNotMatch(read(join(root, route)), /searchParams|cookies|headers|draftMode/, route);
  }
});

test("boundary: content routes are never prerendered from CMS data", () => {
  for (const route of CONTENT_ROUTES) {
    const text = read(join(root, route));
    assert.doesNotMatch(text, /generateStaticParams|generateMetadata|"use cache"|dynamicParams/, route);
    assert.match(text, /<Suspense/, `${route} reads data inside Suspense`);
  }
  const entry = read(join(root, "src/server/site/index.js"));
  for (const loader of ["getHistoryPage", "getSacredItemsPage", "getSacredItemPage", "getNewsPage", "getNewsArticlePage", "getVisitPage"]) {
    assert.match(entry, new RegExp(`export async function ${loader}\\([^)]*\\) \\{\\s*await connection\\(\\);`), `${loader} waits for the request`);
  }
  for (const file of sourceFiles) assert.doesNotMatch(read(file), /dangerouslySetInnerHTML/, rel(file));
});

test("boundary: review credentials are read only by the review config, with no fallback", () => {
  for (const file of sourceFiles) {
    if (/CLIENT_REVIEW_MONGODB_/.test(read(file))) assert.equal(rel(file), "src/server/review/config.js");
  }
  const reviewConfig = read(join(root, "src/server/review/config.js"));
  const code = reviewConfig.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /(?<!CLIENT_REVIEW_)MONGODB_(URI|DB_NAME)/, "review config must not read the general MongoDB variables");
  for (const file of walk(join(root, "src/server/review"), /\.js$/)) {
    assert.doesNotMatch(read(file), /connectToDatabase|getContentService|getDatabaseConfig/, `${rel(file)} must not reuse the default connection`);
  }
});

test("boundary: database secrets are read only in the server data layer", () => {
  const allowed = new Set(["src/lib/db.js", "src/server/cms/index.js"]);
  for (const file of sourceFiles) {
    const text = read(file);
    if (/process\.env\.(MONGODB_|CLOUDINARY_API|AUTH_SECRET|CLIENT_REVIEW_MONGODB)/.test(text)) assert.ok(allowed.has(rel(file)), `${rel(file)} reads a secret`);
    assert.doesNotMatch(text, /NEXT_PUBLIC_[A-Z_]*(MONGO|SECRET|API_KEY|PASSWORD)/, rel(file));
    assert.doesNotMatch(text, /mongodb(\+srv)?:\/\/[^"'`\s]*@/, `${rel(file)} contains a connection string`);
  }
  const example = read(join(root, ".env.example"));
  assert.doesNotMatch(example, /NEXT_PUBLIC_[A-Z_]*(MONGO|SECRET|API_KEY|PASSWORD)/);
});

test("boundary: auth secrets, OAuth credentials, and the admin allowlist are read only by the auth config", () => {
  for (const file of sourceFiles) {
    if (/env\??\.(AUTH_|ADMIN_ALLOWED_ACCOUNTS)|env\??\.?\[["'](AUTH_|ADMIN_ALLOWED_ACCOUNTS)/.test(read(file))) assert.equal(rel(file), "src/server/auth/config.js");
  }
});

// Admin sign-in (Auth.js) is the only authenticated area. There is still no
// draft preview or CMS route, and no proxy/middleware: client review pages
// never depend on a login.
test("boundary: only the admin sign-in routes exist; no preview or CMS route, no proxy", () => {
  const routeFiles = walk(join(root, "src/app"), /\.(js|jsx)$/).map(rel);
  for (const file of routeFiles) {
    if (ADMIN_ROUTES.includes(file)) continue;
    assert.doesNotMatch(file, /(preview|cms|admin|auth|login|api)/i, file);
  }
  for (const file of ADMIN_ROUTES) assert.ok(existsSync(join(root, file)), file);
  assert.ok(!existsSync(join(root, "src/proxy.js")) && !existsSync(join(root, "src/middleware.js")));
});

// Authentication and Client Review access stay separate in both directions.
test("boundary: admin authentication never uses Client Review modules, flags, or other cookies", () => {
  const authFiles = [...walk(join(root, "src/server/auth"), /\.js$/), ...ADMIN_ROUTES.map((file) => join(root, file)), join(root, "src/components/admin/admin-panel.js")];
  for (const file of authFiles) {
    const text = read(file);
    assert.doesNotMatch(text, /server\/review|lib\/review-mode|cms\/review-access|CLIENT_REVIEW|isClientReviewEnabled|VERCEL/, rel(file));
    assert.doesNotMatch(text, /cookies\(|__Host-sanpudam-cms-session|_vercel_jwt/, rel(file));
  }
  const reviewFiles = [...walk(join(root, "src/server/review"), /\.js$/), ...walk(join(root, "src/server/site"), /\.js$/), join(root, "src/lib/review-mode.js")];
  for (const file of reviewFiles) assert.doesNotMatch(read(file), /server\/auth|next-auth|ADMIN_ALLOWED_ACCOUNTS/, rel(file));
  for (const file of sourceFiles) {
    assert.doesNotMatch(read(file), /__Host-sanpudam-cms-session|signSessionToken|CMS_PREVIEW_ALLOWED_SUBJECTS/, `${rel(file)} keeps the retired session path`);
  }
});

test("boundary: admin routes check access on the server and stay private", () => {
  for (const page of ["src/app/admin/page.js", "src/app/admin/login/page.js", "src/app/admin/content/page.js"]) {
    const text = read(join(root, page));
    assert.match(text, /getAdminAccess\(\)/, page);
    assert.match(text, /<Suspense/, page);
    assert.doesNotMatch(text, /"use client"|"use cache"|generateStaticParams/, page);
  }
  assert.match(read(join(root, "src/app/api/auth/[...nextauth]/route.js")), /await connection\(\);/);
  // Admin decisions are never prerendered, even when sign-in is not configured.
  const adminAccess = read(join(root, "src/server/auth/admin-access.js"));
  assert.match(adminAccess, /export async function getAdminAccess\([^)]*\) \{\s*await waitForRequest\(\);/);
  assert.match(adminAccess, /waitForRequest = connection\b/);
  const config = read(join(root, "next.config.mjs"));
  for (const source of ['"/admin"', '"/admin/:path*"', '"/api/auth/:path*"']) assert.ok(config.includes(source), source);
  assert.match(config, /private, no-store, max-age=0/);
});

// The read-only content inventory: admin access first, staging data through
// the dedicated read-only connection, never enabled by Client Review flags.
test("boundary: the admin content inventory needs an admin role and ignores review flags", () => {
  const inventory = read(join(root, "src/server/admin/content-inventory.js"));
  assert.doesNotMatch(inventory, /readReviewPolicy|isClientReviewEnabled|evaluateReviewMode|CLIENT_REVIEW_ENABLED|CLIENT_REVIEW_LOCAL|getContentService|lib\/db/);
  assert.doesNotMatch(inventory, /\.(insert|update|delete|replace|save|create|bulkWrite|aggregate)\w*\(/);
  const body = inventory.slice(inventory.indexOf("export async function loadContentInventory"));
  assert.ok(body.indexOf("requireAdminRole(principal, CONTENT_INVENTORY_ROLES)") > 0);
  assert.ok(body.indexOf("requireAdminRole(") < body.indexOf("readReviewDatabaseConfig("), "role check before configuration or connection");
  const page = read(join(root, "src/app/admin/content/page.js"));
  assert.ok(page.indexOf("getAdminAccess()") < page.indexOf("loadContentInventory("), "access check before reading content");
  assert.ok(page.indexOf("loadContentInventory(") < page.indexOf("await searchParams"), "filter read only after access");
  assert.match(page, /hasAdminRole\(access\.principal, CONTENT_INVENTORY_ROLES\)/);
});

// Runs after `npm run build`; skipped when no build output exists.
test("boundary: browser bundles contain no database code or secret names", { skip: !existsSync(join(root, ".next/static")) }, () => {
  for (const file of walk(join(root, ".next/static"), /\.(js|css|json)$/)) {
    const text = read(file);
    for (const marker of ["MONGODB_URI", "MONGODB_DB_NAME", "CLOUDINARY_API_SECRET", "AUTH_SECRET", "AUTH_GOOGLE_SECRET", "ADMIN_ALLOWED_ACCOUNTS", "mongodb+srv", "sanpudam168_staging", "CLIENT_REVIEW_", "sanpudam168/staging", "res.cloudinary.com"]) {
      assert.ok(!text.includes(marker), `${marker} found in ${rel(file)}`);
    }
  }
});

// Runs after `npm run build`: prerendered pages hold no migrated content.
test("boundary: prerendered output contains no migrated draft content", { skip: !existsSync(join(root, ".next/server/app")) }, () => {
  const markers = ["sanpudam168/staging", "res.cloudinary.com", "0823686168", "@sanpudam168", "share.google", "เป็นสถานที่ศักดิ์สิทธิ์และจุดเช็กอิน"];
  for (const file of walk(join(root, ".next/server/app"), /\.(html|rsc|body|meta|segments|json)$/)) {
    const text = read(file);
    for (const marker of markers) assert.ok(!text.includes(marker), `${marker} found in ${rel(file)}`);
  }
});

test("boundary: no sitemap, robots, feed, or public API route advertises review content", () => {
  const appFiles = walk(join(root, "src/app"), /\.(js|jsx|xml|txt)$/).map(rel);
  // The Auth.js handler is the only route handler.
  for (const file of appFiles) {
    if (file === "src/app/api/auth/[...nextauth]/route.js") continue;
    assert.doesNotMatch(file, /(sitemap|robots|feed|rss|route\.js)/i, file);
  }
  assert.match(read(join(root, "src/app/layout.js")), /robots:\s*{\s*index:\s*false,\s*follow:\s*false/);
});
