import "server-only";
import Google from "next-auth/providers/google";
import { MAX_SESSION_SECONDS } from "./config.js";
import { ADMIN_LOGIN, resolveGoogleIdentity, safeAdminRedirect, sessionClaims, sessionFromClaims } from "./identity.js";

// Auth.js configuration for admin sign-in, built from readAuthConfig().
// JWT sessions, no database adapter: no user or account records are written.
// CSRF protection and cookie settings stay at their Auth.js defaults.
//
// providerOptions is for tests only (e.g. a customFetch stub for offline
// OIDC discovery).

// Error names and warning codes only: no causes, stacks, provider
// responses, tokens, or cookie values reach the logs.
const logger = {
  error(error) {
    console.error(`[admin-auth] ${error?.type ?? error?.name ?? "Error"}`);
  },
  warn(code) {
    console.warn(`[admin-auth] ${code}`);
  },
  debug() {},
};
export function buildAuthJsConfig(config, { providerOptions = {} } = {}) {
  if (!config?.enabled) {
    // Never used for a request: routes and pages check config.enabled first.
    return { providers: [], secret: [], trustHost: false };
  }

  return {
    secret: config.secret,
    // The origin comes from AUTH_URL (validated in config.js), never from
    // Host or X-Forwarded-Host. trustHost only silences Auth.js's own check.
    trustHost: true,
    basePath: "/api/auth",
    providers: [
      Google({
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        // Identity only: no offline access, no extra Google APIs.
        authorization: { params: { scope: "openid email profile" } },
        // Auth.js defaults to PKCE only; state and nonce add callback and
        // ID-token replay protection.
        checks: ["pkce", "state", "nonce"],
        ...providerOptions,
      }),
    ],
    logger,
    session: { strategy: "jwt", maxAge: MAX_SESSION_SECONDS },
    jwt: { maxAge: MAX_SESSION_SECONDS },
    pages: { signIn: ADMIN_LOGIN, error: ADMIN_LOGIN },
    callbacks: {
      // Only verified Google identities on the current allowlist may sign in.
      // false -> Auth.js redirects to the login page with error=AccessDenied.
      signIn({ account, profile }) {
        const identity = resolveGoogleIdentity({ account, profile });
        return Boolean(identity && config.accounts.has(identity.email));
      },
      // At sign-in, replace Auth.js's default token with minimal claims.
      // Later calls keep the token as issued; data sent by the browser
      // (trigger "update") is ignored.
      jwt({ token, account, profile }) {
        if (account) {
          const identity = resolveGoogleIdentity({ account, profile });
          return identity ? sessionClaims(identity) : null;
        }
        return token;
      },
      session({ session, token }) {
        return sessionFromClaims(session, token);
      },
      redirect({ url, baseUrl }) {
        return safeAdminRedirect(url, baseUrl);
      },
    },
  };
}
