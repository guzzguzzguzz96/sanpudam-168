import "server-only";
import { createHash } from "node:crypto";
import dns from "node:dns";
import mongoose from "mongoose";
import { sanitizeError } from "../../lib/db.js";
import { Banner, Category, Faq, GalleryItem, MediaAsset, News, Page, Review, SacredItem, SiteSettings, TeamMember, Video } from "../../models/index.js";
import { REVIEW_DATABASE_NAME } from "./config.js";

// Dedicated read-only connection for Client Review. It never shares the
// default Mongoose connection (src/lib/db.js), so review reads cannot use
// the migration/admin credentials by accident.
//
// Safeguards, in order:
//   1. a separate connection with autoCreate, autoIndex, and command
//      buffering off (no collection or index is ever created from here);
//   2. the connected database must be exactly sanpudam168_staging;
//   3. the authenticated user must hold only the built-in `read` role on
//      that database (checked with the read-only connectionStatus command),
//      so an admin or read-write user is refused before any content query;
//   4. models are exposed through facades with find/findOne only.
// The MongoDB user's own permissions remain the real boundary; these checks
// make a misconfiguration fail closed instead of silently working.

// Every content model, read-only. Review pages use a subset; the admin
// content inventory (src/server/admin) lists all of them.
const MODELS = { Banner, Category, Faq, GalleryItem, MediaAsset, News, Page, Review, SacredItem, SiteSettings, TeamMember, Video };
const READ_METHODS = ["find", "findOne"];

export const REVIEW_CONNECTION_OPTIONS = Object.freeze({
  autoCreate: false,
  autoIndex: false,
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 5,
});

export class ReviewPrivilegeError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReviewPrivilegeError";
  }
}

// connectionStatus result -> throws unless every role is read@staging.
export function assertReadOnlyRoles(status, dbName = REVIEW_DATABASE_NAME) {
  const roles = status?.authInfo?.authenticatedUserRoles;
  if (!Array.isArray(roles) || roles.length === 0) throw new ReviewPrivilegeError("Review connection user has no verifiable roles.");
  const extra = roles.filter((role) => role?.role !== "read" || role?.db !== dbName);
  if (extra.length) throw new ReviewPrivilegeError(`Review connection user must hold only read@${dbName}.`);
}

export function readOnlyModel(model) {
  return Object.freeze(Object.fromEntries(READ_METHODS.map((method) => [method, (...args) => model[method](...args)])));
}

// Compiles the content models on the review connection with their existing
// schemas (autoCreate/autoIndex are already off at schema level).
export function registerReviewModels(connection) {
  return Object.fromEntries(
    Object.entries(MODELS).map(([name, model]) => [name, readOnlyModel(connection.models[model.modelName] ?? connection.model(model.modelName, model.schema))]),
  );
}

// One connection (and its pool) per server process, shared by every
// request. It is bound to the configuration that opened it: a different
// URI, database, or DNS setting closes it and opens a new one, which runs
// every safeguard again. Only a hash of the configuration is kept.
const cache = (globalThis.__sanpudamReviewMongo ??= { promise: null, key: null, connection: null });

export function reviewConfigKey(config) {
  return createHash("sha256").update(JSON.stringify([config.uri, config.dbName, config.dnsServers ?? null])).digest("hex");
}

// config: { uri, dbName, dnsServers } from readReviewDatabaseConfig().
// dnsServers (local review only, see service.js) replaces this process's
// resolvers for the mongodb+srv lookup. Returns { models } once every
// safeguard has passed.
export function connectReviewDatabase(config, { mongooseInstance = mongoose, dnsModule = dns } = {}) {
  if (!config?.uri || config.dbName !== REVIEW_DATABASE_NAME) return Promise.reject(new Error("Client review database is not configured."));
  const key = reviewConfigKey(config);
  if (cache.promise && cache.key !== key) {
    cache.connection?.close().catch(() => {});
    cache.promise = null;
    cache.connection = null;
  }
  if (!cache.promise) {
    if (config.dnsServers?.length) {
      // Callback and promise APIs keep separate default resolvers.
      dnsModule.setServers(config.dnsServers);
      dnsModule.promises?.setServers(config.dnsServers);
    }
    const connection = mongooseInstance.createConnection(config.uri, { ...REVIEW_CONNECTION_OPTIONS, dbName: config.dbName });
    cache.key = key;
    cache.connection = connection;
    cache.promise = connection
      .asPromise()
      .then(async () => {
        const connected = connection.db?.databaseName;
        if (connected !== REVIEW_DATABASE_NAME) throw new Error(`Review connection opened an unexpected database (${connected}).`);
        assertReadOnlyRoles(await connection.db.command({ connectionStatus: 1 }));
        return { models: registerReviewModels(connection) };
      })
      .catch(async (error) => {
        if (cache.connection === connection) {
          cache.promise = null;
          cache.key = null;
          cache.connection = null;
        }
        await connection.close().catch(() => {});
        throw sanitizeError(error, config.uri);
      });
  }
  return cache.promise;
}

// Test helper: forget the cached connection.
export function resetReviewConnectionCache() {
  cache.promise = null;
  cache.key = null;
  cache.connection = null;
}
