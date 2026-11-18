import "server-only";
import { createHash } from "node:crypto";
import dns from "node:dns";
import mongoose from "mongoose";
import { sanitizeError } from "../../lib/db.js";
import { WRITER_DATABASE_NAME } from "./config.js";

// Dedicated staging writer connection for the admin CMS. Separate from the
// read-only review connection (review/connection.js) and from the default
// connection (lib/db.js). The only module in src/ that writes to MongoDB.
//
// Before use, in order (any failure closes the connection and fails):
//   1. the connected database is exactly sanpudam168_staging;
//   2. the user's privileges (connectionStatus, showPrivileges) are limited
//      to the FAQ edit scope: find/update on `faqs`, insert (and optionally
//      find) on `admin_audit_log`, nothing else and no other database;
//   3. the audit collection exists (it is created once by the owner, never
//      from here).
// Writes then run only through withFaqTransaction(): one MongoDB transaction
// covering the FAQ update and its audit entry.

export const FAQ_COLLECTION = "faqs";
export const AUDIT_COLLECTION = "admin_audit_log";

// Collection -> allowed actions, and the actions each one must have.
const ALLOWED_PRIVILEGES = Object.freeze({ [FAQ_COLLECTION]: ["find", "update"], [AUDIT_COLLECTION]: ["find", "insert"] });
const REQUIRED_PRIVILEGES = Object.freeze({ [FAQ_COLLECTION]: ["find", "update"], [AUDIT_COLLECTION]: ["insert"] });

export const WRITER_CONNECTION_OPTIONS = Object.freeze({
  autoCreate: false,
  autoIndex: false,
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 3,
});

export class WriterPrivilegeError extends Error {
  constructor(message) {
    super(message);
    this.name = "WriterPrivilegeError";
  }
}

// connectionStatus (showPrivileges) result -> throws unless the privileges
// are exactly within the FAQ edit scope.
export function assertWriterPrivileges(status, dbName = WRITER_DATABASE_NAME) {
  const privileges = status?.authInfo?.authenticatedUserPrivileges;
  if (!Array.isArray(privileges) || privileges.length === 0) throw new WriterPrivilegeError("Writer user has no verifiable privileges.");
  const granted = {};
  for (const privilege of privileges) {
    const resource = privilege?.resource ?? {};
    const actions = Array.isArray(privilege?.actions) ? privilege.actions : [];
    if (resource.db !== dbName || !Object.hasOwn(ALLOWED_PRIVILEGES, resource.collection ?? "")) {
      throw new WriterPrivilegeError("Writer user has privileges outside the FAQ edit scope.");
    }
    const extra = actions.filter((action) => !ALLOWED_PRIVILEGES[resource.collection].includes(action));
    if (extra.length) throw new WriterPrivilegeError("Writer user has actions outside the FAQ edit scope.");
    granted[resource.collection] ??= new Set();
    for (const action of actions) granted[resource.collection].add(action);
  }
  for (const [collection, actions] of Object.entries(REQUIRED_PRIVILEGES)) {
    if (!actions.every((action) => granted[collection]?.has(action))) throw new WriterPrivilegeError("Writer user lacks the FAQ edit privileges.");
  }
}

// The transactional store used by the FAQ editor. tx operations are bound to
// one session; anything thrown inside `work` aborts the whole transaction.
export function createFaqStore(connection) {
  const faqs = connection.db.collection(FAQ_COLLECTION);
  const audit = connection.db.collection(AUDIT_COLLECTION);
  const toId = (id) => new mongoose.Types.ObjectId(id);
  return Object.freeze({
    async withFaqTransaction(work) {
      const session = connection.getClient().startSession();
      try {
        let result;
        await session.withTransaction(
          async () => {
            result = await work({
              findFaq: (id) => faqs.findOne({ _id: toId(id) }, { session, projection: { question: 1, answer: 1, status: 1, "review.status": 1, __v: 1, "placeholderFields.path": 1, "placeholderFields.status": 1 } }),
              updateFaq: (filter, update) => faqs.updateOne({ ...filter, _id: toId(filter._id) }, update, { session }),
              insertAudit: (entry) => audit.insertOne({ ...entry, recordId: toId(entry.recordId) }, { session }),
            });
          },
          { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
        );
        return result;
      } finally {
        await session.endSession();
      }
    },
  });
}

const cache = (globalThis.__sanpudamWriterMongo ??= { promise: null, key: null, connection: null });

export function writerConfigKey(config) {
  return createHash("sha256").update(JSON.stringify([config.uri, config.dbName, config.dnsServers ?? null])).digest("hex");
}

// config: readWriterConfig() result. Returns { store } once every check passed.
export function connectWriterDatabase(config, { mongooseInstance = mongoose, dnsModule = dns } = {}) {
  if (!config?.uri || config.dbName !== WRITER_DATABASE_NAME) return Promise.reject(new Error("CMS writer database is not configured."));
  const key = writerConfigKey(config);
  if (cache.promise && cache.key !== key) {
    cache.connection?.close().catch(() => {});
    cache.promise = null;
    cache.connection = null;
  }
  if (!cache.promise) {
    if (config.dnsServers?.length) {
      dnsModule.setServers(config.dnsServers);
      dnsModule.promises?.setServers(config.dnsServers);
    }
    const connection = mongooseInstance.createConnection(config.uri, { ...WRITER_CONNECTION_OPTIONS, dbName: config.dbName });
    cache.key = key;
    cache.connection = connection;
    cache.promise = connection
      .asPromise()
      .then(async () => {
        const connected = connection.db?.databaseName;
        if (connected !== WRITER_DATABASE_NAME) throw new Error(`Writer connection opened an unexpected database (${connected}).`);
        assertWriterPrivileges(await connection.db.command({ connectionStatus: 1, showPrivileges: true }));
        const audit = await connection.db.listCollections({ name: AUDIT_COLLECTION }, { nameOnly: true, authorizedCollections: true }).toArray();
        if (!audit.length) throw new Error(`Audit collection ${AUDIT_COLLECTION} does not exist.`);
        return { store: createFaqStore(connection) };
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
export function resetWriterConnectionCache() {
  cache.promise = null;
  cache.key = null;
  cache.connection = null;
}
