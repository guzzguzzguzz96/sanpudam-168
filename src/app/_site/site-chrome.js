import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import { getContactActions } from "@/lib/contact-actions";
import { getSiteChrome } from "@/server/site";

// Public header and footer from the published site settings (cached; see
// src/server/site/public.js). Name, logo, and the contact summary come from
// the record; phone, LINE, and Maps actions appear only for verified,
// validated values. On any non-"ok" result they render exactly like the
// static header and footer (siteConfig, no contact actions).

function brandOf(chrome) {
  if (chrome.status !== "ok" || !chrome.brand) return null;
  return { name: chrome.brand.name ?? siteConfig.localName, descriptor: siteConfig.name, logo: chrome.brand.logo };
}

const actionsOf = (chrome, channels) => (chrome.status === "ok" && chrome.contactConfig ? getContactActions(channels, chrome.contactConfig) : null);

export async function PublicSiteHeader() {
  const chrome = await getSiteChrome();
  return <SiteHeader brand={brandOf(chrome)} actions={actionsOf(chrome, ["line", "maps"])} />;
}

export async function PublicSiteFooter() {
  const chrome = await getSiteChrome();
  return <SiteFooter brand={brandOf(chrome)} actions={actionsOf(chrome, ["line", "phone", "maps"])} contact={chrome.status === "ok" ? chrome.footer : null} />;
}
