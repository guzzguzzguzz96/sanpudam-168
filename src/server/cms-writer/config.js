import "server-only";

// Staging writer configuration for the admin CMS (docs/admin-authentication.md
// §13). The only module that reads these variables. A dedicated database
// user, separate from the read-only review account and from the
// migration/admin credentials, with no fallback to either:
//
//   CMS_WRITER_MONGODB_URI       connection string of the FAQ writer user
//   CMS_WRITER_MONGODB_DB_NAME   must be exactly sanpudam168_staging
//   CMS_WRITER_DNS_SERVERS       optional, local machine only (same purpose
//                                as the review DNS workaround)
//
// Missing or malformed values disable saving (fail closed). Values are never
// logged or returned; problems name variables only.

export const WRITER_DATABASE_NAME = "sanpudam168_staging";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const text = (value) => (typeof value === "string" ? value.trim() : "");

export function parseWriterDnsServers(value) {
  const servers = text(value).split(",").map((entry) => entry.trim()).filter(Boolean);
  return servers.length && servers.every((server) => IPV4.test(server)) ? servers : null;
}

// Returns { uri, dbName, dnsServers, problems }. uri and dbName are null
// while any problem exists.
export function readWriterConfig(env = process.env) {
  const uri = text(env?.CMS_WRITER_MONGODB_URI);
  const dbName = text(env?.CMS_WRITER_MONGODB_DB_NAME);
  const problems = [];
  if (!uri) problems.push("CMS_WRITER_MONGODB_URI is not set");
  else if (!/^mongodb(\+srv)?:\/\//.test(uri)) problems.push("CMS_WRITER_MONGODB_URI is not a MongoDB connection string");
  if (!dbName) problems.push("CMS_WRITER_MONGODB_DB_NAME is not set");
  else if (dbName !== WRITER_DATABASE_NAME) problems.push(`CMS_WRITER_MONGODB_DB_NAME must be ${WRITER_DATABASE_NAME}`);
  const dnsRaw = text(env?.CMS_WRITER_DNS_SERVERS);
  const dnsServers = dnsRaw ? parseWriterDnsServers(dnsRaw) : null;
  if (dnsRaw && !dnsServers) problems.push("CMS_WRITER_DNS_SERVERS must be comma-separated IPv4 addresses");
  const ok = problems.length === 0;
  return Object.freeze({ uri: ok ? uri : null, dbName: ok ? dbName : null, dnsServers: ok ? dnsServers : null, problems: Object.freeze(problems) });
}
