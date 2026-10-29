// Tests for the Cloudinary importer. No real Cloudinary access: the
// end-to-end tests run the importer against a local mock server.
//
//   node --test migration/scripts/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertTargetAllowed, createClient, formatContext, loadConfig, signParams, targetPublicId } from "../lib/cloudinary.mjs";
import { fromRoot } from "../lib/files.mjs";

const sharp = createRequire(import.meta.url)("sharp");
const IMPORTER = fromRoot("migration/scripts/import-cloudinary.mjs");
const FAKE = { CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "key-123456", CLOUDINARY_API_SECRET: "secret-abcdef-XYZ" };

// --- unit tests --------------------------------------------------------------

test("signParams matches Cloudinary's documented example", () => {
  const params = { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: "1315060510" };
  assert.equal(signParams(params, "abcd"), "bfd09f95f331f558cbd1320e67aa8d488770583e");
});

test("signParams ignores file, api_key, resource_type, cloud_name and empty values", () => {
  const base = { public_id: "a", timestamp: "1" };
  assert.equal(signParams({ ...base, file: "x", api_key: "k", resource_type: "image", cloud_name: "c", tags: "" }, "s"), signParams(base, "s"));
});

test("targetPublicId re-roots manifest IDs under the import root", () => {
  assert.equal(targetPublicId("sanpudam168/brand/logo-mark", "sanpudam168/staging/legacy"), "sanpudam168/staging/legacy/brand/logo-mark");
});

test("assertTargetAllowed requires a staging namespace or an exact production confirmation", () => {
  assert.doesNotThrow(() => assertTargetAllowed("sanpudam168/staging/legacy"));
  assert.throws(() => assertTargetAllowed("sanpudam168"), /not a staging namespace/);
  assert.throws(() => assertTargetAllowed("sanpudam168", { target: "production" }), /confirm-root/);
  assert.doesNotThrow(() => assertTargetAllowed("sanpudam168", { target: "production", confirmRoot: "sanpudam168" }));
});

test("formatContext escapes separators and drops empty values", () => {
  assert.equal(formatContext({ alt: "a=b|c", empty: "", sha256: "ff" }), "alt=a\\=b\\|c|sha256=ff");
});

test("loadConfig rejects non-Cloudinary API bases except a local server", () => {
  assert.throws(() => loadConfig({ CLOUDINARY_API_BASE: "https://evil.example/v1_1" }), /Cloudinary API or a local test server/);
  assert.equal(loadConfig({ CLOUDINARY_API_BASE: "http://127.0.0.1:9999/v1_1" }).settings.apiBase, "http://127.0.0.1:9999/v1_1");
  assert.equal(loadConfig({}).hasCredentials, false);
});

test("client retries 429 and redacts credentials from errors", async () => {
  const config = loadConfig(FAKE);
  let calls = 0;
  const flaky = async () => {
    calls++;
    return calls === 1 ? new Response("", { status: 429 }) : new Response(JSON.stringify({ public_id: "x", etag: "e" }), { status: 200 });
  };
  const client = createClient(config, { fetchImpl: flaky, baseDelayMs: 1 });
  assert.equal((await client.getResource("x", "upload")).public_id, "x");
  assert.equal(calls, 2);

  const leaky = async () => new Response(JSON.stringify({ error: { message: `bad key ${FAKE.CLOUDINARY_API_KEY} / ${FAKE.CLOUDINARY_API_SECRET}` } }), { status: 401 });
  const failing = createClient(config, { fetchImpl: leaky, baseDelayMs: 1 });
  await assert.rejects(failing.getResource("x", "upload"), (error) => !error.message.includes(FAKE.CLOUDINARY_API_SECRET) && !error.message.includes(FAKE.CLOUDINARY_API_KEY));
});

// --- end-to-end against a mock Cloudinary --------------------------------------

// Parses Cloudinary's "key=value|key=value" context with backslash escapes.
function parseContext(text = "") {
  const pairs = {};
  for (const part of text.split(/(?<!\\)\|/)) {
    const [key, ...rest] = part.split(/(?<!\\)=/);
    if (key) pairs[key] = rest.join("=").replace(/\\([=|\\])/g, "$1");
  }
  return pairs;
}

function startMockCloudinary() {
  const assets = new Map();
  const stats = { uploads: 0, rejectedSignatures: 0, overwriteViolations: 0, folderMode: "dynamic" };
  const expectedAuth = `Basic ${Buffer.from(`${FAKE.CLOUDINARY_API_KEY}:${FAKE.CLOUDINARY_API_SECRET}`).toString("base64")}`;
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1_1/test-cloud/config") {
      if (req.headers.authorization !== expectedAuth) return send(401, { error: { message: "unauthorized" } });
      return send(200, { cloud_name: "test-cloud", settings: { folder_mode: stats.folderMode } });
    }
    const getMatch = url.pathname.match(/^\/v1_1\/test-cloud\/resources\/image\/upload\/(.+)$/);
    if (req.method === "GET" && getMatch) {
      if (req.headers.authorization !== expectedAuth) return send(401, { error: { message: "unauthorized" } });
      const asset = assets.get(decodeURIComponent(getMatch[1]));
      if (!asset) return send(404, { error: { message: "not found" } });
      // Like the real Admin API: no etag, but tags and context are returned.
      const { etag, ...withoutEtag } = asset;
      void etag;
      return send(200, withoutEtag);
    }
    if (req.method === "POST" && url.pathname === "/v1_1/test-cloud/image/upload") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": req.headers["content-type"] } }).formData();
      const params = {};
      for (const [key, value] of form.entries()) if (typeof value === "string") params[key] = value;
      if (params.api_secret) return send(400, { error: { message: "secret must never be sent" } });
      const { signature, api_key: apiKey, ...signed } = params;
      if (apiKey !== FAKE.CLOUDINARY_API_KEY || signParams(signed, FAKE.CLOUDINARY_API_SECRET) !== signature) {
        stats.rejectedSignatures++;
        return send(401, { error: { message: "Invalid Signature" } });
      }
      if (params.overwrite !== "false") stats.overwriteViolations++;
      const existing = assets.get(params.public_id);
      if (existing) return send(200, { ...existing, existing: true });
      const file = Buffer.from(await form.get("file").arrayBuffer());
      const meta = await sharp(file).metadata();
      stats.uploads++;
      const asset = {
        asset_id: createHash("md5").update(params.public_id).digest("hex"),
        public_id: params.public_id,
        version: 1700000000 + stats.uploads,
        resource_type: "image",
        type: params.type,
        format: meta.format === "jpeg" ? "jpg" : meta.format,
        width: meta.width,
        height: meta.height,
        bytes: file.length,
        etag: createHash("md5").update(file).digest("hex"),
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${params.public_id}`,
        tags: params.tags.split(","),
        context: { custom: parseContext(params.context) },
        created_at: new Date().toISOString(),
      };
      assets.set(params.public_id, asset);
      return send(200, asset);
    }
    send(404, { error: { message: `unexpected ${req.method} ${url.pathname}` } });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, assets, stats, base: `http://127.0.0.1:${server.address().port}/v1_1` })));
}

// Async child process so the in-process mock server keeps serving requests.
function runImporter(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [IMPORTER, ...args], { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("importer: apply, re-run without duplicates, conflict without overwrite", { timeout: 180000 }, async () => {
  const mock = await startMockCloudinary();
  const out = mkdtempSync(join(tmpdir(), "sanpudam-cloudinary-test-"));
  const env = { ...FAKE, CLOUDINARY_API_BASE: mock.base };
  try {
    const dry = spawnSync(process.execPath, [IMPORTER, `--out=${out}`], { env: { ...process.env, ...env }, encoding: "utf8" });
    assert.equal(dry.status, 0, dry.stderr);
    const planHash = JSON.parse(dry.stdout).planHash;

    const wrongHash = await runImporter(["--apply", "--plan-hash=deadbeef", `--out=${out}`], env);
    assert.equal(wrongHash.status, 1);
    assert.equal(mock.stats.uploads, 0);

    const notStaging = await runImporter(["--apply", `--plan-hash=${planHash}`, `--out=${out}`], { ...env, CLOUDINARY_IMPORT_ROOT: "sanpudam168" });
    assert.equal(notStaging.status, 1);
    assert.equal(mock.stats.uploads, 0);

    mock.stats.folderMode = "fixed";
    const wrongMode = await runImporter(["--apply", `--plan-hash=${planHash}`, `--out=${out}`], env);
    assert.equal(wrongMode.status, 1, "a folder mode mismatch must stop the import");
    assert.match(wrongMode.stderr, /Folder mode mismatch/);
    assert.equal(mock.stats.uploads, 0);
    mock.stats.folderMode = "dynamic";

    const first = await runImporter(["--apply", `--plan-hash=${planHash}`, `--out=${out}`], env);
    assert.equal(first.status, 0, first.stderr + first.stdout);
    assert.equal(mock.stats.uploads, 17);
    assert.equal(mock.stats.rejectedSignatures, 0);
    assert.equal(mock.stats.overwriteViolations, 0);
    const imported = JSON.parse(readFileSync(join(out, "manifests", "cloudinary-assets.json"), "utf8")).assets;
    assert.equal(imported.length, 17);
    assert.ok(imported.every((a) => a.cloudinary.publicId.startsWith("sanpudam168/staging/legacy/") && a.cloudinary.etag === a.contentHash.md5));

    const second = await runImporter(["--apply", `--plan-hash=${planHash}`, `--out=${out}`], env);
    assert.equal(second.status, 0);
    assert.equal(mock.stats.uploads, 17, "a second run must not upload again");
    assert.match(second.stdout, /"already_present": 17/);

    const tamperedId = "sanpudam168/staging/legacy/brand/logo-mark";
    const original = mock.assets.get(tamperedId);
    mock.assets.set(tamperedId, { ...original, etag: "0".repeat(32), bytes: 1, context: { custom: { ...original.context.custom, sha256: "0".repeat(64) } } });
    const third = await runImporter(["--apply", `--plan-hash=${planHash}`, `--out=${out}`], env);
    assert.equal(third.status, 2, "a conflict must make the run fail");
    assert.match(third.stdout, /"conflict": 1/);
    assert.equal(mock.assets.get(tamperedId).bytes, 1, "the conflicting asset must not be overwritten");
    assert.equal(mock.stats.uploads, 17);

    // No credential appears in any output.
    const outputs = [dry.stdout, first.stdout, second.stdout, third.stdout, third.stderr];
    for (const dir of ["reports", "manifests"]) for (const file of readdirSync(join(out, dir))) outputs.push(readFileSync(join(out, dir, file), "utf8"));
    for (const text of outputs) {
      assert.ok(!text.includes(FAKE.CLOUDINARY_API_SECRET) && !text.includes(FAKE.CLOUDINARY_API_KEY), "credential leaked into output");
    }
  } finally {
    mock.server.close();
    rmSync(out, { recursive: true, force: true });
  }
});
