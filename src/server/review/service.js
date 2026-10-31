import "server-only";
import { sanitizeError } from "../../lib/db.js";
import { createContentService } from "../cms/content-service.js";
import { createReviewAccessPolicy } from "../cms/review-access.js";
import { readReviewDatabaseConfig, readReviewPolicy } from "./config.js";
import { connectReviewDatabase } from "./connection.js";
import { buildReviewHomepage, loadReviewHomepageContent } from "./homepage.js";

// Client Review homepage loader. Returns one of:
//   { status: "disabled" }                    review mode is off: render the
//                                             normal homepage, no query ran
//   { status: "unavailable", reason }         review mode is on but content
//                                             cannot be read (missing review
//                                             credentials, connection or
//                                             privilege failure, all sections
//                                             failing). Never sample content.
//   { status: "ok", ...view }                 see buildReviewHomepage()
//
// The policy is checked again here at request time, before configuration
// is read or any connection is opened. Read-only throughout.

export async function loadReviewHomepage({ env = process.env, connect = connectReviewDatabase, logger = console } = {}) {
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
    const { models } = await connect(config);
    const service = createContentService({ models, connect: async () => {}, sanitize, logger });
    const view = buildReviewHomepage(await loadReviewHomepageContent(service.withReviewAccess(grant)));
    return view.status === "ok" ? view : { status: "unavailable", reason: "query_failed" };
  } catch (error) {
    logger.error(`[review] content unavailable: ${sanitize(error).message}`);
    return { status: "unavailable", reason: "connection_failed" };
  }
}
