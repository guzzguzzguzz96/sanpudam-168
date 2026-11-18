// Social link cleanup for display. Share links copied from apps carry
// tracking parameters (Facebook mibextid/fbclid, UTM tags, TikTok and
// YouTube share ids); they are removed from every rendered link, along with
// any fragment. Other query parameters are kept unchanged.

const TRACKING_PARAMS = /^(utm_[a-z_]+|mibextid|fbclid|igshid|igsh|si|feature|_t|_r|is_from_webapp|sender_device|share_app_id|share_link_id)$/i;

// url: a URL object that already passed host validation.
export function cleanSocialUrl(url) {
  const clean = new URL(url.href);
  const query = clean.searchParams;
  for (const key of [...query.keys()]) if (TRACKING_PARAMS.test(key)) query.delete(key);
  clean.hash = "";
  return clean.href;
}
