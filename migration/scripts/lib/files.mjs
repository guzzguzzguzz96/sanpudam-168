import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const MIGRATION_DIR = join(PROJECT_ROOT, "migration");

export const fromRoot = (...parts) => join(PROJECT_ROOT, ...parts);
export const toRootRelative = (path) => relative(PROJECT_ROOT, path).replaceAll("\\", "/");

export function readJson(path, fallback = null) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
}

// Atomic write: a crash never leaves a half-written manifest.
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temp, path);
}

export function writeFileAtomic(path, buffer) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, buffer);
  renameSync(temp, path);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: false, flags: new Set(), values: {} };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--") && arg.includes("=")) {
      const [key, ...rest] = arg.slice(2).split("=");
      args.values[key] = rest.join("=");
    } else if (arg.startsWith("--")) args.flags.add(arg.slice(2));
  }
  return args;
}
