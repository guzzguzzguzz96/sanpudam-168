// Source and target safety for the staging-to-production promotion. Fails
// closed: any doubt stops the run before a connection is made, and nothing
// here returns or prints a connection string.
import { databaseInUri } from "./db-target.mjs";

export const STAGING_DATABASE = "sanpudam168_staging";
export const PRODUCTION_DATABASE = "sanpudam168_production";

const isMongoUri = (value) => /^mongodb(\+srv)?:\/\//.test(value);

// Staging is read with the Client Review account (built-in read role on
// sanpudam168_staging only; checked again after connecting).
export function resolvePromotionSource(env = process.env) {
  const uri = env.CLIENT_REVIEW_MONGODB_URI?.trim();
  const dbName = env.CLIENT_REVIEW_MONGODB_DB_NAME?.trim();
  if (!uri || !isMongoUri(uri)) throw new Error("CLIENT_REVIEW_MONGODB_URI must be set to the read-only staging connection string.");
  if (dbName !== STAGING_DATABASE) throw new Error(`CLIENT_REVIEW_MONGODB_DB_NAME must be exactly ${STAGING_DATABASE}.`);
  const inUri = databaseInUri(uri);
  if (inUri && inUri !== STAGING_DATABASE) throw new Error("CLIENT_REVIEW_MONGODB_URI names a different database; refusing the ambiguous source.");
  return { uri, dbName };
}

// The only write target: sanpudam168_production, through the promotion
// writer account. required=false (dry run) returns null when unset.
export function resolvePromotionTarget(env = process.env, { required = true, confirmDb = null, requireConfirmation = false } = {}) {
  const uri = env.PROMOTION_MONGODB_URI?.trim();
  const dbName = env.PROMOTION_MONGODB_DB_NAME?.trim();
  if (!uri && !dbName && !required) return null;
  if (!uri || !isMongoUri(uri)) throw new Error("PROMOTION_MONGODB_URI must be set to the production promotion writer connection string.");
  if (dbName !== PRODUCTION_DATABASE) throw new Error(`PROMOTION_MONGODB_DB_NAME must be exactly ${PRODUCTION_DATABASE}; nothing else is ever written.`);
  const inUri = databaseInUri(uri);
  if (inUri && inUri !== PRODUCTION_DATABASE) throw new Error("PROMOTION_MONGODB_URI names a different database; refusing the ambiguous target.");
  if (env.CLIENT_REVIEW_MONGODB_URI && env.CLIENT_REVIEW_MONGODB_URI.trim() === uri) throw new Error("The promotion writer must be a different account from the staging reader.");
  if (requireConfirmation && confirmDb !== PRODUCTION_DATABASE) throw new Error(`Apply requires --confirm-db=${PRODUCTION_DATABASE}.`);
  return { uri, dbName };
}

// connectionStatus roles (no user names) of the staging reader: exactly the
// built-in read role on staging.
export function assertStagingReader(roles) {
  if (!Array.isArray(roles) || !roles.length) throw new Error("The staging account has no verifiable roles.");
  if (roles.some((r) => r.role !== "read" || r.db !== STAGING_DATABASE)) throw new Error(`The staging account must hold only read@${STAGING_DATABASE}.`);
}

// The writer may hold roles on the production database only (never on
// staging, admin, or any other database).
export function assertProductionWriter(roles) {
  if (!Array.isArray(roles) || !roles.length) throw new Error("The promotion writer has no verifiable roles.");
  const foreign = roles.filter((r) => r.db !== PRODUCTION_DATABASE);
  if (foreign.length) throw new Error(`The promotion writer may hold roles on ${PRODUCTION_DATABASE} only.`);
}
