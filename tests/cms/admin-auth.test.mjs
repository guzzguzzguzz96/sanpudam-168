// Admin sign-in: configuration, Google identity rules, the Auth.js
// callbacks, per-request authorization, redirects, and the real Auth.js
// request pipeline. Offline: Google discovery is stubbed and no Google
// request is made. All values are test-only; none is a real credential or
// account.
import { test } from "node:test";
import assert from "node:assert/strict";
import NextAuth, { customFetch } from "next-auth";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { AdminAccessDeniedError, getAdminAccess, hasAdminRole, requireAdminRole } from "../../src/server/auth/admin-access.js";
import { buildAuthJsConfig } from "../../src/server/auth/auth-config.js";
import { MAX_SESSION_SECONDS, parseAllowedAccounts, parseAuthOrigin, readAuthConfig, reportAuthConfigProblems } from "../../src/server/auth/config.js";
import { evaluateAdminSession, resolveGoogleIdentity, safeAdminRedirect } from "../../src/server/auth/identity.js";

const SECRET = "test-only-secret-0123456789abcdefghijklmnop";
const ORIGIN = "http://localhost:3000";
const env = Object.freeze({
  AUTH_SECRET: SECRET,
  AUTH_URL: ORIGIN,
  AUTH_GOOGLE_ID: "test-client-id.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "test-client-secret-value",
  ADMIN_ALLOWED_ACCOUNTS: "owner@example.test:owner, Editor@Example.test:editor",
});
const config = readAuthConfig(env);
const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);
const NOW_S = Math.floor(NOW / 1000);

const googleAccount = (overrides = {}) => ({ provider: "google", type: "oidc", providerAccountId: "1000001", access_token: "provider-access-token", id_token: "provider-id-token", refresh_token: "provider-refresh-token", ...overrides });
const googleProfile = (overrides = {}) => ({ sub: "1000001", email: "owner@example.test", email_verified: true, name: "Owner Test", picture: "https://example.test/p.png", ...overrides });
const session = (identity = {}, user = {}) => ({
  user: { name: "Owner Test", email: identity.email ?? "owner@example.test", ...user },
  identity: { provider: "google", subject: "1000001", email: "owner@example.test", authTime: NOW_S - 60, ...identity },
});
// Outside Next.js there is no request to wait for.
const outsideRequest = async () => {};
const access = (sessionValue, envValue = env) => getAdminAccess({ env: envValue, readSession: async () => sessionValue, now: NOW, waitForRequest: outsideRequest });

// ---- configuration -------------------------------------------------------

test("config: complete configuration enables sign-in and exposes no values in problems", () => {
  assert.equal(config.enabled, true);
  assert.deepEqual([...config.accounts], [["owner@example.test", "owner"], ["editor@example.test", "editor"]]);
  assert.equal(config.origin, ORIGIN);
  for (const name of ["AUTH_SECRET", "AUTH_URL", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ADMIN_ALLOWED_ACCOUNTS"]) {
    const partial = readAuthConfig({ ...env, [name]: "" });
    assert.equal(partial.enabled, false, name);
    assert.deepEqual(partial.problems, [name]);
    assert.equal(partial.secret, null);
    assert.equal(partial.google, null);
    assert.equal(partial.accounts.size, 0);
  }
  const text = JSON.stringify(readAuthConfig({ ...env, AUTH_URL: "nope" }));
  for (const value of [SECRET, env.AUTH_GOOGLE_SECRET, "owner@example.test"]) assert.ok(!text.includes(value), "a value leaked");
  assert.equal(readAuthConfig({ ...env, AUTH_SECRET: "short-secret" }).enabled, false);
  assert.equal(readAuthConfig({}).enabled, false);
  assert.equal(readAuthConfig(undefined).enabled, false);
});

test("config: an empty or malformed allowlist denies everyone", () => {
  const malformed = [
    "", " ", " , ", "owner@example.test", "owner@example.test:", ":owner", "owner@example.test:admin",
    "owner@example.test:Owner", "not-an-email:owner", "owner@example:owner", "@example.test:owner",
    "a@example.test:owner,a@example.test:editor", "A@example.test:owner,a@example.test:owner",
    "owner@example.test:owner,garbage", "owner@example.test:owner;editor@example.test:editor",
  ];
  for (const value of malformed) {
    assert.equal(parseAllowedAccounts(value), null, JSON.stringify(value));
    assert.equal(readAuthConfig({ ...env, ADMIN_ALLOWED_ACCOUNTS: value }).enabled, false, JSON.stringify(value));
  }
  assert.deepEqual([...parseAllowedAccounts(" Owner@Example.TEST:owner , ")], [["owner@example.test", "owner"]]);
});

test("config: AUTH_URL must be an exact https origin or a loopback http origin", () => {
  assert.equal(parseAuthOrigin("https://sanpudam.example"), "https://sanpudam.example");
  assert.equal(parseAuthOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(parseAuthOrigin("http://127.0.0.1:3000/"), "http://127.0.0.1:3000");
  for (const value of [undefined, "", "localhost:3000", "http://example.test", "https://x.example/app", "https://x.example/?a=1", "https://u:p@x.example", "javascript:alert(1)", "ftp://x.example"]) {
    assert.equal(parseAuthOrigin(value), null, String(value));
  }
});

test("config: diagnostics name the failed rule as a safe code, never a value", () => {
  const allowlistCases = {
    "": "ADMIN_ALLOWED_ACCOUNTS:missing",
    "owner@example.test": "ADMIN_ALLOWED_ACCOUNTS:entry_1_missing_role",
    "owner@example.test:": "ADMIN_ALLOWED_ACCOUNTS:entry_1_missing_role",
    "owner@example.test:owner,nobody:editor": "ADMIN_ALLOWED_ACCOUNTS:entry_2_invalid_email",
    "owner@example.test:admin": "ADMIN_ALLOWED_ACCOUNTS:entry_1_unknown_role",
    "a@example.test:owner,A@example.test:editor": "ADMIN_ALLOWED_ACCOUNTS:entry_2_duplicate_email",
  };
  for (const [value, reason] of Object.entries(allowlistCases)) {
    const checked = readAuthConfig({ ...env, ADMIN_ALLOWED_ACCOUNTS: value });
    assert.equal(checked.enabled, false, value);
    assert.deepEqual(checked.reasons, [reason], value);
  }
  assert.deepEqual(readAuthConfig({}).reasons, ["AUTH_SECRET:missing", "AUTH_URL:missing", "AUTH_GOOGLE_ID:missing", "AUTH_GOOGLE_SECRET:missing", "ADMIN_ALLOWED_ACCOUNTS:missing"]);
  assert.deepEqual(readAuthConfig({ ...env, AUTH_SECRET: "short" }).reasons, ["AUTH_SECRET:too_short"]);
  assert.deepEqual(readAuthConfig({ ...env, AUTH_URL: "http://example.test" }).reasons, ["AUTH_URL:not_an_allowed_origin"]);
  assert.deepEqual(config.reasons, []);

  // Development: codes and the expected format, logged once. Otherwise:
  // variable names only. Never the values.
  const logged = [];
  const logger = { warn: (line) => logged.push(line) };
  const broken = readAuthConfig({ ...env, ADMIN_ALLOWED_ACCOUNTS: "private.person@example.test" });
  reportAuthConfigProblems(broken, { env: { NODE_ENV: "development" }, logger });
  reportAuthConfigProblems(broken, { env: { NODE_ENV: "development" }, logger });
  reportAuthConfigProblems(broken, { env: { NODE_ENV: "production" }, logger });
  reportAuthConfigProblems(config, { env: { NODE_ENV: "development" }, logger });
  assert.equal(logged.length, 2);
  assert.match(logged[0], /ADMIN_ALLOWED_ACCOUNTS:entry_1_missing_role/);
  assert.match(logged[0], /email:owner or email:editor/);
  assert.equal(logged[1], "[admin-auth] sign-in unavailable; check: ADMIN_ALLOWED_ACCOUNTS");
  for (const line of logged) for (const value of ["private.person", SECRET, env.AUTH_GOOGLE_SECRET, env.AUTH_GOOGLE_ID]) assert.ok(!line.includes(value), "a value was logged");
});

test("config: a redirect proxy can never be enabled", () => {
  const withProxy = readAuthConfig({ ...env, AUTH_REDIRECT_PROXY_URL: "https://other.example/api/auth" });
  assert.equal(withProxy.enabled, false);
  assert.deepEqual(withProxy.problems, ["AUTH_REDIRECT_PROXY_URL (must be unset)"]);
});

// ---- Google identity -----------------------------------------------------

test("identity: only verified Google OIDC profiles with a subject are accepted", () => {
  assert.deepEqual(resolveGoogleIdentity({ account: googleAccount(), profile: googleProfile() }), { subject: "1000001", email: "owner@example.test", name: "Owner Test" });
  assert.equal(resolveGoogleIdentity({ account: googleAccount(), profile: googleProfile({ email: " OWNER@Example.Test " }) }).email, "owner@example.test");
  const rejected = {
    emailVerifiedMissing: { profile: googleProfile({ email_verified: undefined }) },
    emailVerifiedFalse: { profile: googleProfile({ email_verified: false }) },
    emailVerifiedString: { profile: googleProfile({ email_verified: "true" }) },
    wrongProvider: { account: googleAccount({ provider: "github", type: "oauth" }) },
    wrongType: { account: googleAccount({ type: "oauth" }) },
    missingSubject: { profile: googleProfile({ sub: undefined }) },
    emptySubject: { profile: googleProfile({ sub: "" }) },
    malformedSubject: { profile: googleProfile({ sub: "1000001 or 1=1" }) },
    subjectMismatch: { account: googleAccount({ providerAccountId: "2000002" }) },
    missingEmail: { profile: googleProfile({ email: undefined }) },
    malformedEmail: { profile: googleProfile({ email: "owner" }) },
    noProfile: { profile: undefined },
    noAccount: { account: undefined },
  };
  for (const [name, input] of Object.entries(rejected)) {
    assert.equal(resolveGoogleIdentity({ account: googleAccount(), profile: googleProfile(), ...input }), null, name);
  }
});

// ---- Auth.js callbacks ---------------------------------------------------

test("callbacks: sign-in requires an exact allowlisted, verified email", () => {
  const { signIn } = buildAuthJsConfig(config).callbacks;
  assert.equal(signIn({ account: googleAccount(), profile: googleProfile() }), true);
  assert.equal(signIn({ account: googleAccount(), profile: googleProfile({ email: "editor@example.test" }) }), true);
  const denied = [
    googleProfile({ email: "someone@example.test" }),
    googleProfile({ email: "owner@example.test.evil" }),
    googleProfile({ email: "owner+admin@example.test" }),
    googleProfile({ email: "other@example.test", name: "Owner Test" }), // same display name
    googleProfile({ email: "owner@example.test", email_verified: false }),
    googleProfile({ hd: "example.test", email: "new@example.test" }), // same domain
  ];
  for (const profile of denied) assert.equal(signIn({ account: googleAccount(), profile }), false, profile.email);
  assert.equal(signIn({ account: googleAccount({ provider: "github", type: "oauth" }), profile: googleProfile() }), false);
  assert.equal(signIn({ account: null, profile: null }), false);
});

test("callbacks: the JWT keeps identity claims only, never provider tokens or roles", () => {
  const { jwt, session: toSession } = buildAuthJsConfig(config).callbacks;
  const token = jwt({ token: { name: "x", email: "x", picture: "x", sub: "x" }, account: googleAccount(), profile: googleProfile() });
  assert.deepEqual(Object.keys(token).sort(), ["authTime", "email", "name", "provider", "sub"]);
  assert.deepEqual({ ...token, authTime: 0 }, { sub: "1000001", email: "owner@example.test", name: "Owner Test", provider: "google", authTime: 0 });
  const serialized = JSON.stringify(token);
  for (const secret of ["provider-access-token", "provider-id-token", "provider-refresh-token", "picture"]) assert.ok(!serialized.includes(secret), secret);
  assert.equal(jwt({ token: {}, account: googleAccount(), profile: googleProfile({ email_verified: false }) }), null);

  // Browser-supplied update data (trigger "update") is ignored.
  const kept = jwt({ token, trigger: "update", session: { role: "owner", email: "attacker@example.test", identity: { email: "attacker@example.test" } } });
  assert.equal(kept, token);

  const shaped = toSession({ session: { expires: "2026-11-09T20:00:00.000Z", user: { role: "owner" } }, token });
  assert.deepEqual(shaped.user, { name: "Owner Test", email: "owner@example.test" });
  assert.equal(shaped.identity.subject, "1000001");
  assert.ok(!JSON.stringify(shaped).includes("role"), "no role in the session");
});

test("callbacks: session lifetime matches the 8-hour project policy", () => {
  const built = buildAuthJsConfig(config);
  assert.equal(MAX_SESSION_SECONDS, 8 * 60 * 60);
  assert.equal(built.session.strategy, "jwt");
  assert.equal(built.session.maxAge, MAX_SESSION_SECONDS);
  assert.equal(built.jwt.maxAge, MAX_SESSION_SECONDS);
  assert.equal(built.adapter, undefined, "no database adapter");
  assert.deepEqual(built.pages, { signIn: "/admin/login", error: "/admin/login" });
  // The logger prints only the error type, never causes or values.
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(line);
  try {
    const cause = new Error(`token=provider-access-token secret=${SECRET}`);
    built.logger.error(Object.assign(new Error("boom", { cause }), { type: "OAuthCallbackError" }));
  } finally {
    console.error = original;
  }
  assert.deepEqual(lines, ["[admin-auth] OAuthCallbackError"]);
  const disabled = buildAuthJsConfig(readAuthConfig({}));
  assert.deepEqual(disabled.providers, []);
  assert.equal(disabled.trustHost, false);
});

// ---- per-request authorization -------------------------------------------

test("access: no session, foreign sessions, and malformed claims are unauthenticated", async () => {
  for (const value of [null, undefined, {}, { user: { email: "owner@example.test" } }, { identity: null }]) {
    assert.equal((await access(value)).status, "unauthenticated", JSON.stringify(value));
  }
  const malformed = [
    { provider: "github" }, { provider: undefined }, { subject: undefined }, { subject: "" }, { subject: "has space" },
    { email: undefined }, { email: "OWNER@example.test" }, { email: "owner" },
    { authTime: undefined }, { authTime: "123" }, { authTime: NOW_S - MAX_SESSION_SECONDS - 1 }, { authTime: NOW_S + 3600 },
  ];
  for (const identity of malformed) assert.equal((await access(session(identity))).status, "unauthenticated", JSON.stringify(identity));
});

test("access: an approved identity gets its role from server configuration", async () => {
  const owner = await access(session());
  assert.equal(owner.status, "ok");
  assert.deepEqual({ ...owner.principal }, { subject: "1000001", email: "owner@example.test", name: "Owner Test", role: "owner", authTime: NOW_S - 60 });
  assert.ok(Object.isFrozen(owner.principal));
  const editor = await access(session({ email: "editor@example.test", subject: "1000002" }));
  assert.equal(editor.principal.role, "editor");
});

test("access: removing an account or changing its role applies to existing sessions", async () => {
  const existing = session();
  assert.equal((await access(existing)).principal.role, "owner");
  const removed = await access(existing, { ...env, ADMIN_ALLOWED_ACCOUNTS: "editor@example.test:editor" });
  assert.deepEqual(removed, { status: "forbidden", principal: null });
  const changed = await access(existing, { ...env, ADMIN_ALLOWED_ACCOUNTS: "owner@example.test:editor" });
  assert.equal(changed.principal.role, "editor");
  assert.equal(hasAdminRole(changed.principal, ["owner"]), false);
});

test("access: client-supplied roles and identities are ignored", async () => {
  const claimsOwner = session({ email: "intruder@example.test", role: "owner" }, { role: "owner", email: "owner@example.test" });
  assert.equal((await access(claimsOwner)).status, "forbidden");
  const ok = await access(session({ role: "owner" }, { role: "editor" }));
  assert.equal(ok.principal.role, "owner", "role comes only from ADMIN_ALLOWED_ACCOUNTS");
  // A principal-shaped object that getAdminAccess() did not issue grants nothing.
  const forged = Object.freeze({ subject: "1000001", email: "owner@example.test", name: null, role: "owner", authTime: NOW_S });
  assert.equal(hasAdminRole(forged), false);
  assert.throws(() => requireAdminRole(forged), AdminAccessDeniedError);
  assert.equal(requireAdminRole(ok.principal, ["owner"]), ok.principal);
  assert.throws(() => requireAdminRole(ok.principal, ["editor"]), AdminAccessDeniedError);
});

test("access: missing or malformed configuration is unavailable and never reads a session", async () => {
  let reads = 0;
  const readSession = async () => { reads += 1; return session(); };
  for (const broken of [{}, { ...env, ADMIN_ALLOWED_ACCOUNTS: "" }, { ...env, ADMIN_ALLOWED_ACCOUNTS: "owner@example.test:superuser" }, { ...env, AUTH_GOOGLE_SECRET: "" }]) {
    assert.deepEqual(await getAdminAccess({ env: broken, readSession, now: NOW, waitForRequest: outsideRequest }), { status: "unavailable", principal: null });
  }
  assert.equal(reads, 0);
});

test("access: Client Review flags, Vercel variables, and legacy cookies never grant admin access", async () => {
  const reviewEnv = { CLIENT_REVIEW_ENABLED: "true", CLIENT_REVIEW_LOCAL: "true", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev" };
  assert.equal((await access(null, { ...reviewEnv })).status, "unavailable");
  assert.equal((await access(null, { ...env, ...reviewEnv })).status, "unauthenticated");
  const cookieLike = { "__Host-sanpudam-cms-session": "v1.payload.signature", _vercel_jwt: "vercel.jwt.value", "authjs.session-token": "forged" };
  assert.equal((await access(cookieLike, { ...env, ...reviewEnv })).status, "unauthenticated");
  assert.equal(evaluateAdminSession(session(), readAuthConfig(reviewEnv)).status, "unavailable");
});

// ---- redirects -----------------------------------------------------------

test("redirects: only same-origin /admin destinations are allowed", () => {
  const allowed = [["/admin", `${ORIGIN}/admin`], ["/admin/login", `${ORIGIN}/admin/login`], [`${ORIGIN}/admin/x?y=1`, `${ORIGIN}/admin/x?y=1`]];
  for (const [url, expected] of allowed) assert.equal(safeAdminRedirect(url, ORIGIN), expected, url);
  const rejected = [
    "https://evil.example/admin", "//evil.example/admin", "/\\evil.example/admin", "\\\\evil.example/admin", "https:evil.example/admin",
    "javascript:alert(1)", "data:text/html,x", `${ORIGIN.replace("http:", "https:")}/admin`, "http://localhost:3000@evil.example/admin",
    "http://user:pass@localhost:3000/admin", "/news", "/", "/administrator", "/admin/../news", "", "http://localhost:3001/admin",
  ];
  for (const url of rejected) assert.equal(safeAdminRedirect(url, ORIGIN), `${ORIGIN}/admin`, url);
});

// ---- the real Auth.js pipeline -------------------------------------------

const discovery = {
  issuer: "https://accounts.google.com",
  authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  token_endpoint: "https://oauth2.googleapis.com/token",
  userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
  jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  code_challenge_methods_supported: ["S256"],
};
const fetched = [];
async function stubFetch(url) {
  fetched.push(String(url));
  if (String(url) === "https://accounts.google.com/.well-known/openid-configuration") return Response.json(discovery);
  throw new Error(`unexpected network request: ${url}`);
}

// next-auth reads AUTH_URL and AUTH_REDIRECT_PROXY_URL from process.env
// itself, so the pipeline tests set them for their duration only.
async function withProcessEnv(values, run) {
  const keys = ["AUTH_URL", "NEXTAUTH_URL", "AUTH_SECRET", "AUTH_REDIRECT_PROXY_URL", "AUTH_TRUST_HOST", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const pipeline = () => NextAuth(() => buildAuthJsConfig(readAuthConfig(env), { providerOptions: { [customFetch]: stubFetch } }));
const hostile = { host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" };
const cookieHeader = (response) => response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");

test("pipeline: sign-in uses AUTH_URL (not request headers), identity scopes, PKCE, and a sanitized callback", async () => {
  await withProcessEnv({ AUTH_URL: ORIGIN }, async () => {
    const { handlers } = pipeline();
    const csrfResponse = await handlers.GET(new NextRequest("https://evil.example/api/auth/csrf", { headers: hostile }));
    assert.equal(csrfResponse.status, 200);
    const { csrfToken } = await csrfResponse.json();
    assert.ok(csrfToken);

    const body = new URLSearchParams({ csrfToken, callbackUrl: "https://evil.example/steal" });
    const signInResponse = await handlers.POST(new NextRequest("https://evil.example/api/auth/signin/google", {
      method: "POST",
      body,
      headers: { ...hostile, "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader(csrfResponse) },
    }));
    assert.equal(signInResponse.status, 302);
    const location = new URL(signInResponse.headers.get("location"));
    assert.equal(location.origin + location.pathname, discovery.authorization_endpoint);
    assert.equal(location.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/callback/google`);
    assert.equal(location.searchParams.get("client_id"), env.AUTH_GOOGLE_ID);
    assert.equal(location.searchParams.get("scope"), "openid email profile");
    assert.equal(location.searchParams.get("response_type"), "code");
    assert.equal(location.searchParams.get("code_challenge_method"), "S256");
    assert.ok(location.searchParams.get("code_challenge"));
    assert.ok(location.searchParams.get("state"), "state check");
    assert.ok(location.searchParams.get("nonce"), "nonce check");
    for (const param of ["access_type", "prompt", "client_secret"]) assert.equal(location.searchParams.get(param), null, param);
    assert.ok(!location.href.includes("evil.example"));

    const cookies = signInResponse.headers.getSetCookie();
    const callback = cookies.find((cookie) => cookie.startsWith("authjs.callback-url="));
    assert.equal(decodeURIComponent(callback.split(";")[0].split("=")[1]), `${ORIGIN}/admin`);
    for (const name of ["authjs.pkce.code_verifier=", "authjs.state=", "authjs.nonce="]) {
      const cookie = cookies.find((value) => value.startsWith(name));
      assert.ok(cookie, name);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
    }
    assert.deepEqual(fetched.filter((url) => !url.endsWith("/.well-known/openid-configuration")), []);
  });
});

test("pipeline: sign-in without a CSRF token is refused", async () => {
  await withProcessEnv({ AUTH_URL: ORIGIN }, async () => {
    const { handlers } = pipeline();
    const response = await handlers.POST(new NextRequest(`${ORIGIN}/api/auth/signin/google`, {
      method: "POST",
      body: new URLSearchParams({ callbackUrl: "/admin" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }));
    assert.equal(response.status, 302);
    assert.ok(!response.headers.get("location").startsWith("https://accounts.google.com"), "no Google redirect without CSRF");
  });
});

test("pipeline: only a session token encrypted with AUTH_SECRET is accepted; it carries no role", async () => {
  await withProcessEnv({ AUTH_URL: ORIGIN }, async () => {
    const { handlers } = pipeline();
    const readSession = async (cookie) => {
      const response = await handlers.GET(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: cookie ? { cookie } : {} }));
      assert.equal(response.status, 200);
      return response.json();
    };
    const claims = { sub: "1000001", email: "owner@example.test", name: "Owner Test", provider: "google", authTime: Math.floor(Date.now() / 1000) - 60 };
    const valid = await encode({ token: claims, secret: SECRET, salt: "authjs.session-token", maxAge: MAX_SESSION_SECONDS });
    const otherSecret = await encode({ token: claims, secret: "another-test-secret-0123456789abcdefgh", salt: "authjs.session-token", maxAge: MAX_SESSION_SECONDS });
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.`;

    for (const cookie of [null, "authjs.session-token=garbage", `authjs.session-token=${otherSecret}`, `authjs.session-token=${unsigned}`, "__Host-sanpudam-cms-session=v1.payload.signature", "_vercel_jwt=vercel.jwt.value"]) {
      assert.equal(await readSession(cookie), null, cookie ?? "no cookie");
    }

    const accepted = await readSession(`authjs.session-token=${valid}`);
    assert.equal(accepted.identity.subject, "1000001");
    assert.ok(!JSON.stringify(accepted).includes("role"));
    // The real access decision on top of it, with the current allowlist.
    const decision = evaluateAdminSession(accepted, config);
    assert.equal(decision.status, "ok");
    assert.equal(decision.principal.role, "owner");

    // A token claiming a role for an unlisted email is still forbidden.
    const intruder = await encode({ token: { ...claims, email: "intruder@example.test", role: "owner" }, secret: SECRET, salt: "authjs.session-token", maxAge: MAX_SESSION_SECONDS });
    assert.equal(evaluateAdminSession(await readSession(`authjs.session-token=${intruder}`), config).status, "forbidden");
  });
});
