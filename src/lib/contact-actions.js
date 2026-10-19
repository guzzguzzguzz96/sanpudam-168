import { siteConfig } from "@/config/site";

// Single source for contact actions (LINE, Google Maps, phone). Each
// channel renders only when siteConfig holds a value that passes
// validation, so a mistyped or placeholder value never becomes a link.

const lineHosts = ["line.me", "lin.ee"];
const mapsHosts = ["maps.app.goo.gl", "maps.google.com", "goo.gl"];

function parseHttpsUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function hostMatches(host, allowed) {
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function getLineUrl(value) {
  const url = parseHttpsUrl(value);
  return url && hostMatches(url.hostname, lineHosts) ? url.href : null;
}

export function getMapsUrl(value) {
  const url = parseHttpsUrl(value);

  if (!url) {
    return null;
  }

  const isGoogleMapsPath =
    hostMatches(url.hostname, ["google.com", "google.co.th"]) &&
    url.pathname.startsWith("/maps");
  const isShortLink =
    hostMatches(url.hostname, mapsHosts) &&
    (url.hostname !== "goo.gl" || url.pathname.startsWith("/maps"));

  return isGoogleMapsPath || isShortLink ? url.href : null;
}

// Returns a tel: href, or null unless the value is a plausible number.
export function getPhoneHref(value) {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.trim().replace(/[\s().-]/g, "");
  return /^\+?\d{9,15}$/.test(compact) ? `tel:${compact}` : null;
}

const channels = {
  line: (config) => {
    const href = getLineUrl(config.lineInquiryUrl);
    return href
      ? {
          id: "line",
          href,
          label: "สอบถามทาง LINE",
          shortLabel: "LINE",
          external: true,
        }
      : null;
  },
  maps: (config) => {
    const href = getMapsUrl(config.directionsUrl);
    return href
      ? {
          id: "maps",
          href,
          // Non-breaking space keeps the "Google Maps" name on one line.
          label: "นำทางด้วย Google\u00A0Maps",
          shortLabel: "นำทาง",
          external: true,
        }
      : null;
  },
  phone: (config) => {
    const href = getPhoneHref(config.phoneNumber);
    return href
      ? {
          id: "phone",
          href,
          label: `โทร ${config.phoneNumber.trim()}`,
          shortLabel: "โทร",
          external: false,
        }
      : null;
  },
};

export const contactChannels = Object.keys(channels);

// Returns verified actions in the requested order.
export function getContactActions(
  include = contactChannels,
  config = siteConfig,
) {
  return include.map((channel) => channels[channel]?.(config)).filter(Boolean);
}
