import mongoose from "mongoose";
import { ImageRefSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const GalleryItemSchema = new mongoose.Schema(
  {
    galleryKey: { type: String, default: "shrine-main", index: true },
    image: { type: ImageRefSchema, required: true },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("gallery_items"),
);

addContentIndexes(GalleryItemSchema);
GalleryItemSchema.index({ galleryKey: 1, status: 1, sortOrder: 1 });
GalleryItemSchema.index({ "image.assetId": 1 });
enforcePublishRules(GalleryItemSchema);

export const GalleryItem = defineModel("GalleryItem", GalleryItemSchema);
