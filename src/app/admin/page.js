import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPanel, SignOutButton } from "@/components/admin/admin-panel";
import { PageHeader } from "@/components/pages/page-header";
import { Button } from "@/components/ui/button";
import { getAdminAccess } from "@/server/auth/admin-access";
import { ADMIN_LOGIN } from "@/server/auth/identity";

export const metadata = {
  title: "ผู้ดูแลระบบ",
  robots: { index: false, follow: false },
};

const ROLE_LABELS = { owner: "เจ้าของ", editor: "ผู้แก้ไขเนื้อหา" };

// Protected on the server: identity and role are read from the Auth.js
// session and the current allowlist for every request. Anyone else is sent
// to the login page, which explains why.
async function AdminContent() {
  const access = await getAdminAccess();
  if (access.status !== "ok") redirect(ADMIN_LOGIN);
  const { name, email, role } = access.principal;

  return (
    <AdminPanel titleId="admin-home-title" title="เข้าสู่ระบบแล้ว">
      <dl className="admin-panel__facts">
        {name ? (
          <div>
            <dt>ชื่อ</dt>
            <dd>{name}</dd>
          </div>
        ) : null}
        <div>
          <dt>บัญชี Google</dt>
          <dd className="admin-panel__email">{email}</dd>
        </div>
        <div>
          <dt>บทบาท</dt>
          <dd>{ROLE_LABELS[role] ?? role}</dd>
        </div>
      </dl>
      <p className="admin-panel__text">ขณะนี้ดูรายการเนื้อหาได้อย่างเดียว ยังแก้ไขหรือเผยแพร่ไม่ได้</p>
      <div className="admin-panel__actions">
        <Button href="/admin/content" variant="primary">
          ดูรายการเนื้อหา
        </Button>
        <SignOutButton />
      </div>
    </AdminPanel>
  );
}

export default function AdminPage() {
  return (
    <main id="main-content" className="content-page admin-page">
      <PageHeader current="ผู้ดูแลระบบ" eyebrow="ผู้ดูแลระบบ" title="ระบบผู้ดูแลเว็บไซต์" />
      <Suspense fallback={null}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
