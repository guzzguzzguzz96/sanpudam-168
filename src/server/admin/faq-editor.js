import "server-only";
import { Faq } from "../../models/index.js";
import { hasAdminRole } from "../auth/admin-access.js";
import { FAQ_EDIT_ROLES } from "../auth/config.js";
import { readWriterConfig } from "../cms-writer/config.js";
import { connectWriterDatabase } from "../cms-writer/connection.js";
import { readReviewDatabaseConfig } from "../review/config.js";
import { connectReviewDatabase } from "../review/connection.js";
import { evaluateInventoryEnvironment } from "./content-inventory.js";

// The first CMS edit form: an owner edits the question and answer of an
// existing FAQ that is still draft / pending_review. Nothing else changes:
// status, review, showOnHome, sortOrder, and placeholder flags stay as
// stored.
//
// - Loading the form reads through the read-only staging connection.
// - Saving writes only through the dedicated staging writer
//   (cms-writer/connection.js), in one transaction with its audit entry,
//   guarded by the stored version (__v): a stale form cannot overwrite a
//   newer edit, and an unchanged submission writes nothing.
// - Both are available locally and on the dev Preview only (the inventory's
//   environment gate) and fail closed on any missing configuration.

export const FAQ_EDIT_FIELDS = Object.freeze(["question", "answer"]);
export const FAQ_FIELD_LABELS = Object.freeze({ question: "คำถาม", answer: "คำตอบ" });
export const FAQ_EDITABLE_STATE = Object.freeze({ status: "draft", review: "pending_review" });
// From the FAQ schema, so the form and the database agree.
export const FAQ_LIMITS = Object.freeze({
  question: Faq.schema.path("question").options.maxlength,
  answer: Faq.schema.path("answer").options.maxlength,
});

const OBJECT_ID = /^[0-9a-f]{24}$/;
const VERSION = /^\d{1,9}$/;
const MAX_RAW_LENGTH = 10000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ACCEPTED_FIELDS = new Set([...FAQ_EDIT_FIELDS, "version"]);
const QUERY_OPTIONS = Object.freeze({ lean: true, maxTimeMS: 5000 });

export function isFaqEditable(state) {
  return state?.status === FAQ_EDITABLE_STATE.status && state?.review === FAQ_EDITABLE_STATE.review;
}

const openFlagFields = (doc) =>
  (Array.isArray(doc?.placeholderFields) ? doc.placeholderFields : [])
    .filter((flag) => flag?.status === "placeholder" && FAQ_EDIT_FIELDS.includes(flag.path))
    .map((flag) => flag.path);

// Form entries ([name, value] pairs) -> { ok: true, values, version } or
// { ok: false, code: "invalid_request" } or { ok: false, code: "validation", fieldErrors }.
// Next.js adds its own "$ACTION_" entries; they are ignored. Anything else
// outside question/answer/version, a repeated name, or a non-text value is
// rejected as a whole.
export function parseFaqSubmission(entries) {
  if (!Array.isArray(entries)) return { ok: false, code: "invalid_request" };
  const fields = new Map();
  for (const entry of entries) {
    const [name, value] = Array.isArray(entry) ? entry : [];
    if (typeof name !== "string") return { ok: false, code: "invalid_request" };
    if (name.startsWith("$ACTION_")) continue;
    if (!ACCEPTED_FIELDS.has(name) || fields.has(name) || typeof value !== "string") return { ok: false, code: "invalid_request" };
    fields.set(name, value);
  }
  if (![...ACCEPTED_FIELDS].every((name) => fields.has(name))) return { ok: false, code: "invalid_request" };
  const version = fields.get("version");
  if (!VERSION.test(version)) return { ok: false, code: "invalid_request" };

  const values = {};
  const fieldErrors = {};
  for (const field of FAQ_EDIT_FIELDS) {
    const raw = fields.get(field);
    const value = raw.length > MAX_RAW_LENGTH ? raw : raw.replace(/\r\n?/g, "\n").trim();
    values[field] = value;
    if (!value) fieldErrors[field] = "required";
    else if (value.length > FAQ_LIMITS[field]) fieldErrors[field] = "too_long";
    else if (CONTROL_CHARACTERS.test(value)) fieldErrors[field] = "invalid_characters";
    else if (field === "question" && value.includes("\n")) fieldErrors[field] = "single_line";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, code: "validation", fieldErrors, values };
  return { ok: true, values, version: Number(version) };
}

// Writer readiness for the edit page (no connection is opened here).
export function evaluateWriterReadiness(env = process.env) {
  if (!evaluateInventoryEnvironment(env).enabled) return { ready: false, reason: "environment" };
  if (readWriterConfig(env).problems.length) return { ready: false, reason: "not_configured" };
  return { ready: true, reason: null };
}

// Returns { status: "ok", faq } | { status: "forbidden" } | { status: "not_found" }
//   | { status: "not_eligible", faq } | { status: "unavailable", reason }.
export async function loadFaqForEdit(principal, id, { env = process.env, connect = connectReviewDatabase, logger = console } = {}) {
  if (!hasAdminRole(principal, FAQ_EDIT_ROLES)) return { status: "forbidden" };
  if (typeof id !== "string" || !OBJECT_ID.test(id)) return { status: "not_found" };
  const environment = evaluateInventoryEnvironment(env);
  if (!environment.enabled) return { status: "unavailable", reason: "environment" };
  const config = readReviewDatabaseConfig(env);
  if (config.problems.length) {
    logger.error(`[admin-faq] form unavailable: ${config.problems.join("; ")}`);
    return { status: "unavailable", reason: "not_configured" };
  }
  try {
    const { models } = await connect({ ...config, dnsServers: environment.mode === "local" ? config.dnsServers : null });
    const doc = await models.Faq.findOne({ _id: id }, { question: 1, answer: 1, status: 1, "review.status": 1, __v: 1, "placeholderFields.path": 1, "placeholderFields.status": 1, "placeholderFields.note": 1 }, QUERY_OPTIONS).exec();
    if (!doc) return { status: "not_found" };
    const faq = {
      id,
      question: typeof doc.question === "string" ? doc.question : "",
      answer: typeof doc.answer === "string" ? doc.answer : "",
      version: Number.isInteger(doc.__v) ? String(doc.__v) : null,
      openFlags: (Array.isArray(doc.placeholderFields) ? doc.placeholderFields : [])
        .filter((flag) => flag?.status === "placeholder" && FAQ_EDIT_FIELDS.includes(flag.path))
        .map((flag) => ({ field: flag.path, label: FAQ_FIELD_LABELS[flag.path], note: typeof flag.note === "string" ? flag.note : "" })),
    };
    const editable = isFaqEditable({ status: doc.status, review: doc.review?.status }) && faq.version !== null;
    return editable ? { status: "ok", faq } : { status: "not_eligible", faq };
  } catch (error) {
    logger.error(`[admin-faq] form unavailable: ${error?.name ?? "Error"}`);
    return { status: "unavailable", reason: "connection_failed" };
  }
}

// Returns { status: "saved", changed, openFlagFields } | { status: "unchanged" }
//   | { status: "error", code, fieldErrors?, values? } where code is one of
//   forbidden, not_found, invalid_request, validation, unavailable,
//   not_eligible, stale, failed. Nothing is written unless status is "saved".
export async function saveFaqEdit(principal, id, entries, { env = process.env, connect = connectWriterDatabase, now = () => new Date(), logger = console } = {}) {
  if (!hasAdminRole(principal, FAQ_EDIT_ROLES)) return { status: "error", code: "forbidden" };
  if (typeof id !== "string" || !OBJECT_ID.test(id)) return { status: "error", code: "not_found" };
  const submission = parseFaqSubmission(entries);
  if (!submission.ok) return { status: "error", code: submission.code, fieldErrors: submission.fieldErrors, values: submission.values };

  const environment = evaluateInventoryEnvironment(env);
  if (!environment.enabled) return { status: "error", code: "unavailable" };
  const config = readWriterConfig(env);
  if (config.problems.length) {
    logger.error(`[admin-faq] save unavailable: ${config.problems.join("; ")}`);
    return { status: "error", code: "unavailable" };
  }

  let store;
  try {
    ({ store } = await connect({ ...config, dnsServers: environment.mode === "local" ? config.dnsServers : null }));
  } catch (error) {
    logger.error(`[admin-faq] save unavailable: ${error?.name ?? "Error"}: ${error?.message ?? ""}`);
    return { status: "error", code: "unavailable" };
  }

  try {
    return await store.withFaqTransaction(async (tx) => {
      const current = await tx.findFaq(id);
      if (!current) return { status: "error", code: "not_found" };
      if (!isFaqEditable({ status: current.status, review: current.review?.status }) || !Number.isInteger(current.__v)) return { status: "error", code: "not_eligible" };
      if (current.__v !== submission.version) return { status: "error", code: "stale" };

      const changed = FAQ_EDIT_FIELDS.filter((field) => submission.values[field] !== current[field]);
      if (!changed.length) return { status: "unchanged" };

      const at = now();
      const after = Object.fromEntries(changed.map((field) => [field, submission.values[field]]));
      const result = await tx.updateFaq(
        { _id: id, __v: current.__v, status: FAQ_EDITABLE_STATE.status, "review.status": FAQ_EDITABLE_STATE.review },
        { $set: { ...after, updatedAt: at }, $inc: { __v: 1 } },
      );
      if (result?.matchedCount !== 1 || result?.modifiedCount !== 1) return { status: "error", code: "stale" };

      // Same transaction: if this insert fails, the FAQ update is rolled back.
      await tx.insertAudit({
        at,
        action: "faq.update",
        collection: "faqs",
        recordId: id,
        actor: { provider: "google", subject: principal.subject, email: principal.email, role: principal.role },
        changes: Object.fromEntries(changed.map((field) => [field, { before: current[field] ?? null, after: after[field] }])),
        version: { before: current.__v, after: current.__v + 1 },
      });
      return { status: "saved", changed, openFlagFields: openFlagFields(current) };
    });
  } catch (error) {
    logger.error(`[admin-faq] save failed, nothing saved: ${error?.name ?? "Error"}`);
    return { status: "error", code: "failed" };
  }
}
