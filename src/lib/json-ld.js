// Serializes schema.org JSON-LD for a <script type="application/ld+json">.
// "<" is escaped as \u003c, so no value can close the script element or
// inject markup; the JSON stays valid.
export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
