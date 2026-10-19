# Legacy migration workspace

Owner-authorized extraction of media and content from the legacy Sanpudam 168
site (Phase 02.5.3). Only this README and `scripts/` are committed; everything
else in this folder is local working data and is gitignored.

```text
migration/
  scripts/            committed: extraction, normalization, and dry-run tools
  assets/<folder>/    gitignored: downloaded original media
  content/raw/        gitignored: redacted JSON captured from the admin UI
  content/*.json      gitignored: normalized records (target schema shape)
  manifests/          gitignored: media-manifest.json, content-manifest.json
  reports/            gitignored: dry-run.json, dry-run.md, admin-network.json
```

## Workflow

Run from the project root with Node.js 24. Every step can be re-run safely.

```bash
# 1. Public media (originals from docs/reference-media-manifest.json)
node migration/scripts/download-public-media.mjs --dry-run
node migration/scripts/download-public-media.mjs

# 2. Admin content: open a separate browser, sign in yourself, then capture
node migration/scripts/admin-browser.mjs
node migration/scripts/capture-admin.mjs --dry-run
node migration/scripts/capture-admin.mjs
node migration/scripts/admin-browser.mjs --cleanup   # after closing the window

# 3. Normalize and report (local files only)
node migration/scripts/build-content.mjs
node migration/scripts/dry-run-report.mjs
```

## Safety rules built into the scripts

- Public downloads use GET only, one request about every 0.8 s, and refuse
  `/admin` and `/api/` paths. Each file is checked by its magic bytes, and its
  SHA-256 is compared with the Phase 02.5.1 inventory.
- The admin capture never handles credentials: the user signs in in a separate
  browser window with a temporary profile. The scripts observe only the GET
  requests the admin UI makes by itself. They never read cookies, tokens, or
  request headers, never replay or send requests, and block the CDP cookie
  methods. Sensitive keys are removed from captured JSON.
- Not visited: `#/messages`, `#/account`, `#/log`. The dashboard's recent-edit
  list (editor names, old/new values) is discarded.
- Analytics/marketing IDs are scrubbed from the local capture.
- Nothing connects to MongoDB or Cloudinary, and nothing reads `.env.local`.
