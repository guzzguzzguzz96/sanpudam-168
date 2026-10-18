<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow and permissions

- `main` is the production branch and must contain only stable, verified code.
- `dev` is the development and preview branch and is the default base for future work. Create feature branches from `dev`; release changes through a pull request from `dev` into `main`.
- Before staging, inspect every changed file and verify no credentials or secrets are included. Do not stage unknown or unrelated user changes.
- Local Git status, add, commit, branch, switch, and fetch operations are permitted. Make local commits only after the relevant verification succeeds; use Conventional Commit type prefixes such as `feat`, `fix`, `refactor`, `style`, `docs`, or `chore`.
- Never push, including an initial push, without explicit user approval for that push. Prior approval does not authorize later pushes.
- Merges, rebases, pulls that merge or rebase, releases, pull-request creation/merge, and deployment require explicit user approval.
- Never force-push, hard-reset, or delete branches.
