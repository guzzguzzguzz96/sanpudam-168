import mongoose from "mongoose";
import { ImageRefSchema, TIME_PATTERN, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const { Schema } = mongoose;

const SiteSettingsSchema = new Schema(
  {
    key: { type: String, enum: ["default"], default: "default", unique: true },
    identity: {
      name: { type: String, required: true, maxlength: 60 },
      shortName: { type: String, required: true, maxlength: 30 },
      tagline: { type: String, maxlength: 80, default: null },
      description: { type: String, required: true, maxlength: 400 },
    },
    branding: {
      logo: { type: ImageRefSchema, default: null },
      logoNote: { type: String, default: null },
    },
    contact: {
      address: { type: String, required: true, maxlength: 200 },
      locationShort: { type: String, required: true, maxlength: 80 },
      phoneNumber: { type: String, default: null }, // same name as src/config/site.js
      lineId: { type: String, default: null }, // lineInquiryUrl is derived when read
      directionsUrl: { type: String, default: null }, // validated with getMapsUrl()
      mapEmbedQuery: { type: String, maxlength: 120, default: null },
      verified: { type: Boolean, default: false },
    },
    openingHours: {
      opens: { type: String, match: TIME_PATTERN, required: true },
      closes: { type: String, match: TIME_PATTERN, required: true },
      daysOfWeek: { type: [String], enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], default: [] },
      daysText: { type: String, required: true, maxlength: 40 },
      displayText: { type: String, required: true, maxlength: 60 },
    },
    socialLinks: {
      type: [new Schema({
        platform: { type: String, enum: ["facebook", "tiktok", "youtube"], required: true },
        url: { type: String, required: true },
        verified: { type: Boolean, default: false },
      }, { _id: false })],
      default: [],
    },
    contactTopics: {
      type: [new Schema({
        key: { type: String, required: true },
        sortOrder: { type: Number, required: true },
        label: { type: String, required: true, maxlength: 60 },
      }, { _id: false })],
      default: [],
    },
    seo: { defaultOgImage: { type: ImageRefSchema, default: null } },
    // Marketing/analytics IDs are not migrated; only their absence is recorded.
    analytics: {
      enabled: { type: Boolean, default: false },
      excluded: { type: Boolean, default: true },
      legacyValuesPresent: { type: [String], default: [] },
    },
    ...contentFields(),
  },
  schemaOptions("site_settings"),
);

addContentIndexes(SiteSettingsSchema);
enforcePublishRules(SiteSettingsSchema);

export const SiteSettings = defineModel("SiteSettings", SiteSettingsSchema);
