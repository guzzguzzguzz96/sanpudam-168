// Optional DNS resolvers for the migration CLI (MONGODB_DNS_SERVERS).
//
// Some Windows setups answer normal lookups but refuse the SRV/TXT queries
// that mongodb+srv:// needs (Node uses its own resolver, c-ares, for those).
// Setting explicit resolvers with dns.setServers() fixes SRV resolution for
// this process only. Absent variable = Node's default DNS behavior.
//
// Only the migration CLI imports this module; the Next.js app does not.
import dns from "node:dns";
import { isIP } from "node:net";

const MAX_SERVERS = 4;

// Accepts IPv4, IPv6, "IPv4:port", and "[IPv6]:port". Hostnames are rejected,
// because resolving a resolver's name would itself need DNS.
export function parseDnsServers(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const entries = String(value).split(",").map((entry) => entry.trim());
  if (entries.some((entry) => entry === "")) throw new Error("MONGODB_DNS_SERVERS contains an empty entry.");
  if (entries.length > MAX_SERVERS) throw new Error(`MONGODB_DNS_SERVERS accepts at most ${MAX_SERVERS} servers.`);

  const servers = entries.map((entry) => {
    let address = entry;
    let port = null;
    const bracketed = entry.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (bracketed) {
      address = bracketed[1];
      port = bracketed[2] ?? null;
    } else if (isIP(entry) !== 6 && entry.includes(":")) {
      const index = entry.lastIndexOf(":");
      address = entry.slice(0, index);
      port = entry.slice(index + 1);
    }
    if (!isIP(address)) throw new Error(`MONGODB_DNS_SERVERS: "${entry}" is not an IP address.`);
    if (port !== null) {
      const number = Number(port);
      if (!/^\d+$/.test(port) || number < 1 || number > 65535) throw new Error(`MONGODB_DNS_SERVERS: "${entry}" has an invalid port.`);
    }
    return entry;
  });
  return [...new Set(servers)];
}

// Applies the configured resolvers (if any) and reports what was done.
export function configureMongoDns(env = process.env, dnsModule = dns) {
  const servers = parseDnsServers(env.MONGODB_DNS_SERVERS);
  if (!servers) return { applied: false, servers: dnsModule.getServers() };
  dnsModule.setServers(servers);
  return { applied: true, servers: dnsModule.getServers() };
}
