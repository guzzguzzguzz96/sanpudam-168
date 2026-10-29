// Server-side MongoDB connection helper (Mongoose). Importing this module
// does not connect; call connectToDatabase() from server code when needed.
//
// The database name must be configured explicitly with MONGODB_DB_NAME and
// is never inferred from the connection string.
import mongoose from "mongoose";

const cache = (globalThis.__sanpudamMongo ??= { promise: null });

export function getDatabaseConfig(env = process.env) {
  const uri = env.MONGODB_URI;
  const dbName = env.MONGODB_DB_NAME;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  if (!dbName) throw new Error("MONGODB_DB_NAME must be set explicitly; the database is never inferred from the connection string.");
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(dbName)) throw new Error("MONGODB_DB_NAME has an invalid format.");
  assertDatabaseMatchesEnvironment(dbName, env);
  return { uri, dbName };
}

const tokensOf = (name) => name.toLowerCase().split(/[^a-z0-9]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/).filter(Boolean);
const NON_PRODUCTION_TOKENS = ["staging", "stage", "stg", "dev", "development", "test", "preview", "sandbox"];
const PRODUCTION_TOKENS = ["prod", "production", "prd", "live"];

// Fails closed when a deployment points at the wrong database: Vercel
// Production must not use a staging/test database, and Preview or
// Development deployments must not use a production database.
export function assertDatabaseMatchesEnvironment(dbName, env = process.env) {
  const tokens = tokensOf(dbName);
  const deployment = env.VERCEL_ENV;
  if (deployment === "production" && tokens.some((t) => NON_PRODUCTION_TOKENS.includes(t))) {
    throw new Error("MONGODB_DB_NAME looks like a non-production database, but VERCEL_ENV is production.");
  }
  if ((deployment === "preview" || deployment === "development") && tokens.some((t) => PRODUCTION_TOKENS.includes(t))) {
    throw new Error(`MONGODB_DB_NAME looks like a production database, but VERCEL_ENV is ${deployment}.`);
  }
}

// Removes the connection string and its parts (user, password, hosts,
// including SRV/replica host names derived from them) from error text.
export function sanitizeError(error, uri) {
  let message = String(error?.message ?? error);
  if (uri) {
    message = message.split(uri).join("[connection string redacted]");
    try {
      const parsed = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:"));
      const secrets = [parsed.password, parsed.username, decodeURIComponent(parsed.password), decodeURIComponent(parsed.username)].filter(Boolean);
      for (const secret of secrets) message = message.split(secret).join("[redacted]");
      for (const host of parsed.host.split(",")) {
        const name = host.split(":")[0];
        // Cluster domain without the first label also covers shard host names.
        const domain = name.split(".").slice(1).join(".");
        if (name) message = message.split(name).join("[host redacted]");
        if (domain.includes(".")) message = message.replace(new RegExp(`[A-Za-z0-9_.-]*${domain.replace(/\./g, "\\.")}`, "g"), "[host redacted]");
      }
    } catch {
      // Unparseable URI: the full-string redaction above still applies.
    }
  }
  return new Error(message);
}

export async function connectToDatabase(env = process.env) {
  if (!cache.promise) {
    const { uri, dbName } = getDatabaseConfig(env);
    cache.promise = mongoose
      // No implicit collection or index creation from the app.
      .connect(uri, { dbName, bufferCommands: false, autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 10000 })
      .then((instance) => {
        const connected = instance.connection.db?.databaseName;
        if (connected !== dbName) throw new Error(`Connected to an unexpected database (${connected}).`);
        return instance;
      })
      .catch((error) => {
        cache.promise = null;
        throw sanitizeError(error, uri);
      });
  }
  return cache.promise;
}
