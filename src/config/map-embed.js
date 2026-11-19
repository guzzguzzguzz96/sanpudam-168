// Owner-confirmed Google Maps embed for the shrine (exact place, not a text
// search). Single source of truth for the map on the homepage and /visit.
// Shown only on the public site and only while the published contact block
// is owner-verified (contact.verified === true); Client Review keeps its
// placeholder. Pure and dependency-free, so server builders, components,
// and tests share it.
//
// Change it only when the owner confirms a new embed, with the date.

// Supplied by the owner on 2026-11-19 (Google Maps → Share → Embed a map).
// Kept verbatim; do not re-encode.
export const OWNER_CONFIRMED_MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3875.5880934293764!2d100.49462369999999!3d13.743370099999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e299dcfc86f94b%3A0xdd43e1f925c44216!2z4Lio4Liy4Lil4Lib4Li54LmI4LiU4LizMTY4LeC4leC4o-C4suC5geC4nOC5iOC4meC4lOC4tOC4mQ!5e0!3m2!1sen!2sth!4v1795100442717!5m2!1sen!2sth";

// Only Google Maps "Embed a map" URLs: https, host exactly www.google.com,
// path exactly /maps/embed, with a non-empty pb parameter. No credentials,
// no custom port. Anything else (other hosts, /maps?q= searches, http,
// javascript:, empty) is rejected and the map is not rendered.
export function isAllowedMapEmbedUrl(value) {
  if (typeof value !== "string" || !value) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== "www.google.com" || url.port || url.username || url.password) return false;
  if (url.pathname !== "/maps/embed") return false;
  return Boolean(url.searchParams.get("pb"));
}
