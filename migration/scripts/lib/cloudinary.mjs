// Minimal Cloudinary REST client for the legacy media import.
// Uses built-in fetch, FormData, Blob, and crypto (no SDK dependency).
//
// Credentials come only from environment variables and are never logged.
// Operations used: Admin API "get resource" (read) and Upload API "upload"
// with overwrite=false. There is no delete, rename, or overwrite code path.
import { createHash } from "node:crypto";

export const DEFAULT_IMPORT_ROOT = "sanpudam168/staging/legacy";
const CLOUDINARY_API = "https://api.cloudinary.com/v1_1";

// Only the real API or a local test server is accepted as the API base.
function resolveApiBase(value) {
  if (!value) return CLOUDINARY_API;
  const url = new URL(value);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (value.replace(/\/+$/, "") !== CLOUDINARY_API && !local) throw new Error("CLOUDINARY_API_BASE must be the Cloudinary API or a local test server.");
  return value.replace(/\/+$/, "");
}
const RETRYABLE = new Set([408, 420, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Non-secret settings (safe to print) and secret credentials (never printed).
export function loadConfig(env = process.env) {
  const settings = {
    cloudName: env.CLOUDINARY_CLOUD_NAME || null,
    importRoot: (env.CLOUDINARY_IMPORT_ROOT || DEFAULT_IMPORT_ROOT).replace(/^\/+|\/+$/g, ""),
    folderMode: env.CLOUDINARY_FOLDER_MODE === "fixed" ? "fixed" : "dynamic",
    deliveryType: ["upload", "authenticated", "private"].includes(env.CLOUDINARY_DELIVERY_TYPE) ? env.CLOUDINARY_DELIVERY_TYPE : "upload",
    apiBase: resolveApiBase(env.CLOUDINARY_API_BASE),
  };
  const secrets = { apiKey: env.CLOUDINARY_API_KEY || null, apiSecret: env.CLOUDINARY_API_SECRET || null };
  return {
    settings,
    hasCredentials: Boolean(settings.cloudName && secrets.apiKey && secrets.apiSecret),
    secrets,
  };
}

// The import root must be a staging namespace unless production is confirmed.
export function assertTargetAllowed(importRoot, { target = "staging", confirmRoot = null } = {}) {
  const isStaging = importRoot.split("/").includes("staging");
  if (target === "staging" && !isStaging) {
    throw new Error(`Import root "${importRoot}" is not a staging namespace (it must contain a "staging" path segment).`);
  }
  if (target === "production" && confirmRoot !== importRoot) {
    throw new Error("Production import requires --confirm-root=<exact import root>.");
  }
}

// Maps a manifest public ID (sanpudam168/<subject>/...) under the import root.
export function targetPublicId(manifestPublicId, importRoot) {
  const relative = manifestPublicId.replace(/^sanpudam168\//, "");
  return `${importRoot}/${relative}`;
}

const escapeContext = (value) => String(value).replace(/([=|\\])/g, "\\$1");
export const formatContext = (context) =>
  Object.entries(context)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${escapeContext(value)}`)
    .join("|");

// Cloudinary signature: SHA-1 of sorted "key=value" pairs joined with "&",
// followed by the API secret. file, cloud_name, resource_type, api_key excluded.
export function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .filter((key) => !["file", "cloud_name", "resource_type", "api_key"].includes(key) && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

export function createClient(config, { fetchImpl = fetch, apiBase = CLOUDINARY_API, attempts = 4, baseDelayMs = 1500 } = {}) {
  if (!config.hasCredentials) throw new Error("Cloudinary credentials are not set (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
  const { cloudName } = config.settings;
  const { apiKey, apiSecret } = config.secrets;
  const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;

  // Remove any accidental echo of credentials from error text.
  const clean = (text) => String(text).replaceAll(apiSecret, "[redacted]").replaceAll(apiKey, "[redacted]");

  async function request(url, init) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetchImpl(url, init());
        if (RETRYABLE.has(response.status) && attempt < attempts) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** (attempt - 1));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
    throw new Error(clean(`Request failed after ${attempts} attempts: ${lastError?.message ?? "unknown error"}`));
  }

  async function errorText(response) {
    try {
      const body = await response.json();
      return clean(body?.error?.message ?? JSON.stringify(body));
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  // Read-only account settings (used to confirm the folder mode).
  async function getAccountConfig() {
    const response = await request(`${apiBase}/${cloudName}/config?settings=true`, () => ({
      method: "GET",
      headers: { Authorization: authHeader },
    }));
    if (!response.ok) throw new Error(`getAccountConfig: ${await errorText(response)}`);
    return response.json();
  }

  // Read-only. Returns null when the asset does not exist.
  async function getResource(publicId, deliveryType) {
    const path = publicId.split("/").map(encodeURIComponent).join("/");
    const response = await request(`${apiBase}/${cloudName}/resources/image/${deliveryType}/${path}`, () => ({
      method: "GET",
      headers: { Authorization: authHeader },
    }));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`getResource ${publicId}: ${await errorText(response)}`);
    return response.json();
  }

  // Signed upload with overwrite=false: an existing public ID is returned
  // unchanged (Cloudinary sets "existing": true) and never replaced.
  async function upload({ fileBuffer, filename, mimeType, publicId, deliveryType, assetFolder, tags, context }) {
    const params = {
      public_id: publicId,
      type: deliveryType,
      overwrite: "false",
      unique_filename: "false",
      use_filename: "false",
      tags: tags.join(","),
      context: formatContext(context),
      timestamp: String(Math.floor(Date.now() / 1000)),
      ...(assetFolder ? { asset_folder: assetFolder } : {}),
    };
    const signature = signParams(params, apiSecret);
    const response = await request(`${apiBase}/${cloudName}/image/upload`, () => {
      const form = new FormData();
      for (const [key, value] of Object.entries(params)) form.append(key, value);
      form.append("api_key", apiKey);
      form.append("signature", signature);
      form.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
      return { method: "POST", body: form };
    });
    if (!response.ok) throw new Error(`upload ${publicId}: ${await errorText(response)}`);
    return response.json();
  }

  return { getAccountConfig, getResource, upload };
}
