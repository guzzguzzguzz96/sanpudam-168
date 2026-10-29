import mongoose from "mongoose";
import { ISO_DATE_PATTERN, ImageRefSchema, SLUG_PATTERN, SeoSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const NewsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, match: SLUG_PATTERN, unique: true }, // /news/<slug>
    date: { type: String, required: true, match: ISO_DATE_PATTERN }, // date-only, no timezone shift
    coverImage: { type: ImageRefSchema, required: true },
    excerpt: { type: String, required: true, maxlength: 220 },
    body: { type: String, required: true, maxlength: 15000 },
    bodyFormat: { type: String, enum: ["legacy-text-v1"], default: "legacy-text-v1" },
    images: { type: [ImageRefSchema], default: [] },
    seo: { type: SeoSchema, default: () => ({}) },
    ...contentFields(),
  },
  schemaOptions("news"),
);

addContentIndexes(NewsSchema);
NewsSchema.index({ status: 1, date: -1 });
NewsSchema.index({ "coverImage.assetId": 1 });
NewsSchema.index({ "images.assetId": 1 });
enforcePublishRules(NewsSchema);

export const News = defineModel("News", NewsSchema);
