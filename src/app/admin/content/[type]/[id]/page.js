import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContentDetail, ContentDetailMissing } from "@/components/admin/content-detail";
import { ContentInventoryUnavailable } from "@/components/admin/content-inventory";
import { contentListHref, loadContentDetail } from "@/server/admin/content-detail";
import { getAdminAccess, hasAdminRole } from "@/server/auth/admin-access";
import { CONTENT_INVENTORY_ROLES } from "@/server/auth/config";
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
  const { from } = (await searchParams) ?? {};
  const backHref = contentListHref(from);
  const result = await loadContentDetail(access.principal, { type, id });

  if (result.status === "unavailable") return <ContentInventoryUnavailable reason={result.reason} backHref={backHref} />;
  if (result.status === "not_found") return <ContentDetailMissing backHref={backHref} />;
  return <ContentDetail detail={result.detail} backHref={backHref} />;
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
