"use server";

import { signIn, signOut } from "@/server/auth/auth";
import { readAuthConfig } from "@/server/auth/config";
import { ADMIN_HOME, ADMIN_LOGIN } from "@/server/auth/identity";

// Fixed destinations only: no redirect target is taken from the form.

export async function signInWithGoogle() {
  if (!readAuthConfig(process.env).enabled) return;
  await signIn("google", { redirectTo: ADMIN_HOME });
}

export async function signOutOfAdmin() {
  if (!readAuthConfig(process.env).enabled) return;
  await signOut({ redirectTo: ADMIN_LOGIN });
}
