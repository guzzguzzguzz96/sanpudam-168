import mongoose from "mongoose";
import { addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const FaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, maxlength: 140 },
    answer: { type: String, required: true, maxlength: 800 },
    showOnHome: { type: Boolean, default: false },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("faqs"),
);

addContentIndexes(FaqSchema);
FaqSchema.index({ status: 1, sortOrder: 1 });
FaqSchema.index({ showOnHome: 1, status: 1, sortOrder: 1 });
enforcePublishRules(FaqSchema);

export const Faq = defineModel("Faq", FaqSchema);
