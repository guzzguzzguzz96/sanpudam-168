// Read-only access to the staging database for the preflight.
//
// Uses the MongoDB driver bundled with Mongoose directly (no Mongoose
// models, so no autoCreate/autoIndex side effects). Only read operations are
// exposed, and every command the driver actually sends is checked against an
// allowlist; anything else is recorded as a violation and fails the run.
import mongoose from "mongoose";

const { MongoClient, ObjectId } = mongoose.mongo;

// Handshake, authentication, and read commands. No write or DDL commands.
export const READ_ONLY_COMMANDS = new Set([
  "hello", "isMaster", "ismaster", "saslStart", "saslContinue", "ping", "buildInfo",
  "connectionStatus", "listCollections", "listIndexes", "count", "aggregate",
  "find", "getMore", "killCursors", "endSessions", "dbStats", "collStats",
]);

const isNamespaceMissing = (error) => error?.code === 26 || /ns does not exist|NamespaceNotFound/i.test(String(error?.message));

export async function openReadOnlyDatabase(uri, dbName, { MongoClientImpl = MongoClient } = {}) {
  const client = new MongoClientImpl(uri, {
    monitorCommands: true,
    retryWrites: false,
    appName: "sanpudam168-preflight",
    serverSelectionTimeoutMS: 15000,
  });
  const observed = [];
  const violations = [];
  client.on("commandStarted", (event) => {
    observed.push(event.commandName);
    // aggregate is allowed only without write stages.
    const writeStage = event.commandName === "aggregate" && (event.command?.pipeline ?? []).some((stage) => "$out" in stage || "$merge" in stage);
    if (!READ_ONLY_COMMANDS.has(event.commandName) || writeStage) violations.push(event.commandName);
  });
  await client.connect();
  const db = client.db(dbName);

  const api = {
    databaseName: db.databaseName,
    async connectionStatus() {
      const status = await db.command({ connectionStatus: 1, showPrivileges: true });
      const info = status.authInfo ?? {};
      return {
        users: (info.authenticatedUsers ?? []).map((u) => ({ db: u.db })), // no user names
        roles: (info.authenticatedUserRoles ?? []).map((r) => ({ role: r.role, db: r.db })),
        privilegeResources: [...new Set((info.authenticatedUserPrivileges ?? []).map((p) => {
          const resource = p.resource ?? {};
          if (resource.cluster) return "cluster";
          if (resource.anyResource) return "anyResource";
          return `${resource.db === "" ? "*" : resource.db}.${resource.collection === "" ? "*" : resource.collection}`;
        }))],
        privilegeActions: [...new Set((info.authenticatedUserPrivileges ?? []).flatMap((p) => p.actions ?? []))].sort(),
      };
    },
    async listCollections() {
      return db.listCollections({}, { nameOnly: false }).toArray();
    },
    async countDocuments(collection, filter = {}) {
      return db.collection(collection).countDocuments(filter);
    },
    async indexes(collection) {
      try {
        return await db.collection(collection).indexes();
      } catch (error) {
        if (isNamespaceMissing(error)) return [];
        throw error;
      }
    },
    async find(collection, filter = {}, { limit = 500 } = {}) {
      return db.collection(collection).find(filter).limit(limit).toArray();
    },
    async findOne(collection, filter) {
      return db.collection(collection).findOne(filter);
    },
    observedCommands: () => [...observed],
    violations: () => [...violations],
    close: () => client.close(),
  };
  return api;
}

// Adapter for applyPlan() in preview mode. Write methods always throw.
export function createReadOnlyAdapter(readOnlyDb) {
  const refuse = () => {
    throw new Error("Read-only preflight: writes are not allowed.");
  };
  return {
    async findById(collection, id) {
      return readOnlyDb.findOne(collection, { _id: ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : id });
    },
    async findOne(collection, filter) {
      return readOnlyDb.findOne(collection, filter);
    },
    insert: refuse,
    replaceIfUnchanged: refuse,
    saveRun: refuse,
  };
}
