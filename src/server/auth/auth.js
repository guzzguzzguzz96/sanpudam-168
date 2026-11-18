import "server-only";
import NextAuth from "next-auth";
import { buildAuthJsConfig } from "./auth-config.js";
import { readAuthConfig } from "./config.js";

// The Auth.js instance. Configuration is read lazily per request, so a
// build without credentials never captures them, and a configuration change
// applies on the next request.
export const { handlers, auth, signIn, signOut } = NextAuth(() => buildAuthJsConfig(readAuthConfig(process.env)));
