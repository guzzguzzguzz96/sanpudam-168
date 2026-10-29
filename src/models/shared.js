// Shared Mongoose building blocks (docs/mongodb-schema-spec.md §2).
// Relative imports only, so these files load both in Next.js and in the
// plain Node migration scripts.
import mongoose from "mongoose";

const { Schema } = mongoose;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const FocalPointSchema = new Schema(
  { x: { type: Number, min: 0, max: 1, required: true }, y: { type: Number, min: 0, max: 1, required: true } },
  { _id: false },
);

// Image used inside content. alt/caption/focal point are usage-level values.
export const ImageRefSchema = new Schema(
  {
    assetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    alt: { type: String, trim: true, maxlength: 250, default: "" },
    caption: { type: String, trim: true, maxlength: 120, default: null },
    focalPoint: { type: FocalPointSchema, default: null },
    mediaMapping: {
      status: { type: String, enum: ["resolved", "pending", "missing"], default: "resolved" },
      manifestId: { type: String, default: null },
      legacyUrl: { type: String, default: null },
      legacyMobileUrl: { type: String, default: null },
      legacyWidth: { type: Number, default: null },
      legacyHeight: { type: Number, default: null },
      note: { type: String, default: null },
    },
  },
  { _id: false },
);

export const SeoSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 60, default: null },
    description: { type: String, trim: true, maxlength: 155, default: null },
  },
  { _id: false },
);

// Field-level placeholder flags from the legacy /placeholders page.
export const PlaceholderFieldSchema = new Schema(
  {
    path: { type: String, required: true },
    status: { type: String, enum: ["placeholder", "confirmed_correct", "replaced"], required: true },
    source: { type: String, enum: ["legacy", "public_text_marker", "new_cms"], required: true },
    legacyPath: { type: String, default: null },
    note: { type: String, maxlength: 300, default: null },
    flaggedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

export const LegacySchema = new Schema(
  {
    system: { type: String, default: "sanpudam168-workers" },
    module: { type: String, required: true },
    id: { type: String, default: null },
    key: { type: String, required: true },
    keyStrength: { type: String, enum: ["id", "slug", "singleton", "hash"], required: true },
    isPublished: { type: Boolean, default: null },
    isPlaceholder: { type: Boolean, default: null },
    sortOrder: { type: Number, default: null },
    createdAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
    checksum: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
    sourceType: { type: String, enum: ["admin_ui_capture", "export", "manual_transcription", "public_site"], required: true },
    sourceUrl: { type: String, default: null },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

export const MigrationSchema = new Schema(
  {
    runId: { type: String, default: null },
    preparedAt: { type: Date, default: null },
    importedAt: { type: Date, default: null },
    // Checksum of the document as imported; a different value later means
    // the record was edited in the new CMS and must never be overwritten.
    importChecksum: { type: String, default: null },
    // Checksum of the planned source record; a different value on a later
    // run means the legacy source changed.
    sourceChecksum: { type: String, default: null },
    editedAfterImport: { type: Boolean, default: false },
  },
  { _id: false },
);

export const ReviewStateSchema = new Schema(
  {
    status: { type: String, enum: ["pending_review", "approved", "changes_requested"], default: "pending_review" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    note: { type: String, maxlength: 500, default: null },
  },
  { _id: false },
);

export const ConsentSchema = new Schema(
  {
    status: { type: String, enum: ["not_required", "pending", "obtained", "refused"], default: "pending" },
    recordedAt: { type: Date, default: null },
    note: { type: String, maxlength: 300, default: null },
  },
  { _id: false },
);

// Common fields of every content document. A fresh object each call.
export function contentFields() {
  return {
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
    review: { type: ReviewStateSchema, default: () => ({}) },
    placeholderFields: { type: [PlaceholderFieldSchema], default: [] },
    legacy: { type: LegacySchema, default: null },
    migration: { type: MigrationSchema, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  };
}

// autoCreate/autoIndex are off: collections and indexes are created only by
// an explicit, approved createIndexes() step, never as a side effect of connecting.
export const schemaOptions = (collection) => ({ collection, timestamps: true, optimisticConcurrency: true, autoCreate: false, autoIndex: false });

// Indexes shared by every collection that receives migrated records.
export function addMigrationIndexes(schema) {
  schema.index({ "legacy.key": 1 }, { unique: true, partialFilterExpression: { "legacy.key": { $type: "string" } } });
  schema.index({ "legacy.module": 1, "legacy.id": 1 }, { unique: true, partialFilterExpression: { "legacy.id": { $type: "string" } } });
}

export function addContentIndexes(schema) {
  addMigrationIndexes(schema);
  schema.index({ "placeholderFields.status": 1 });
  schema.index({ "review.status": 1, status: 1 });
}

// Collects every ImageRef-shaped value in a plain object.
export function collectImageRefs(value, path = "", out = []) {
  if (Array.isArray(value)) value.forEach((item, index) => collectImageRefs(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object" && !(value instanceof Date) && !mongoose.isObjectIdOrHexString(value)) {
    if ("mediaMapping" in value && "alt" in value) out.push({ path, ref: value });
    else for (const [key, inner] of Object.entries(value)) collectImageRefs(inner, path ? `${path}.${key}` : key, out);
  }
  return out;
}

// Publish validation (spec §6). Draft records may be incomplete; a record
// can only be saved as "published" when every rule below passes.
export function publishIssues(doc, extraRules = () => []) {
  const plain = typeof doc.toObject === "function" ? doc.toObject({ depopulate: true }) : doc;
  const issues = [];
  if (plain.review?.status !== "approved") issues.push("review.status must be approved");
  const open = (plain.placeholderFields ?? []).filter((p) => p.status === "placeholder");
  if (open.length) issues.push(`placeholder fields still open: ${open.map((p) => p.path).join(", ")}`);
  for (const { path, ref } of collectImageRefs(plain)) {
    if (!ref.assetId || ref.mediaMapping?.status !== "resolved") issues.push(`${path} media is not resolved`);
  }
  return [...issues, ...extraRules(plain)];
}

export function enforcePublishRules(schema, extraRules) {
  schema.pre("validate", function checkPublish() {
    if (this.status !== "published") return;
    const issues = publishIssues(this, extraRules);
    if (issues.length) this.invalidate("status", `Cannot publish: ${issues.join("; ")}`);
  });
}

// Reuses a compiled model during Next.js hot reload.
export function defineModel(name, schema) {
  return mongoose.models[name] ?? mongoose.model(name, schema);
}
