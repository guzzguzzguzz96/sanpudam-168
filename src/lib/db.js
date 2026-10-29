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
  return { uri, dbName };
}

// Removes the connection string from any error text before it is surfaced.
export function sanitizeError(error, uri) {
  const message = String(error?.message ?? error);
  return new Error(uri ? message.split(uri).join("[connection string redacted]") : message);
}

export async function connectToDatabase(env = process.env) {
  if (!cache.promise) {
    const { uri, dbName } = getDatabaseConfig(env);
    cache.promise = mongoose
      .connect(uri, { dbName, bufferCommands: false, serverSelectionTimeoutMS: 10000 })
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
