import mongoose from "mongoose";
import { ConsentSchema, MigrationSchema, defineModel, schemaOptions } from "./shared.js";

const { Schema } = mongoose;

const MediaAssetSchema = new Schema(
  {
    manifestId: { type: String, required: true, unique: true },
    category: {
      type: String,
      required: true,
      enum: ["branding", "shrine-place", "shrine-sacred-object", "surroundings", "sacred-item", "event", "editorial", "shrine-people", "page", "video"],
    },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    cloudinary: {
      assetId: { type: String, required: true },
      publicId: { type: String, required: true, unique: true },
      version: { type: Number, required: true },
      secureUrl: { type: String, required: true, match: /^https:\/\/res\.cloudinary\.com\// },
      type: { type: String, enum: ["upload", "authenticated", "private"], required: true },
      format: { type: String, required: true },
      etag: { type: String, default: null },
    },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true, match: /^(image|video)\// },
    contentHash: {
      sha256: { type: String, required: true, unique: true, match: /^[0-9a-f]{64}$/ },
      md5: { type: String, default: null, match: /^[0-9a-f]{32}$/ },
      dhash: { type: String, default: null },
    },
    defaultAlt: { type: String, maxlength: 250, default: null },
    source: {
      type: { type: String, enum: ["reference-site", "legacy-export", "owner-upload", "cms-upload"], required: true },
      url: { type: String, default: null },
      originalFilename: { type: String, default: null },
      pages: { type: [String], default: [] },
    },
    legacy: {
      key: { type: String, required: true },
      mediaUrls: { type: [String], default: [] },
      references: { type: [String], default: [] },
    },
    rights: {
      status: { type: String, enum: ["pending_owner_confirmation", "approved", "restricted", "rejected"], default: "pending_owner_confirmation" },
      owner: { type: String, default: null },
      license: { type: String, default: null },
      containsIdentifiablePeople: { type: Boolean, default: false },
      consent: { type: ConsentSchema, default: () => ({ status: "not_required" }) },
      notes: { type: [String], default: [] },
    },
    approval: {
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      approvedAt: { type: Date, default: null },
    },
    tags: { type: [String], default: [] },
    importedAt: { type: Date, default: null },
    cloudinaryImport: { runId: { type: String, default: null }, importRoot: { type: String, default: null } },
    migration: { type: MigrationSchema, default: null },
    deletedAt: { type: Date, default: null },
  },
  schemaOptions("media_assets"),
);

MediaAssetSchema.index({ "legacy.key": 1 }, { unique: true });
MediaAssetSchema.index({ "source.url": 1 }, { unique: true, partialFilterExpression: { "source.url": { $type: "string" } } });
MediaAssetSchema.index({ category: 1, "rights.status": 1 });

export const MediaAsset = defineModel("MediaAsset", MediaAssetSchema);
