import mongoose from "mongoose";
import { SLUG_PATTERN, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, match: SLUG_PATTERN, unique: true }, // /sakkara?cat=<slug>
    description: { type: String, maxlength: 300, default: null },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("categories"),
);

addContentIndexes(CategorySchema);
enforcePublishRules(CategorySchema);

export const Category = defineModel("Category", CategorySchema);
