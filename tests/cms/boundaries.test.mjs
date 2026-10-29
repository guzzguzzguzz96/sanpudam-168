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

test("boundary: public routes and UI components do not use the CMS data layer yet", () => {
  const uiFiles = sourceFiles.filter((file) => /src[\\/](app|components|data)[\\/]/.test(file));
  for (const file of uiFiles) assert.doesNotMatch(read(file), SERVER_IMPORT, rel(file));
});

test("boundary: database secrets are read only in the server data layer", () => {
  const allowed = new Set(["src/lib/db.js", "src/server/cms/index.js"]);
  for (const file of sourceFiles) {
    const text = read(file);
    if (/process\.env\.(MONGODB_|CLOUDINARY_API|AUTH_SECRET)/.test(text)) assert.ok(allowed.has(rel(file)), `${rel(file)} reads a secret`);
    assert.doesNotMatch(text, /NEXT_PUBLIC_[A-Z_]*(MONGO|SECRET|API_KEY|PASSWORD)/, rel(file));
    assert.doesNotMatch(text, /mongodb(\+srv)?:\/\/[^"'`\s]*@/, `${rel(file)} contains a connection string`);
  }
  const example = read(join(root, ".env.example"));
  assert.doesNotMatch(example, /NEXT_PUBLIC_[A-Z_]*(MONGO|SECRET|API_KEY|PASSWORD)/);
});

// Runs after `npm run build`; skipped when no build output exists.
test("boundary: browser bundles contain no database code or secret names", { skip: !existsSync(join(root, ".next/static")) }, () => {
  for (const file of walk(join(root, ".next/static"), /\.(js|css|json)$/)) {
    const text = read(file);
    for (const marker of ["MONGODB_URI", "MONGODB_DB_NAME", "CLOUDINARY_API_SECRET", "AUTH_SECRET", "mongodb+srv", "sanpudam168_staging"]) {
      assert.ok(!text.includes(marker), `${marker} found in ${rel(file)}`);
    }
  }
});
