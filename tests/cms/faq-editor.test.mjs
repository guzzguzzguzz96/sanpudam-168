// FAQ edit form: owner-only access, field allowlist and validation, version
// checks, unchanged submissions, audit entries, rollback, and the staging
// writer's configuration and privilege checks.
//
// Offline and isolated: an in-memory transactional store applies staged
// writes only on commit and discards them when anything throws (MongoDB
// transaction semantics). The real MongoDB transaction engine is not
// exercised here.
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getAdminAccess } from "../../src/server/auth/admin-access.js";
import { FAQ_LIMITS, evaluateWriterReadiness, loadFaqForEdit, parseFaqSubmission, saveFaqEdit } from "../../src/server/admin/faq-editor.js";
import { readWriterConfig } from "../../src/server/cms-writer/config.js";
import { AUDIT_COLLECTION, WriterPrivilegeError, assertWriterPrivileges, connectWriterDatabase, createFaqStore, resetWriterConnectionCache } from "../../src/server/cms-writer/connection.js";
import { SECRET_URI } from "./fixtures.mjs";

const AUTH = {
  AUTH_SECRET: "test-only-secret-0123456789abcdefghijklmnop",
  AUTH_URL: "http://localhost:3000",
  AUTH_GOOGLE_ID: "test-client-id.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "test-client-secret",
  ADMIN_ALLOWED_ACCOUNTS: "owner@example.test:owner,editor@example.test:editor",
};
const WRITER = { CMS_WRITER_MONGODB_URI: SECRET_URI, CMS_WRITER_MONGODB_DB_NAME: "sanpudam168_staging" };
const READER = { CLIENT_REVIEW_MONGODB_URI: SECRET_URI, CLIENT_REVIEW_MONGODB_DB_NAME: "sanpudam168_staging" };
const NOW = Date.UTC(2026, 10, 12, 9, 0, 0);
const AT = new Date(NOW + 5000);
const silent = { error() {} };
const oid = (n) => n.toString(16).padStart(24, "0");
const FAQ_ID = oid(41);
const FLAGGED_ID = oid(42);

async function principalFor(email) {
  const session = { user: { name: "Test", email }, identity: { provider: "google", subject: email.startsWith("owner") ? "1000001" : "1000002", email, authTime: Math.floor(NOW / 1000) - 60 } };
  return (await getAdminAccess({ env: AUTH, readSession: async () => session, now: NOW, waitForRequest: async () => {} })).principal;
}

const faq = (fields) => ({
  status: "draft",
  review: { status: "pending_review", note: null },
  showOnHome: true,
  sortOrder: 1,
  placeholderFields: [],
  __v: 0,
  updatedAt: new Date("2026-10-20T00:00:00Z"),
  legacy: { key: "legacy-key" },
  ...fields,
});

function seed() {
  return [
    faq({ _id: FAQ_ID, question: "ศาลเปิดกี่โมง", answer: "เปิดทุกวัน 08:00 – 20:00 น." }),
    faq({ _id: FLAGGED_ID, question: "ต้องเตรียมอะไรไปไหว้", answer: "คำตอบตัวอย่าง", showOnHome: false, sortOrder: 4, placeholderFields: [{ path: "answer", status: "placeholder", source: "legacy", note: "รอเจ้าของยืนยัน", flaggedAt: new Date("2026-10-17T00:00:00Z") }] }),
    faq({ _id: oid(43), question: "เผยแพร่แล้ว", answer: "คำตอบ", status: "published", review: { status: "approved" } }),
    faq({ _id: oid(44), question: "อนุมัติแล้ว", answer: "คำตอบ", review: { status: "approved" } }),
    faq({ _id: oid(45), question: "ไม่มีเวอร์ชัน", answer: "คำตอบ", __v: undefined }),
  ];
}

const get = (doc, path) => path.split(".").reduce((value, key) => value?.[key], doc);
function setPath(doc, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((value, key) => (value[key] ??= {}), doc);
  target[last] = value;
}

// In-memory store with MongoDB transaction semantics: reads and writes go to
// a staged copy; on commit only the documents this transaction modified and
// its new audit entries are applied. Anything thrown discards them.
function createFakeStore(docs = seed(), { failAudit = false, beforeUpdate } = {}) {
  const data = { faqs: new Map(docs.map((doc) => [doc._id, structuredClone(doc)])), audit: [] };
  const stats = { transactions: 0, commits: 0, aborts: 0, updates: [] };
  const store = {
    async withFaqTransaction(work) {
      stats.transactions++;
      const staged = { faqs: new Map([...data.faqs].map(([id, doc]) => [id, structuredClone(doc)])), audit: [], touched: new Set() };
      try {
        const result = await work({
          findFaq: async (id) => structuredClone(staged.faqs.get(id) ?? null),
          updateFaq: async (filter, update) => {
            await beforeUpdate?.(data);
            stats.updates.push({ filter, update });
            // A concurrent commit since this transaction started is a conflict.
            const committed = data.faqs.get(filter._id);
            const doc = staged.faqs.get(filter._id);
            if (!doc || !committed || committed.__v !== doc.__v) return { matchedCount: 0, modifiedCount: 0 };
            const matches = Object.entries(filter).every(([key, value]) => key === "_id" || get(doc, key) === value);
            if (!matches) return { matchedCount: 0, modifiedCount: 0 };
            for (const [key, value] of Object.entries(update.$set ?? {})) setPath(doc, key, value);
            for (const [key, value] of Object.entries(update.$inc ?? {})) setPath(doc, key, (get(doc, key) ?? 0) + value);
            staged.touched.add(filter._id);
            return { matchedCount: 1, modifiedCount: 1 };
          },
          insertAudit: async (entry) => {
            if (failAudit) throw Object.assign(new Error("Document failed validation"), { name: "MongoServerError" });
            staged.audit.push(structuredClone(entry));
          },
        });
        for (const id of staged.touched) data.faqs.set(id, staged.faqs.get(id));
        data.audit.push(...staged.audit);
        stats.commits++;
        return result;
      } catch (error) {
        stats.aborts++;
        throw error;
      }
    },
  };
  return { store, data, stats };
}

const form = (fields) => Object.entries({ "$ACTION_REF_1": "", "$ACTION_1:0": "{}", version: "0", ...fields });
const editEnv = { ...WRITER, ...READER };

async function save(principal, id, entries, { fake = createFakeStore(), env = editEnv, logger = silent } = {}) {
  let connects = 0;
  const result = await saveFaqEdit(principal, id, entries, { env, logger, now: () => AT, connect: async () => (connects++, { store: fake.store }) });
  return { result, connects, ...fake };
}

test("save: an owner edit updates only the question/answer, bumps the version, and writes one audit entry", async () => {
  const owner = await principalFor("owner@example.test");
  const { result, data, stats } = await save(owner, FAQ_ID, form({ question: "ศาลเปิดกี่โมง", answer: "เปิดทุกวัน 07:00 – 20:00 น." }));
  assert.deepEqual(result, { status: "saved", changed: ["answer"], openFlagFields: [] });
  assert.equal(stats.commits, 1);
  const saved = data.faqs.get(FAQ_ID);
  const before = seed()[0];
  assert.equal(saved.answer, "เปิดทุกวัน 07:00 – 20:00 น.");
  assert.equal(saved.question, before.question);
  assert.equal(saved.__v, 1);
  assert.deepEqual(saved.updatedAt, AT);
  for (const field of ["status", "review", "showOnHome", "sortOrder", "placeholderFields", "legacy"]) assert.deepEqual(saved[field], before[field], field);

  assert.equal(data.audit.length, 1);
  assert.deepEqual(data.audit[0], {
    at: AT,
    action: "faq.update",
    collection: "faqs",
    recordId: FAQ_ID,
    actor: { provider: "google", subject: "1000001", email: "owner@example.test", role: "owner" },
    changes: { answer: { before: "เปิดทุกวัน 08:00 – 20:00 น.", after: "เปิดทุกวัน 07:00 – 20:00 น." } },
    version: { before: 0, after: 1 },
  });
  // The guarded update: exact id, stored version, still draft / pending_review.
  assert.deepEqual(stats.updates[0].filter, { _id: FAQ_ID, __v: 0, status: "draft", "review.status": "pending_review" });
  assert.deepEqual(Object.keys(stats.updates[0].update.$set).sort(), ["answer", "updatedAt"]);
  assert.deepEqual(stats.updates[0].update.$inc, { __v: 1 });
});

test("save: an edited field that keeps an open placeholder flag is reported", async () => {
  const owner = await principalFor("owner@example.test");
  const { result, data } = await save(owner, FLAGGED_ID, form({ question: "ต้องเตรียมอะไรไปไหว้", answer: "ดอกไม้ ธูป เทียน" }));
  assert.deepEqual(result, { status: "saved", changed: ["answer"], openFlagFields: ["answer"] });
  assert.deepEqual(data.faqs.get(FLAGGED_ID).placeholderFields, seed()[1].placeholderFields, "flags stay as stored");
});

test("save: an unchanged submission writes nothing and records no audit entry", async () => {
  const owner = await principalFor("owner@example.test");
  for (const entries of [form({ question: "ศาลเปิดกี่โมง", answer: "เปิดทุกวัน 08:00 – 20:00 น." }), form({ question: "  ศาลเปิดกี่โมง  ", answer: "เปิดทุกวัน 08:00 – 20:00 น.\r\n" })]) {
    const { result, data, stats } = await save(owner, FAQ_ID, entries);
    assert.deepEqual(result, { status: "unchanged" });
    assert.equal(data.audit.length, 0);
    assert.equal(stats.updates.length, 0);
    assert.equal(data.faqs.get(FAQ_ID).__v, 0);
  }
});

test("save: a stale form cannot overwrite a newer edit", async () => {
  const owner = await principalFor("owner@example.test");
  const fake = createFakeStore();
  assert.equal((await save(owner, FAQ_ID, form({ question: "ศาลเปิดกี่โมง", answer: "แก้ครั้งที่หนึ่ง" }), { fake })).result.status, "saved");
  // A second form opened at version 0 is now stale.
  const stale = await save(owner, FAQ_ID, form({ question: "ศาลเปิดกี่โมง", answer: "แก้จากฟอร์มเก่า" }), { fake });
  assert.deepEqual(stale.result, { status: "error", code: "stale" });
  assert.equal(fake.data.faqs.get(FAQ_ID).answer, "แก้ครั้งที่หนึ่ง");
  assert.equal(fake.data.faqs.get(FAQ_ID).__v, 1);
  assert.equal(fake.data.audit.length, 1);
  // A newer version than stored is stale too.
  assert.equal((await save(owner, FAQ_ID, form({ version: "7", question: "x", answer: "y" }), { fake })).result.code, "stale");
});

test("save: a concurrent commit during the transaction makes the guarded update match nothing", async () => {
  const owner = await principalFor("owner@example.test");
  const fake = createFakeStore(seed(), {
    beforeUpdate: async (data) => {
      const doc = data.faqs.get(FAQ_ID);
      if (doc.__v === 0) data.faqs.set(FAQ_ID, { ...doc, answer: "แก้โดยอีกคน", __v: 1 });
    },
  });
  const { result } = await save(owner, FAQ_ID, form({ question: "ศาลเปิดกี่โมง", answer: "ของฉัน" }), { fake });
  assert.deepEqual(result, { status: "error", code: "stale" });
  assert.equal(fake.data.faqs.get(FAQ_ID).answer, "แก้โดยอีกคน");
  assert.equal(fake.data.audit.length, 0);
});

test("save: if the audit entry fails, the FAQ change is rolled back", async () => {
  const owner = await principalFor("owner@example.test");
  const logs = [];
  const fake = createFakeStore(seed(), { failAudit: true });
  const { result, data, stats } = await save(owner, FAQ_ID, form({ question: "ศาลเปิดกี่โมง", answer: "ไม่ควรถูกบันทึก" }), { fake, logger: { error: (line) => logs.push(line) } });
  assert.deepEqual(result, { status: "error", code: "failed" });
  assert.equal(stats.updates.length, 1, "the update ran inside the transaction");
  assert.equal(stats.aborts, 1);
  assert.equal(stats.commits, 0);
  assert.deepEqual(data.faqs.get(FAQ_ID), seed()[0], "the stored FAQ is unchanged");
  assert.equal(data.audit.length, 0);
  assert.match(logs[0], /nothing saved/);
});

test("access: only an issued owner principal can save; nothing else is read or written", async () => {
  const editor = await principalFor("editor@example.test");
  const forged = [editor, null, undefined, {}, { subject: "1000001", email: "owner@example.test", role: "owner" }];
  for (const principal of forged) {
    const { result, connects, data } = await save(principal, FAQ_ID, form({ question: "q", answer: "a" }));
    assert.deepEqual(result, { status: "error", code: "forbidden" });
    assert.equal(connects, 0);
    assert.equal(data.audit.length, 0);
  }
  const loaded = await loadFaqForEdit(editor, FAQ_ID, { env: editEnv, connect: async () => assert.fail("no read for editors"), logger: silent });
  assert.deepEqual(loaded, { status: "forbidden" });
});

test("input: unexpected, repeated, missing, or non-text fields are rejected before any connection", async () => {
  const owner = await principalFor("owner@example.test");
  const valid = { question: "ศาลเปิดกี่โมง", answer: "เปิดทุกวัน" };
  const cases = [
    form({ ...valid, status: "published" }),
    form({ ...valid, showOnHome: "false" }),
    form({ ...valid, sortOrder: "1" }),
    form({ ...valid, __v: "9" }),
    form({ ...valid, placeholderFields: "[]" }),
    form({ ...valid, "review.status": "approved" }),
    [...form(valid), ["question", "อีกคำถาม"]],
    form({ question: valid.question }),
    Object.entries({ question: "q", answer: "a" }),
    form({ ...valid, version: "abc" }),
    form({ ...valid, version: "-1" }),
    form({ ...valid, version: "1.5" }),
    form({ ...valid, question: { $ne: null } }),
    [...form({ answer: valid.answer }), ["question", new Blob(["x"])]],
    "question=x",
    null,
  ];
  for (const entries of cases) {
    const { result, connects } = await save(owner, FAQ_ID, entries);
    assert.equal(result.code, "invalid_request", JSON.stringify(entries).slice(0, 80));
    assert.equal(connects, 0);
  }
  for (const id of ["s1", FAQ_ID.toUpperCase().replace(/0/g, "A"), `${FAQ_ID}0`, "", null, { $ne: null }]) {
    const { result, connects } = await save(owner, id, form(valid));
    assert.deepEqual(result, { status: "error", code: "not_found" }, String(id));
    assert.equal(connects, 0);
  }
});

test("input: field validation follows the FAQ schema limits", async () => {
  assert.deepEqual(FAQ_LIMITS, { question: 140, answer: 800 });
  const owner = await principalFor("owner@example.test");
  const cases = [
    [{ question: "", answer: "a" }, { question: "required" }],
    [{ question: "   \n ", answer: "a" }, { question: "required" }],
    [{ question: "q".repeat(141), answer: "a" }, { question: "too_long" }],
    [{ question: "q", answer: "a".repeat(801) }, { answer: "too_long" }],
    [{ question: "q", answer: "a".repeat(20000) }, { answer: "too_long" }],
    [{ question: "two\nlines", answer: "a" }, { question: "single_line" }],
    [{ question: "q\u0007", answer: "a\u0000b" }, { question: "invalid_characters", answer: "invalid_characters" }],
  ];
  for (const [fields, fieldErrors] of cases) {
    const { result, connects } = await save(owner, FAQ_ID, form(fields));
    assert.equal(result.code, "validation");
    assert.deepEqual(result.fieldErrors, fieldErrors);
    assert.equal(connects, 0);
  }
  // Limits are inclusive; CRLF becomes LF; answers may span lines.
  const ok = parseFaqSubmission(form({ question: "q".repeat(140), answer: `บรรทัดหนึ่ง\r\nบรรทัดสอง${"a".repeat(700)}` }));
  assert.equal(ok.ok, true);
  assert.equal(ok.values.answer.includes("\r"), false);
  assert.equal(ok.version, 0);
});

test("eligibility: only draft / pending_review FAQs with a version can be saved", async () => {
  const owner = await principalFor("owner@example.test");
  for (const id of [oid(43), oid(44), oid(45)]) {
    const { result, data } = await save(owner, id, form({ question: "ใหม่", answer: "ใหม่" }));
    assert.deepEqual(result, { status: "error", code: "not_eligible" }, id);
    assert.equal(data.audit.length, 0);
  }
  assert.deepEqual((await save(owner, oid(99), form({ question: "q", answer: "a" }))).result, { status: "error", code: "not_found" });
});

test("configuration: Production, other hosts, and a missing or wrong writer fail closed", async () => {
  const owner = await principalFor("owner@example.test");
  const entries = form({ question: "ใหม่", answer: "ใหม่" });
  for (const env of [{ ...WRITER, VERCEL: "1", VERCEL_ENV: "production" }, { ...WRITER, VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" }, {}, { ...WRITER, CMS_WRITER_MONGODB_DB_NAME: "sanpudam168_production" }, { CMS_WRITER_MONGODB_URI: "https://x", CMS_WRITER_MONGODB_DB_NAME: "sanpudam168_staging" }, READER]) {
    const { result, connects } = await save(owner, FAQ_ID, entries, { env });
    assert.deepEqual(result, { status: "error", code: "unavailable" }, JSON.stringify(Object.keys(env)));
    assert.equal(connects, 0, "the review reader is never used as a writer");
  }
  const logs = [];
  const refused = await saveFaqEdit(owner, FAQ_ID, entries, { env: editEnv, now: () => AT, logger: { error: (line) => logs.push(line) }, connect: async () => { throw new WriterPrivilegeError("Writer user has privileges outside the FAQ edit scope."); } });
  assert.deepEqual(refused, { status: "error", code: "unavailable" });
  assert.match(logs[0], /outside the FAQ edit scope/);
  for (const line of logs) assert.ok(!line.includes("pa55-w0rd"));

  assert.deepEqual(evaluateWriterReadiness(editEnv), { ready: true, reason: null });
  assert.deepEqual(evaluateWriterReadiness(READER), { ready: false, reason: "not_configured" });
  assert.deepEqual(evaluateWriterReadiness({ ...WRITER, VERCEL: "1", VERCEL_ENV: "production" }), { ready: false, reason: "environment" });
});

test("writer config: dedicated variables, exact staging database, optional IPv4 DNS", () => {
  assert.deepEqual(readWriterConfig(WRITER), { uri: SECRET_URI, dbName: "sanpudam168_staging", dnsServers: null, problems: [] });
  assert.deepEqual(readWriterConfig({ ...WRITER, CMS_WRITER_DNS_SERVERS: "8.8.8.8, 1.1.1.1" }).dnsServers, ["8.8.8.8", "1.1.1.1"]);
  const problems = (env) => readWriterConfig(env).problems;
  assert.deepEqual(problems({}), ["CMS_WRITER_MONGODB_URI is not set", "CMS_WRITER_MONGODB_DB_NAME is not set"]);
  assert.deepEqual(problems({ ...READER, MONGODB_URI: SECRET_URI, MONGODB_DB_NAME: "sanpudam168_staging" }).length, 2, "never falls back to other accounts");
  assert.deepEqual(problems({ ...WRITER, CMS_WRITER_MONGODB_DB_NAME: "sanpudam168_staging2" }), ["CMS_WRITER_MONGODB_DB_NAME must be sanpudam168_staging"]);
  assert.deepEqual(problems({ ...WRITER, CMS_WRITER_DNS_SERVERS: "dns.google" }), ["CMS_WRITER_DNS_SERVERS must be comma-separated IPv4 addresses"]);
  const failed = readWriterConfig({ CMS_WRITER_MONGODB_URI: "nope", CMS_WRITER_MONGODB_DB_NAME: "x" });
  assert.equal(failed.uri, null);
  assert.ok(!JSON.stringify(failed).includes("nope"));
});

const privilege = (collection, actions, db = "sanpudam168_staging") => ({ resource: { db, collection }, actions });
const statusWith = (privileges) => ({ authInfo: { authenticatedUserPrivileges: privileges } });
const MINIMAL = [privilege("faqs", ["find", "update"]), privilege(AUDIT_COLLECTION, ["insert"])];

test("privileges: only find/update on faqs and insert (find) on the audit log", () => {
  assert.doesNotThrow(() => assertWriterPrivileges(statusWith(MINIMAL)));
  assert.doesNotThrow(() => assertWriterPrivileges(statusWith([privilege("faqs", ["update"]), privilege("faqs", ["find"]), privilege(AUDIT_COLLECTION, ["insert", "find"])])));
  const refused = {
    none: [],
    missing: undefined,
    noAuditInsert: [privilege("faqs", ["find", "update"])],
    noFaqUpdate: [privilege("faqs", ["find"]), privilege(AUDIT_COLLECTION, ["insert"])],
    removeOnFaqs: [privilege("faqs", ["find", "update", "remove"]), privilege(AUDIT_COLLECTION, ["insert"])],
    updateOnAudit: [...MINIMAL, privilege(AUDIT_COLLECTION, ["update"])],
    otherCollection: [...MINIMAL, privilege("site_settings", ["find", "update"])],
    wholeDatabase: [...MINIMAL, privilege("", ["find", "insert", "update"])],
    otherDatabase: [...MINIMAL, privilege("faqs", ["find"], "sanpudam168_production")],
    anyResource: [...MINIMAL, { resource: { anyResource: true }, actions: ["anyAction"] }],
    cluster: [...MINIMAL, { resource: { cluster: true }, actions: ["listDatabases"] }],
    readWriteBuiltIn: [privilege("", ["find", "insert", "remove", "update", "createCollection", "dropCollection", "createIndex"])],
    createCollection: [...MINIMAL, privilege(AUDIT_COLLECTION, ["createCollection"])],
  };
  for (const [name, privileges] of Object.entries(refused)) {
    assert.throws(() => assertWriterPrivileges(statusWith(privileges)), WriterPrivilegeError, name);
  }
});

// Fake mongoose for the writer connection checks.
function fakeWriterMongoose({ databaseName = "sanpudam168_staging", privileges = MINIMAL, auditExists = true } = {}) {
  const calls = { createConnection: [], commands: [], closed: 0, sessions: [] };
  return {
    calls,
    createConnection(uri, options) {
      calls.createConnection.push({ uri, options });
      const connection = {
        db: {
          databaseName,
          command: async (command) => (calls.commands.push(command), statusWith(privileges)),
          listCollections: () => ({ toArray: async () => (auditExists ? [{ name: AUDIT_COLLECTION }] : []) }),
          collection: (name) => ({ name }),
        },
        asPromise: async () => connection,
        close: async () => void calls.closed++,
        getClient: () => ({ startSession: () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }) }),
      };
      return connection;
    },
  };
}

test("writer connection: exact database, verified privileges, existing audit log; reused per configuration", async () => {
  const config = readWriterConfig(WRITER);
  resetWriterConnectionCache();
  const fake = fakeWriterMongoose();
  const first = await connectWriterDatabase(config, { mongooseInstance: fake });
  assert.equal(typeof first.store.withFaqTransaction, "function");
  assert.deepEqual(fake.calls.commands[0], { connectionStatus: 1, showPrivileges: true });
  assert.equal(fake.calls.createConnection[0].options.dbName, "sanpudam168_staging");
  assert.equal(fake.calls.createConnection[0].options.autoCreate, false);
  assert.equal(await connectWriterDatabase({ ...config }, { mongooseInstance: fake }), first);
  assert.equal(fake.calls.createConnection.length, 1);
  resetWriterConnectionCache();

  const failures = [
    [fakeWriterMongoose({ databaseName: "sanpudam168_production" }), /unexpected database/],
    [fakeWriterMongoose({ privileges: [privilege("", ["find", "insert", "update", "remove"])] }), /outside the FAQ edit scope/],
    [fakeWriterMongoose({ auditExists: false }), /admin_audit_log does not exist/],
  ];
  for (const [mongooseInstance, message] of failures) {
    resetWriterConnectionCache();
    await assert.rejects(connectWriterDatabase(config, { mongooseInstance }), (error) => {
      assert.match(error.message, message);
      assert.ok(!error.message.includes("pa55-w0rd"));
      return true;
    });
    assert.equal(mongooseInstance.calls.closed, 1, "a refused connection is closed");
  }
  resetWriterConnectionCache();
  await assert.rejects(connectWriterDatabase(readWriterConfig(READER)), /not configured/);
});

test("writer store: every operation runs in one session with snapshot reads and majority writes", async () => {
  const seen = [];
  const session = { id: "session-1" };
  let options;
  const collection = (name) => ({
    findOne: async (filter, opts) => (seen.push({ name, op: "findOne", filter, opts }), null),
    updateOne: async (filter, update, opts) => (seen.push({ name, op: "updateOne", filter, update, opts }), { matchedCount: 1, modifiedCount: 1 }),
    insertOne: async (doc, opts) => (seen.push({ name, op: "insertOne", doc, opts }), { acknowledged: true }),
  });
  let ended = false;
  const connection = {
    db: { collection },
    getClient: () => ({ startSession: () => ({ ...session, withTransaction: async (fn, opts) => ((options = opts), fn()), endSession: async () => void (ended = true) }) }),
  };
  const store = createFaqStore(connection);
  await store.withFaqTransaction(async (tx) => {
    await tx.findFaq(FAQ_ID);
    await tx.updateFaq({ _id: FAQ_ID, __v: 0 }, { $set: { answer: "x" } });
    await tx.insertAudit({ recordId: FAQ_ID, action: "faq.update" });
  });
  assert.deepEqual(options, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  assert.ok(ended, "the session is always ended");
  assert.deepEqual(seen.map((entry) => `${entry.name}.${entry.op}`), ["faqs.findOne", "faqs.updateOne", `${AUDIT_COLLECTION}.insertOne`]);
  for (const entry of seen) assert.equal(entry.opts.session.id, "session-1");
  assert.ok(seen[0].filter._id instanceof mongoose.Types.ObjectId);
  assert.ok(seen[1].filter._id instanceof mongoose.Types.ObjectId);
  assert.ok(seen[2].doc.recordId instanceof mongoose.Types.ObjectId);
  assert.deepEqual(Object.keys(seen[0].opts.projection).sort(), ["__v", "answer", "placeholderFields.path", "placeholderFields.status", "question", "review.status", "status"]);
});

test("form load: read-only reader, owner only, version and open flags", async () => {
  const owner = await principalFor("owner@example.test");
  const docs = seed();
  const readerModels = { Faq: { findOne: (filter) => ({ exec: async () => structuredClone(docs.find((doc) => doc._id === filter._id) ?? null) }) } };
  const connect = async () => ({ models: readerModels });
  const loaded = await loadFaqForEdit(owner, FLAGGED_ID, { env: editEnv, connect, logger: silent });
  assert.equal(loaded.status, "ok");
  assert.deepEqual(loaded.faq, { id: FLAGGED_ID, question: "ต้องเตรียมอะไรไปไหว้", answer: "คำตอบตัวอย่าง", version: "0", openFlags: [{ field: "answer", label: "คำตอบ", note: "รอเจ้าของยืนยัน" }] });
  assert.equal((await loadFaqForEdit(owner, oid(43), { env: editEnv, connect, logger: silent })).status, "not_eligible");
  assert.equal((await loadFaqForEdit(owner, oid(45), { env: editEnv, connect, logger: silent })).status, "not_eligible");
  assert.equal((await loadFaqForEdit(owner, oid(99), { env: editEnv, connect, logger: silent })).status, "not_found");
  assert.equal((await loadFaqForEdit(owner, "bad", { env: editEnv, connect: async () => assert.fail("no read"), logger: silent })).status, "not_found");
  assert.deepEqual(await loadFaqForEdit(owner, FAQ_ID, { env: { ...READER, VERCEL: "1", VERCEL_ENV: "production" }, connect: async () => assert.fail("no read"), logger: silent }), { status: "unavailable", reason: "environment" });
});
