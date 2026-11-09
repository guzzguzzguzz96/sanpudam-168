import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPanel, GoogleSignInButton, SignOutButton } from "@/components/admin/admin-panel";
import { PageHeader } from "@/components/pages/page-header";
import { getAdminAccess } from "@/server/auth/admin-access";
import { ADMIN_HOME } from "@/server/auth/identity";

export const metadata = {
  title: "เข้าสู่ระบบผู้ดูแล",
  robots: { index: false, follow: false },
};

// Auth.js error codes that mean "this account may not sign in". Every other
// code gets one generic message; the raw value is never shown.
const DENIED_ERRORS = new Set(["AccessDenied"]);

async function LoginContent({ searchParams }) {
  const access = await getAdminAccess();
  if (access.status === "ok") redirect(ADMIN_HOME);

  if (access.status === "unavailable") {
    return (
      <AdminPanel titleId="admin-login-title" title="ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน" tone="notice">
        <p className="admin-panel__text">
          ยังตั้งค่าการเข้าสู่ระบบสำหรับผู้ดูแลไม่ครบ จึงยังไม่เปิดให้เข้าสู่ระบบ กรุณาติดต่อผู้พัฒนาเว็บไซต์
        </p>
      </AdminPanel>
    );
  }

  // Signed in with Google, but the account is not (or no longer) allowed.
  if (access.status === "forbidden") {
    return (
      <AdminPanel titleId="admin-login-title" title="บัญชีนี้ไม่มีสิทธิ์เข้าถึง" tone="notice">
        <p className="admin-panel__text">
          บัญชี Google ที่ใช้อยู่ไม่ได้รับอนุญาตให้เข้าระบบผู้ดูแล ออกจากระบบแล้วลองใช้บัญชีที่ได้รับอนุญาต หรือติดต่อเจ้าของเว็บไซต์
        </p>
        <SignOutButton label="ออกจากระบบเพื่อเปลี่ยนบัญชี" />
      </AdminPanel>
    );
  }

  const { error } = (await searchParams) ?? {};
  const code = typeof error === "string" ? error : null;

  return (
    <AdminPanel titleId="admin-login-title" title="เข้าสู่ระบบผู้ดูแล">
      {code ? (
        <p className="admin-panel__alert" role="alert">
          {DENIED_ERRORS.has(code)
            ? "บัญชี Google นี้ไม่ได้รับอนุญาตให้เข้าระบบผู้ดูแล หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อเจ้าของเว็บไซต์"
            : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"}
        </p>
      ) : null}
      <p className="admin-panel__text">
        สำหรับเจ้าของและผู้แก้ไขเนื้อหาที่ได้รับอนุญาตเท่านั้น ระบบจะพาไปยังหน้าเข้าสู่ระบบของ Google เพื่อยืนยันตัวตน
        เว็บไซต์นี้ไม่ได้รับรหัสผ่านของคุณ
      </p>
      <GoogleSignInButton />
    </AdminPanel>
  );
}

export default function AdminLoginPage({ searchParams }) {
  return (
    <main id="main-content" className="content-page admin-page">
      <PageHeader current="เข้าสู่ระบบผู้ดูแล" eyebrow="ผู้ดูแลระบบ" title="ระบบผู้ดูแลเว็บไซต์" />
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
