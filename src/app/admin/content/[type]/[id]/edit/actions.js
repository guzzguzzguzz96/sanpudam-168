"use server";

import { redirect } from "next/navigation";
import { saveFaqEdit } from "@/server/admin/faq-editor";
import { getAdminAccess } from "@/server/auth/admin-access";
import { ADMIN_LOGIN } from "@/server/auth/identity";

// Save one FAQ edit. Authorization is checked again here on every save: the
// Auth.js session and the current allowlist (a server action is never
// prerendered, so there is no request to wait for). The id is validated,
// the form fields are allowlisted, and the role is enforced inside
// saveFaqEdit before anything is written.
export async function saveFaqAction(id, previousState, formData) {
  const access = await getAdminAccess({ waitForRequest: async () => {} });
  if (access.status !== "ok") redirect(ADMIN_LOGIN);

  const result = await saveFaqEdit(access.principal, id, [...formData.entries()]);
  // Only reached after saveFaqEdit validated the id.
  if (result.status === "saved") redirect(`/admin/content/faqs/${id}?saved=1`);
  if (result.status === "unchanged") redirect(`/admin/content/faqs/${id}?saved=unchanged`);
  return { code: result.code, fieldErrors: result.fieldErrors ?? {}, attempt: (previousState?.attempt ?? 0) + 1 };
}
