import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContentDetail, ContentDetailMissing } from "@/components/admin/content-detail";
import { ContentInventoryUnavailable } from "@/components/admin/content-inventory";
import { contentListHref, loadContentDetail } from "@/server/admin/content-detail";
import { FAQ_FIELD_LABELS, isFaqEditable } from "@/server/admin/faq-editor";
import { getAdminAccess, hasAdminRole } from "@/server/auth/admin-access";
import { CONTENT_INVENTORY_ROLES, FAQ_EDIT_ROLES } from "@/server/auth/config";
import { ADMIN_LOGIN } from "@/server/auth/identity";

export const metadata = {
  title: "รายละเอียดเนื้อหา",
  robots: { index: false, follow: false },
};

// Read-only. Access is decided on the server before the URL values are
// used or any content is read. type and id are validated before a query.
async function DetailContent({ params, searchParams }) {
  const access = await getAdminAccess();
  if (access.status !== "ok" || !hasAdminRole(access.principal, CONTENT_INVENTORY_ROLES)) redirect(ADMIN_LOGIN);

  const { type, id } = await params;
  const { from, saved } = (await searchParams) ?? {};
  const backHref = contentListHref(from);
  const result = await loadContentDetail(access.principal, { type, id });

  if (result.status === "unavailable") return <ContentInventoryUnavailable reason={result.reason} backHref={backHref} />;
  if (result.status === "not_found") return <ContentDetailMissing backHref={backHref} />;
  const { detail } = result;
  // "แก้ไข FAQ": FAQs in draft / pending_review, for owners only. The edit
  // page and every save check this again on the server.
  const canEditFaq = detail.type.key === "faqs" && hasAdminRole(access.principal, FAQ_EDIT_ROLES) && isFaqEditable(detail.state);
  const editHref = canEditFaq ? `/admin/content/faqs/${detail.id}/edit` : null;
  // After a save: which edited fields still carry an open placeholder flag.
  const flagged = detail.placeholders.open.filter((flag) => Object.hasOwn(FAQ_FIELD_LABELS, flag.path)).map((flag) => FAQ_FIELD_LABELS[flag.path]);
  let notice = null;
  if (detail.type.key === "faqs" && saved === "1") notice = { tone: "success", text: "บันทึกการแก้ไขแล้ว", flagged };
  if (detail.type.key === "faqs" && saved === "unchanged") notice = { tone: "info", text: "ข้อความเหมือนเดิม จึงไม่ได้บันทึกและไม่มีการเปลี่ยนแปลง", flagged: [] };
  return <ContentDetail detail={detail} backHref={backHref} editHref={editHref} notice={notice} />;
}

export default function AdminContentDetailPage({ params, searchParams }) {
  return (
    <main id="main-content" className="content-page admin-page">
      <Suspense fallback={null}>
        <DetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
