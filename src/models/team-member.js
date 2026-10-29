import mongoose from "mongoose";
import { ConsentSchema, ImageRefSchema, addContentIndexes, contentFields, defineModel, enforcePublishRules, schemaOptions } from "./shared.js";

// Public team listing only. Not an account: no relation to users.
const TeamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 60 },
    roleTitle: { type: String, required: true, maxlength: 60 },
    photo: { type: ImageRefSchema, default: null }, // 1:1
    bio: { type: String, maxlength: 300, default: null },
    consent: { type: ConsentSchema, default: () => ({ status: "pending" }) },
    sortOrder: { type: Number, required: true, default: 0 },
    ...contentFields(),
  },
  schemaOptions("team_members"),
);

addContentIndexes(TeamMemberSchema);
enforcePublishRules(TeamMemberSchema, (doc) => (doc.consent?.status === "obtained" ? [] : ["consent has not been obtained"]));

export const TeamMember = defineModel("TeamMember", TeamMemberSchema);
