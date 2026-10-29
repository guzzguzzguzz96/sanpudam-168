import mongoose from "mongoose";
import { ImageRefSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const BannerSchema = new mongoose.Schema(
  {
    image: { type: ImageRefSchema, required: true }, // 3:2, caption required (≤ 40), focal point 0–1
    mobileImage: { type: ImageRefSchema, default: null },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("banners"),
);

addContentIndexes(BannerSchema);
BannerSchema.index({ status: 1, sortOrder: 1 });
BannerSchema.index({ "image.assetId": 1 });
BannerSchema.path("image").validate((value) => Boolean(value?.caption), "Banner caption is required");
BannerSchema.path("image").validate((value) => !value?.caption || value.caption.length <= 40, "Banner caption must be at most 40 characters");
enforcePublishRules(BannerSchema);

export const Banner = defineModel("Banner", BannerSchema);
