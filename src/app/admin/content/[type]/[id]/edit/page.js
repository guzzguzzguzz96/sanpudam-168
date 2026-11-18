import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContentDetailMissing } from "@/components/admin/content-detail";
import { FaqEditForm, FaqEditNotice } from "@/components/admin/faq-edit-form";
import { FAQ_FIELD_LABELS, FAQ_LIMITS, evaluateWriterReadiness, loadFaqForEdit } from "@/server/admin/faq-editor";
import { getAdminAccess, hasAdminRole } from "@/server/auth/admin-access";
import { FAQ_EDIT_ROLES } from "@/server/auth/config";
import { ADMIN_LOGIN } from "@/server/auth/identity";
import { saveFaqAction } from "./actions";

export const metadata = {
  title: "แก้ไข FAQ",
  robots: { index: false, follow: false },
};

const OBJECT_ID = /^[0-9a-f]{24}$/;

// Owner-only edit form for one FAQ (question and answer). Access is decided
// on the server before the URL values are used or anything is read; every
// save checks it again (actions.js).
async function EditContent({ params }) {
  const access = await getAdminAccess();
  if (access.status !== "ok") redirect(ADMIN_LOGIN);

  const { type, id } = await params;
  if (type !== "faqs" || typeof id !== "string" || !OBJECT_ID.test(id)) return <ContentDetailMissing backHref="/admin/content?type=faqs" />;
  const detailHref = `/admin/content/faqs/${id}`;

  if (!hasAdminRole(access.principal, FAQ_EDIT_ROLES)) return <FaqEditNotice kind="forbidden" backHref={detailHref} />;
  const readiness = evaluateWriterReadiness();
  if (!readiness.ready) return <FaqEditNotice kind={readiness.reason === "environment" ? "environment" : "unavailable"} backHref={detailHref} />;

  const loaded = await loadFaqForEdit(access.principal, id);
  if (loaded.status === "not_found") return <ContentDetailMissing backHref="/admin/content?type=faqs" />;
  if (loaded.status === "forbidden") return <FaqEditNotice kind="forbidden" backHref={detailHref} />;
  if (loaded.status === "unavailable") return <FaqEditNotice kind={loaded.reason === "environment" ? "environment" : "unavailable"} backHref={detailHref} />;
  if (loaded.status === "not_eligible") return <FaqEditNotice kind="not_eligible" backHref={detailHref} />;

  return <FaqEditForm action={saveFaqAction.bind(null, id)} detailHref={detailHref} faq={loaded.faq} labels={FAQ_FIELD_LABELS} limits={FAQ_LIMITS} />;
}

export default function FaqEditPage({ params }) {
  return (
    <main id="main-content" className="content-page admin-page">
      <Suspense fallback={null}>
        <EditContent params={params} />
      </Suspense>
    </main>
  );
}
