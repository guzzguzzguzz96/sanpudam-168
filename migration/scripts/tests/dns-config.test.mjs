// Tests for the optional MONGODB_DNS_SERVERS workaround. No MongoDB access:
// the CLI tests use an unroutable host and a local, closed DNS port.
//
//   node --test migration/scripts/tests/dns-config.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { configureMongoDns, parseDnsServers } from "../lib/dns-config.mjs";
import { fromRoot } from "../lib/files.mjs";

function mockDns(initial = ["127.0.0.1"]) {
  let servers = [...initial];
  const calls = [];
  return {
    calls,
    getServers: () => [...servers],
    setServers: (list) => {
      calls.push(list);
      servers = list.map((entry) => entry.replace(/^\[([^\]]+)\](:\d+)?$/, "$1").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1"));
    },
  };
}

test("parse: valid IPv4, IPv6, and port forms; duplicates removed", () => {
  assert.deepEqual(parseDnsServers("8.8.8.8,1.1.1.1"), ["8.8.8.8", "1.1.1.1"]);
  assert.deepEqual(parseDnsServers(" 8.8.8.8 , 8.8.8.8 "), ["8.8.8.8"]);
  assert.deepEqual(parseDnsServers("2001:4860:4860::8888"), ["2001:4860:4860::8888"]);
  assert.deepEqual(parseDnsServers("[2001:4860:4860::8888]:53,8.8.4.4:53"), ["[2001:4860:4860::8888]:53", "8.8.4.4:53"]);
});

test("parse: missing or empty configuration means system default", () => {
  for (const value of [undefined, null, "", "   "]) assert.equal(parseDnsServers(value), null);
  const dns = mockDns();
  assert.deepEqual(configureMongoDns({}, dns), { applied: false, servers: ["127.0.0.1"] });
  assert.equal(dns.calls.length, 0, "default DNS is left untouched");
});

test("parse: invalid addresses are rejected before anything is applied", () => {
  const invalid = ["dns.google", "8.8.8.8,", ",8.8.8.8", "999.1.1.1", "8.8.8.8:0", "8.8.8.8:70000", "8.8.8.8:abc", "[::1]:99999", "1.1.1.1,1.0.0.1,8.8.8.8,8.8.4.4,9.9.9.9"];
  for (const value of invalid) {
    const dns = mockDns();
    assert.throws(() => configureMongoDns({ MONGODB_DNS_SERVERS: value }, dns), /MONGODB_DNS_SERVERS/, value);
    assert.equal(dns.calls.length, 0, `nothing applied for ${value}`);
  }
});

test("configure: valid servers are applied through dns.setServers", () => {
  const dns = mockDns();
  const result = configureMongoDns({ MONGODB_DNS_SERVERS: "8.8.8.8,1.1.1.1" }, dns);
  assert.deepEqual(dns.calls, [["8.8.8.8", "1.1.1.1"]]);
  assert.deepEqual(result, { applied: true, servers: ["8.8.8.8", "1.1.1.1"] });
});

function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fromRoot("migration/scripts/import-mongodb.mjs"), ...args], { env, timeout: 90000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const FAKE_URI = "mongodb+srv://alice:s3cr3t-pw@cluster0.abc123.example.invalid/";
const baseEnv = () => {
  const env = { ...process.env, MONGODB_URI: FAKE_URI, MONGODB_DB_NAME: "sanpudam168_staging" };
  delete env.MONGODB_DNS_SERVERS;
  return env;
};

test("cli: an invalid DNS value stops the preflight before any connection attempt", async () => {
  const run = await runCli(["--preflight"], { ...baseEnv(), MONGODB_DNS_SERVERS: "not-an-ip" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /MONGODB_DNS_SERVERS: "not-an-ip" is not an IP address/);
  assert.doesNotMatch(run.stderr, /Connection failed/);
});

test("cli: configured DNS is applied before the connection attempt, and errors stay redacted", { timeout: 120000 }, async () => {
  // Port 9 on localhost: nothing answers, so the SRV lookup fails fast and offline.
  const run = await runCli(["--preflight"], { ...baseEnv(), MONGODB_DNS_SERVERS: "127.0.0.1:9" });
  assert.equal(run.status, 1);
  const dnsLine = run.stderr.indexOf("DNS: using MONGODB_DNS_SERVERS (127.0.0.1:9)");
  const connectionLine = run.stderr.indexOf("Connection failed");
  assert.ok(dnsLine >= 0, run.stderr);
  assert.ok(connectionLine > dnsLine, "DNS configured before the connection attempt");
  for (const secret of ["alice", "s3cr3t-pw", "abc123", "cluster0", FAKE_URI]) assert.ok(!run.stderr.includes(secret) && !run.stdout.includes(secret), `${secret} leaked`);
});

test("cli: without the variable the system default DNS is used and reported", { timeout: 120000 }, async () => {
  // The .invalid host fails harmlessly at DNS; nothing can be reached.
  const run = await runCli(["--preflight"], baseEnv());
  assert.equal(run.status, 1);
  assert.match(run.stderr, /DNS: system default \(MONGODB_DNS_SERVERS not set\)/);
  for (const secret of ["alice", "s3cr3t-pw", "abc123"]) assert.ok(!run.stderr.includes(secret), `${secret} leaked`);
});

test("cli: the target is verified before DNS is changed", async () => {
  const run = await runCli(["--preflight"], { ...baseEnv(), MONGODB_DNS_SERVERS: "127.0.0.1:9", MONGODB_DB_NAME: "" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /MONGODB_DB_NAME must be set explicitly/);
  assert.doesNotMatch(run.stderr, /DNS:/);
});

test("safety: the preflight branch never opens Mongoose and DNS precedes every connection", () => {
  const source = readFileSync(fromRoot("migration/scripts/import-mongodb.mjs"), "utf8");
  const preflightBody = source.slice(source.indexOf("async function runReadOnlyPreflight"));
  assert.doesNotMatch(preflightBody, /mongoose\.connect/);
  const dnsAt = source.indexOf("configureMongoDns(process.env)");
  assert.ok(dnsAt > 0 && dnsAt < source.indexOf("mongoose.connect(") && dnsAt < source.indexOf("openReadOnlyDatabase(process.env"), "DNS configured before both connection paths");
  assert.ok(source.indexOf("resolveStagingTarget(process.env") < dnsAt, "target verified before DNS is changed");
});

test("scope: the Next.js application does not use the DNS override", () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(js|jsx|mjs)$/.test(name)) files.push(path);
    }
  };
  walk(fromRoot("src"));
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/dns-config|node:dns|setServers|MONGODB_DNS_SERVERS/.test(text), `${file} must not change DNS`);
  }
});
