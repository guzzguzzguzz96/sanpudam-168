// Target-database safety for the MongoDB importer. Fails closed: any doubt
// about the target stops the run before a connection is made.

const PRODUCTION_TOKENS = new Set(["prod", "production", "prd", "live", "main", "master"]);
const tokens = (name) => name.toLowerCase().split(/[-_.]+/).filter(Boolean);

// Database name embedded in a connection string path, if any.
export function databaseInUri(uri) {
  try {
    const path = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).pathname.replace(/^\//, "");
    return path ? decodeURIComponent(path.split("/")[0]) : null;
  } catch {
    throw new Error("MONGODB_URI could not be parsed.");
  }
}

// Validates the configured staging target. Never returns or prints the URI.
export function resolveStagingTarget(env = process.env, { requireUri = true, confirmDb = null, requireConfirmation = false } = {}) {
  const dbName = env.MONGODB_DB_NAME;
  if (requireUri && !env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  if (!dbName) throw new Error("MONGODB_DB_NAME must be set explicitly; the target database is never inferred from the connection string.");
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(dbName)) throw new Error("MONGODB_DB_NAME has an invalid format.");

  const parts = tokens(dbName);
  if (parts.some((part) => PRODUCTION_TOKENS.has(part))) throw new Error(`"${dbName}" looks like a production database; staging imports refuse it.`);
  if (!parts.includes("staging")) throw new Error(`"${dbName}" is not a staging database name (it must contain a "staging" token).`);

  if (env.MONGODB_URI) {
    const inUri = databaseInUri(env.MONGODB_URI);
    if (inUri && inUri !== dbName) throw new Error("The connection string names a different database than MONGODB_DB_NAME; refusing the ambiguous target.");
  }
  if (requireConfirmation && confirmDb !== dbName) throw new Error("Apply requires --confirm-db=<exact MONGODB_DB_NAME>.");
  return { dbName };
}

// After connecting: the server must report exactly the expected database.
export function assertConnectedTarget(connection, dbName) {
  const actual = connection?.db?.databaseName;
  if (actual !== dbName) throw new Error("Connected database does not match the verified target; stopping.");
}
