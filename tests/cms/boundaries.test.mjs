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
const REVIEW_WIRING = new Set(["src/app/page.js", "src/app/layout.js", "src/app/_review/review-homepage.js", "src/app/_review/review-chrome.js"]);

test("boundary: UI components never use the data layer; routes use only the review entry point", () => {
  const uiFiles = sourceFiles.filter((file) => /src[\\/](app|components|data)[\\/]/.test(file));
  for (const file of uiFiles) {
    const text = read(file);
    if (!REVIEW_WIRING.has(rel(file))) {
      assert.doesNotMatch(text, SERVER_IMPORT, rel(file));
      continue;
    }
    const serverImports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).filter((s) => SERVER_IMPORT.test(`from "${s}"`));
    for (const specifier of serverImports) assert.equal(specifier, "@/server/review", `${rel(file)} imports ${specifier}`);
  }
});

test("boundary: review mode is decided from the environment only, never from request data", () => {
  const reviewFiles = [...walk(join(root, "src/server/review"), /\.js$/), join(root, "src/lib/review-mode.js"), join(root, "src/server/cms/review-access.js"), ...walk(join(root, "src/app/_review"), /\.js$/)];
  for (const file of reviewFiles) {
    const text = read(file);
    assert.doesNotMatch(text, /next\/headers|cookies\(|headers\(\)|searchParams|draftMode|NEXT_PUBLIC_/, rel(file));
  }
  const page = read(join(root, "src/app/page.js"));
  assert.doesNotMatch(page, /searchParams|cookies|headers/);
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

test("boundary: session secrets and the preview allowlist are read only by the auth module", () => {
  for (const file of sourceFiles) {
    if (/env(\.|\[["'])(AUTH_SECRET|CMS_PREVIEW_ALLOWED_SUBJECTS)/.test(read(file))) assert.equal(rel(file), "src/server/auth/config.js");
  }
});

test("boundary: no preview, CMS, or auth route is active", () => {
  const routeFiles = walk(join(root, "src/app"), /\.(js|jsx)$/).map(rel);
  for (const file of routeFiles) assert.doesNotMatch(file, /(preview|cms|admin|auth|login|api)/i, file);
  assert.ok(!existsSync(join(root, "src/proxy.js")) && !existsSync(join(root, "src/middleware.js")));
});

// Runs after `npm run build`; skipped when no build output exists.
test("boundary: browser bundles contain no database code or secret names", { skip: !existsSync(join(root, ".next/static")) }, () => {
  for (const file of walk(join(root, ".next/static"), /\.(js|css|json)$/)) {
    const text = read(file);
    for (const marker of ["MONGODB_URI", "MONGODB_DB_NAME", "CLOUDINARY_API_SECRET", "AUTH_SECRET", "CMS_PREVIEW_ALLOWED_SUBJECTS", "__Host-sanpudam-cms-session", "mongodb+srv", "sanpudam168_staging", "CLIENT_REVIEW_", "sanpudam168/staging", "res.cloudinary.com"]) {
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
  for (const file of appFiles) assert.doesNotMatch(file, /(sitemap|robots|feed|rss|route\.js)/i, file);
  assert.match(read(join(root, "src/app/layout.js")), /robots:\s*{\s*index:\s*false,\s*follow:\s*false/);
});
