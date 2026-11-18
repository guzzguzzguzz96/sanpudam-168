import "server-only";
import { isIP } from "node:net";
import { evaluateReviewMode } from "../../lib/review-mode.js";

// Client Review settings, read only on the server and only from this file.
//
//   CLIENT_REVIEW_ENABLED        "true" on the Vercel Preview (dev) deployment
//   CLIENT_REVIEW_LOCAL          "true" for local review (separate opt-in)
//   CLIENT_REVIEW_MONGODB_URI    connection string of a MongoDB user with the
//                                built-in `read` role on sanpudam168_staging
//                                only (never the migration/admin user)
//   CLIENT_REVIEW_MONGODB_DB_NAME  must be exactly sanpudam168_staging
//   CLIENT_REVIEW_DNS_SERVERS    optional, local review only: comma-separated
//                                resolver IPs for mongodb+srv lookups on
//                                machines whose system resolver refuses SRV
//                                queries (ignored on Vercel)
//
// There is no fallback: MONGODB_URI and MONGODB_DB_NAME are never read here,
// so missing review credentials leave review data unavailable instead of
// borrowing another connection.

export const REVIEW_DATABASE_NAME = "sanpudam168_staging";

export function readReviewPolicy(env = process.env) {
  return evaluateReviewMode(env);
}

// IP addresses only (resolving a resolver's name would itself need DNS),
// at most 4. Returns null when unset; throws on invalid input.
export function parseReviewDnsServers(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const servers = value.split(",").map((entry) => entry.trim());
  if (servers.length > 4 || servers.some((entry) => !isIP(entry))) throw new Error("CLIENT_REVIEW_DNS_SERVERS must be up to 4 comma-separated IP addresses");
  return [...new Set(servers)];
}

// Returns { uri, dbName, dnsServers, problems }. uri and dbName are null
// unless every check passes.
export function readReviewDatabaseConfig(env = process.env) {
  const uri = typeof env.CLIENT_REVIEW_MONGODB_URI === "string" ? env.CLIENT_REVIEW_MONGODB_URI.trim() : "";
  const dbName = typeof env.CLIENT_REVIEW_MONGODB_DB_NAME === "string" ? env.CLIENT_REVIEW_MONGODB_DB_NAME.trim() : "";
  const problems = [];
  if (!uri) problems.push("CLIENT_REVIEW_MONGODB_URI is not set");
  else if (!/^mongodb(\+srv)?:\/\//.test(uri)) problems.push("CLIENT_REVIEW_MONGODB_URI is not a MongoDB connection string");
  if (!dbName) problems.push("CLIENT_REVIEW_MONGODB_DB_NAME is not set");
  else if (dbName !== REVIEW_DATABASE_NAME) problems.push(`CLIENT_REVIEW_MONGODB_DB_NAME must be ${REVIEW_DATABASE_NAME}`);
  let dnsServers = null;
  try {
    dnsServers = parseReviewDnsServers(env.CLIENT_REVIEW_DNS_SERVERS);
  } catch (error) {
    problems.push(error.message);
  }
  return problems.length ? { uri: null, dbName: null, dnsServers: null, problems } : { uri, dbName, dnsServers, problems };
}
