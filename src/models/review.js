import mongoose from "mongoose";
import { ConsentSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const ReviewSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, maxlength: 40 },
    sourceLabel: { type: String, maxlength: 60, default: null },
    quote: { type: String, required: true, maxlength: 500 },
    rating: { type: Number, min: 1, max: 5, default: null },
    consent: { type: ConsentSchema, default: () => ({ status: "pending" }) },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("reviews"),
);

addContentIndexes(ReviewSchema);
enforcePublishRules(ReviewSchema, (doc) => (doc.consent?.status === "obtained" ? [] : ["consent has not been obtained"]));

export const Review = defineModel("Review", ReviewSchema);
