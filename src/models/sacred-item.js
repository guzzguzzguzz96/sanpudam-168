import mongoose from "mongoose";
import { ImageRefSchema, SLUG_PATTERN, SeoSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const { Schema } = mongoose;

const VariantSchema = new Schema(
  {
    key: { type: String, required: true },
    sortOrder: { type: Number, required: true },
    name: { type: String, required: true, maxlength: 60 },
    quantity: { type: Number, min: 0, default: null },
    quantityText: { type: String, maxlength: 40, default: null },
    note: { type: String, maxlength: 60, default: null },
  },
  { _id: false },
);

const SacredItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, match: SLUG_PATTERN, unique: true }, // /sakkara/<slug>
    type: { type: String, enum: ["shrine_worship", "sacred_object"], required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    categoryMapping: {
      status: { type: String, enum: ["resolved", "unresolved", "owner_confirmed"], default: "resolved" },
      legacyValue: { type: String, default: null },
      resolvedSlug: { type: String, default: null },
      observedPublicSlug: { type: String, default: null },
    },
    primaryImage: { type: ImageRefSchema, required: true },
    excerpt: { type: String, required: true, maxlength: 220 },
    body: { type: String, maxlength: 8000, default: null },
    bodyFormat: { type: String, enum: ["legacy-text-v1"], default: "legacy-text-v1" },
    prayerTopics: { type: String, maxlength: 160, default: null },
    offerings: { type: String, maxlength: 400, default: null },
    // Legacy "price_note", kept verbatim; never a structured price.
    inquiryText: { type: String, maxlength: 120, default: null },
    variants: { type: [VariantSchema], default: [] },
    showVariantQuantities: { type: Boolean, default: false },
    sortOrder: { type: Number, required: true, default: 0 },
    seo: { type: SeoSchema, default: () => ({}) },
    ...contentFields(),
  },
  schemaOptions("sacred_items"),
);

addContentIndexes(SacredItemSchema);
SacredItemSchema.index({ status: 1, sortOrder: 1 });
SacredItemSchema.index({ categoryId: 1, status: 1, sortOrder: 1 });
SacredItemSchema.index({ "primaryImage.assetId": 1 });
enforcePublishRules(SacredItemSchema, (doc) => {
  const issues = [];
  if (!doc.categoryId || doc.categoryMapping?.status === "unresolved") issues.push("category is not resolved");
  if (doc.inquiryText && /\d/.test(doc.inquiryText)) issues.push("inquiryText contains digits (possible price); owner must review");
  return issues;
});

export const SacredItem = defineModel("SacredItem", SacredItemSchema);
