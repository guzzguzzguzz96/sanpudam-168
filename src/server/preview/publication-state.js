import "server-only";
import { isPubliclyVisible } from "../cms/policy.js";

// Publication state of a CMS record, for preview badges. Read-only: it
// describes a record and never changes it.
//
// stage (one per record, in workflow order):
//   draft          status draft, not yet submitted or changes requested
//   pending_review status draft, review.status pending_review
//   approved       status draft, review.status approved (ready to publish)
//   published      status published
// publiclyVisible tells whether the public scope would actually show it
// (published + approved + no open placeholders).

export const STAGE_LABELS = Object.freeze({
  draft: "ฉบับร่าง",
  pending_review: "รอตรวจทาน",
  approved: "อนุมัติแล้ว",
  published: "เผยแพร่แล้ว",
  archived: "เก็บถาวร",
});

export function stageOf(doc) {
  if (doc?.status === "published") return "published";
  if (doc?.status === "archived") return "archived";
  if (doc?.review?.status === "approved") return "approved";
  if (doc?.review?.status === "pending_review") return "pending_review";
  return "draft";
}

export function describePublicationState(doc) {
  const stage = stageOf(doc);
  const openPlaceholders = (doc?.placeholderFields ?? [])
    .filter((flag) => flag.status === "placeholder")
    .map((flag) => ({ path: flag.path, note: flag.note ?? null }));
  return {
    stage,
    label: STAGE_LABELS[stage],
    status: doc?.status ?? null,
    reviewStatus: doc?.review?.status ?? null,
    openPlaceholders,
    publiclyVisible: isPubliclyVisible(doc),
  };
}
