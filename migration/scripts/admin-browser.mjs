// Opens a separate, visible Chrome window for the legacy admin so the
// authorized user can sign in interactively. Credentials are typed by
// the user into the legacy site only; scripts never see them.
//
//   node migration/scripts/admin-browser.mjs           # open
//   node migration/scripts/admin-browser.mjs --cleanup # delete the temporary profile
//
// The temporary profile (migration/.browser-profile) holds the session
// cookie on disk while the window is open. It is gitignored and should be
// deleted with --cleanup after extraction.
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fromRoot, parseArgs } from "./lib/files.mjs";
import { DEBUG_PORT } from "./lib/cdp.mjs";

const args = parseArgs();
const profile = fromRoot("migration/.browser-profile");

if (args.flags.has("cleanup")) {
  rmSync(profile, { recursive: true, force: true });
  console.log(existsSync(profile) ? "Profile still exists (close Chrome first)." : "Temporary browser profile deleted.");
  process.exit(0);
}

const chromePaths = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const browser = chromePaths.find((path) => existsSync(path));
if (!browser) throw new Error("Chrome or Edge was not found.");

const child = spawn(browser, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--remote-debugging-address=127.0.0.1",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "https://sanpudam168.1d1d.workers.dev/admin/#/",
], { detached: true, stdio: "ignore" });
child.unref();
console.log(`Opened ${browser.split("/").pop()} with a temporary profile. Sign in to the legacy admin in that window.`);
