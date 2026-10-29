import mongoose from "mongoose";
import { ImageRefSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

const { Schema } = mongoose;

const VideoSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 80 },
    // Allowed to be null while draft (the legacy record has no file);
    // publishing requires it.
    videoAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    videoMapping: {
      status: { type: String, enum: ["resolved", "pending", "missing"], default: "missing" },
      legacyValue: { type: Schema.Types.Mixed, default: null },
    },
    posterMode: { type: String, enum: ["auto", "custom"], default: "auto" },
    poster: { type: ImageRefSchema, default: null },
    description: { type: String, maxlength: 300, default: null },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("videos"),
);

addContentIndexes(VideoSchema);
enforcePublishRules(VideoSchema, (doc) => (doc.videoAssetId && doc.videoMapping?.status === "resolved" ? [] : ["video file is missing"]));

export const Video = defineModel("Video", VideoSchema);
