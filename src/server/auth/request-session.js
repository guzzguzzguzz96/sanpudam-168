import "server-only";
import { cookies } from "next/headers";
import { DraftAccessDeniedError } from "../cms/draft-access.js";
import { SESSION_COOKIE_NAME } from "./config.js";
import { previewAccessPolicy } from "./preview-access.js";

// Next.js request binding for preview authorization. Call it at the top of
// a private preview page or route handler, before any draft query:
//
//   const grant = await getPreviewGrant();
//   if (!grant) notFound();   // no hint that a preview exists
//
// Reading cookies makes the route dynamic, so preview output is never
// prerendered or shared with other visitors. Not used by any route yet.

export async function getPreviewGrant({ readCookie = defaultReadCookie, policy = previewAccessPolicy } = {}) {
  const sessionToken = await readCookie(SESSION_COOKIE_NAME);
  if (!sessionToken) return null;
  try {
    return await policy.requestGrant({ sessionToken });
  } catch (error) {
    if (error instanceof DraftAccessDeniedError) return null;
    throw error;
  }
}

async function defaultReadCookie(name) {
  return (await cookies()).get(name)?.value ?? null;
}
