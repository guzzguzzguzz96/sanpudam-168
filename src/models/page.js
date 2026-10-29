import mongoose from "mongoose";
import { ImageRefSchema, SeoSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const { Schema } = mongoose;

const listItem = (fields) => new Schema({ key: { type: String, required: true }, sortOrder: { type: Number, required: true }, ...fields }, { _id: false });

// Legacy icon keys confirmed in Phase 02.5.3: briefcase, file-text, coins, crown.
// The other three come from the admin audit labels and are unconfirmed.
export const WISH_ICONS = ["arrow-up", "graduation-cap", "briefcase", "file-text", "coins", "crown", "shield"];

const PageSchema = new Schema(
  {
    key: { type: String, enum: ["history"], required: true, unique: true },
    title: { type: String, required: true, maxlength: 80 },
    intro: { type: String, required: true, maxlength: 500 },
    historyBody: { type: String, required: true, maxlength: 8000 },
    historyImage: { type: ImageRefSchema, default: null },
    quote: { type: String, maxlength: 140, default: null },
    homeIntroHeading: { type: String, required: true, maxlength: 40 },
    coatOfArms: {
      heading: { type: String, required: true, maxlength: 80 },
      body: { type: String, required: true, maxlength: 8000 },
      image: { type: ImageRefSchema, default: null },
      parts: { type: [listItem({ part: { type: String, required: true, maxlength: 80 }, meaning: { type: String, required: true, maxlength: 300 } })], default: [] },
    },
    wishTopics: {
      type: [listItem({
        topic: { type: String, required: true, maxlength: 40 },
        description: { type: String, maxlength: 140, default: null },
        icon: { type: String, required: true, enum: WISH_ICONS },
      })],
      default: [],
    },
    worshipSteps: { type: [listItem({ title: { type: String, required: true, maxlength: 80 }, detail: { type: String, maxlength: 300, default: null } })], default: [] },
    bodyFormat: { type: String, enum: ["legacy-text-v1"], default: "legacy-text-v1" },
    seo: { type: SeoSchema, default: () => ({}) },
    ...contentFields(),
  },
  schemaOptions("pages"),
);

addContentIndexes(PageSchema);
enforcePublishRules(PageSchema);

export const Page = defineModel("Page", PageSchema);
