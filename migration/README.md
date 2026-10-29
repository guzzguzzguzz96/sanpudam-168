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

# 4. Cloudinary import (Phase 02.5.4; see docs/cloudinary-import-plan.md)
node migration/scripts/verify-media.mjs
node migration/scripts/import-cloudinary.mjs                    # offline dry run
node --env-file=.env.local migration/scripts/import-cloudinary.mjs --preflight   # read-only
node --env-file=.env.local migration/scripts/import-cloudinary.mjs --apply --plan-hash=<hash>   # approval required
node --env-file=.env.local migration/scripts/verify-cloudinary.mjs   # read-only post-upload check
node migration/scripts/build-media-mapping.mjs                  # media_assets mapping (local only)
node --test migration/scripts/tests/cloudinary.test.mjs         # mock-server tests

# 5. MongoDB import (Phase 02.5.5; see docs/mongodb-import-plan.md)
node migration/scripts/import-mongodb.mjs                       # offline dry run (no connection)
node --env-file=.env.local migration/scripts/import-mongodb.mjs --preflight   # approval required (read-only)
node --env-file=.env.local migration/scripts/import-mongodb.mjs --apply --plan-hash=<hash> --confirm-db=<db>   # approval required
node --test migration/scripts/tests/mongodb.test.mjs            # in-memory tests
```

## Status

- 2026-10-29: the 17 originals were imported to Cloudinary staging
  (`sanpudam168/staging/legacy/`, public `upload` delivery, owner-approved).
  17 uploaded, 0 conflicts, 0 failures; post-upload verification 17/17; a
  repeat preflight reports 17 `already_present`. See
  `docs/cloudinary-import-plan.md` §12.
- 2026-10-29: Mongoose models (`src/models/`) and the MongoDB importer are
  ready. Offline dry run: 56 records (17 media + 39 content), 31 media usages
  resolved, 32 placeholder flags, plan hash
  `3525e33166360a3b45362b17c0095eb4a2e62363f424c4171c17bfc37f8f29a4`.
- MongoDB has not been connected to or written. That step needs separate approval.

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
