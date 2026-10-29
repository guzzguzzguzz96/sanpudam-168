import mongoose from "mongoose";
import { defineModel } from "./shared.js";

const { Schema } = mongoose;

// Bookkeeping for import runs. Never stores credentials, connection
// strings, or environment values.
const MigrationRunSchema = new Schema(
  {
    runId: { type: String, required: true, unique: true },
    track: { type: String, enum: ["media", "site_settings", "content", "mongodb"], required: true },
    mode: { type: String, enum: ["dry_run", "preflight", "apply"], required: true },
    planHash: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
    targetDatabase: { type: String, required: true },
    sourceType: { type: String, enum: ["admin_ui_capture", "export", "manual_transcription", "public_site"], required: true },
    status: { type: String, enum: ["running", "completed", "completed_with_issues", "failed"], default: "running" },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    operator: { type: String, default: null },
    counts: { type: Map, of: Number, default: {} },
    items: {
      type: [new Schema({
        collectionName: String,
        importId: String,
        legacyKey: String,
        result: String,
        message: String,
      }, { _id: false })],
      default: [],
    },
  },
  { collection: "migration_runs", timestamps: true },
);

export const MigrationRun = defineModel("MigrationRun", MigrationRunSchema);
