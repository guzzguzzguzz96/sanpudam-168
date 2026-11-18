import { connection } from "next/server";
import { handlers } from "@/server/auth/auth";
import { readAuthConfig, reportAuthConfigProblems } from "@/server/auth/config";

// Auth.js endpoints (sign-in, Google callback, sign-out, session, CSRF).
// Evaluated per request; while admin sign-in is not configured every
// endpoint answers 404, so no partial or mock login exists.

async function handle(request, method) {
  await connection();
  const config = readAuthConfig(process.env);
  if (!config.enabled) {
    reportAuthConfigProblems(config);
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
  return handlers[method](request);
}

export function GET(request) {
  return handle(request, "GET");
}

export function POST(request) {
  return handle(request, "POST");
}
