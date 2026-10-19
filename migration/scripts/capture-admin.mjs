// Captures CMS content from the authenticated legacy admin by navigating
// its documented hash routes and keeping the read-only JSON the UI loads.
//
//   node migration/scripts/admin-browser.mjs   # then sign in manually
//   node migration/scripts/capture-admin.mjs --dry-run   # list routes only
//   node migration/scripts/capture-admin.mjs
//
// Output (gitignored): migration/content/raw/<module>.json and
// migration/reports/admin-network.json (paths, methods, statuses only).
// Never visits /messages, /account, or /log. Never clicks save/delete.
import { connectToPage, sleep } from "./lib/cdp.mjs";
import { createObserver } from "./lib/observe.mjs";
import { fromRoot, parseArgs, writeJson } from "./lib/files.mjs";

const args = parseArgs();
const MODULES = ["news", "gallery", "banners", "sacred", "categories", "videos", "reviews", "faqs", "team", "about", "settings"];
const EXTRA_ROUTES = ["#/placeholders", "#/health"];
const SKIPPED_ROUTES = ["#/messages", "#/account", "#/log"];

if (args.dryRun) {
  console.log(JSON.stringify({ moduleRoutes: MODULES.map((m) => `#/c/${m}`), extraRoutes: EXTRA_ROUTES, editRoutes: "first record of each list module", skipped: SKIPPED_ROUTES }, null, 2));
  process.exit(0);
}

const page = await connectToPage({ urlIncludes: "/admin" });
const signedIn = await page.evaluate("!document.querySelector('input[type=password]')");
if (!signedIn) {
  console.error("The admin is not signed in. Sign in in the browser window first.");
  process.exit(1);
}

const observer = await createObserver(page);
const captured = {};
const network = [];

// Marketing/analytics IDs are not migrated: keep only whether each was set.
const ANALYTICS_KEYS = ["ga4_id", "gads_id", "fb_pixel_id"];
function scrubAnalytics(json) {
  for (const item of json?.items ?? (json?.data ? [json] : [])) {
    for (const key of ANALYTICS_KEYS) {
      if (item.data && key in item.data) {
        const value = item.data[key];
        item.data[key] = { scrubbed: true, wasSet: Boolean(value && String(value).trim()) };
      }
    }
  }
  return json;
}

function keep(route, records) {
  for (const record of records) {
    network.push({ route, method: record.method, path: record.path, status: record.status, mimeType: record.mimeType, warning: record.warning });
    if (!record.json) continue;
    if (record.path.startsWith("/api/admin/dashboard")) {
      // The "recent" list is edit-log data (editor names, old/new values): not kept.
      const { recent, ...rest } = record.json;
      captured.dashboard = { path: record.path, json: { ...rest, recentOmitted: Array.isArray(recent) ? recent.length : 0 } };
      continue;
    }
    const key = record.path.match(/collection=([a-z_-]+)/)?.[1] ?? record.path.replace(/[^a-z0-9]+/gi, "_");
    captured[key] = { path: record.path, route, json: scrubAnalytics(record.json) };
  }
}

keep("#/", await observer.visit("#/"));
for (const moduleName of MODULES) {
  keep(`#/c/${moduleName}`, await observer.visit(`#/c/${moduleName}`));
  // Open the first edit form (read only) to see what the form loads, e.g. category options.
  const firstEdit = await page.evaluate(`[...document.querySelectorAll('a[href^="#/c/${moduleName}/"]')].map(a => a.getAttribute('href')).find(h => !h.endsWith('/new')) ?? null`);
  if (firstEdit) {
    const editRecords = await observer.visit(firstEdit, 3000);
    keep(firstEdit, editRecords);
    if (moduleName === "sacred") {
      captured._sacredFormSelects = await page.evaluate(`[...document.querySelectorAll('select')].map(s => ({ label: (s.closest('label, .field, div')?.querySelector('label, .label')?.textContent ?? '').trim().slice(0, 40), name: s.name || null, value: s.value, options: [...s.options].map(o => ({ value: o.value, text: o.textContent.trim() })) }))`);
    }
  }
}
for (const route of EXTRA_ROUTES) keep(route, await observer.visit(route, 3000));

await observer.visit("#/");
await sleep(500);
page.close();

const capturedAt = new Date().toISOString();
for (const [key, value] of Object.entries(captured)) {
  writeJson(fromRoot("migration/content/raw", `${key}.json`), { capturedAt, ...value });
}
writeJson(fromRoot("migration/reports/admin-network.json"), { capturedAt, requests: network });
const nonGet = network.filter((r) => r.method !== "GET");
console.log(JSON.stringify({ captured: Object.keys(captured), requests: network.length, nonGetRequests: nonGet.length }, null, 1));
