import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContentInventory, ContentInventoryUnavailable } from "@/components/admin/content-inventory";
import { PageHeader } from "@/components/pages/page-header";
import { applyTypeFilter, loadContentInventory } from "@/server/admin/content-inventory";
import { getAdminAccess, hasAdminRole } from "@/server/auth/admin-access";
import { CONTENT_INVENTORY_ROLES } from "@/server/auth/config";
import { ADMIN_LOGIN } from "@/server/auth/identity";

export const metadata = {
  title: "รายการเนื้อหา",
  robots: { index: false, follow: false },
};

// Read-only. Access is decided on the server before any content is read:
// a signed-in owner or editor on the current allowlist, from the Auth.js
// session. The filter value is read only after that check.
async function InventoryContent({ searchParams }) {
  const access = await getAdminAccess();
  if (access.status !== "ok" || !hasAdminRole(access.principal, CONTENT_INVENTORY_ROLES)) redirect(ADMIN_LOGIN);

  const inventory = await loadContentInventory(access.principal);
  if (inventory.status === "unavailable") return <ContentInventoryUnavailable reason={inventory.reason} />;

  const { type } = (await searchParams) ?? {};
  return <ContentInventory inventory={inventory} filter={applyTypeFilter(inventory, type)} />;
}

export default function AdminContentPage({ searchParams }) {
  return (
    <main id="main-content" className="content-page admin-page">
      <PageHeader
        current="รายการเนื้อหา"
        description="เนื้อหาทั้งหมดในฐานข้อมูลทดสอบ แสดงสถานะการเผยแพร่และการตรวจทานตามค่าที่บันทึกไว้ (ดูได้อย่างเดียว)"
        eyebrow="ผู้ดูแลระบบ"
        title="รายการเนื้อหา"
        trail={[{ href: "/admin", label: "ผู้ดูแลระบบ" }]}
      />
      <Suspense fallback={null}>
        <InventoryContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
