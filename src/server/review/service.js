import "server-only";
import { sanitizeError } from "../../lib/db.js";
import { createContentService } from "../cms/content-service.js";
import { createReviewAccessPolicy } from "../cms/review-access.js";
import { readReviewDatabaseConfig, readReviewPolicy } from "./config.js";
import { connectReviewDatabase } from "./connection.js";
import { buildReviewHomepage, loadReviewHomepageContent } from "./homepage.js";

// Opens the review repositories. Returns one of:
//   { status: "disabled" }                    review mode is off; no query ran
//   { status: "unavailable", reason }         review mode is on but content
//                                             cannot be read (missing review
//                                             credentials, connection or
//                                             privilege failure)
//   { status: "ok", repositories }            review-scope repositories
//
// The policy is checked again here at request time, before configuration
// is read or any connection is opened. Read-only throughout.
export async function openReviewRepositories({ env = process.env, connect = connectReviewDatabase, logger = console } = {}) {
  let grant;
  try {
    grant = createReviewAccessPolicy({ evaluate: () => readReviewPolicy(env) }).requestGrant();
  } catch {
    return { status: "disabled" };
  }

  const config = readReviewDatabaseConfig(env);
  if (config.problems.length) {
    logger.error(`[review] content unavailable: ${config.problems.join("; ")}`);
    return { status: "unavailable", reason: "not_configured" };
  }

  const sanitize = (error) => sanitizeError(error, config.uri);
  try {
    // Custom DNS resolvers are a local-machine workaround only.
    const { models } = await connect({ ...config, dnsServers: grant.mode === "local" ? config.dnsServers : null });
    const service = createContentService({ models, connect: async () => {}, sanitize, logger });
    return { status: "ok", repositories: service.withReviewAccess(grant) };
  } catch (error) {
    logger.error(`[review] content unavailable: ${sanitize(error).message}`);
    return { status: "unavailable", reason: "connection_failed" };
  }
}

// Client Review homepage: { status: "disabled" | "unavailable" } as above,
// "unavailable" also when every section fails, or { status: "ok", ...view }
// (see buildReviewHomepage). Never sample content.
export async function loadReviewHomepage(options = {}) {
  const opened = await openReviewRepositories(options);
  if (opened.status !== "ok") return opened;
  const view = buildReviewHomepage(await loadReviewHomepageContent(opened.repositories));
  return view.status === "ok" ? view : { status: "unavailable", reason: "query_failed" };
}
