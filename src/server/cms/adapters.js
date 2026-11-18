import "server-only";
import { getLineUrl } from "../../lib/contact-actions.js";

// Small formatting helpers shared by the site view builders
// (src/server/review/homepage.js, src/server/site/pages.js).
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

// "2026-10-29" -> "29 ตุลาคม 2569" (date-only; no timezone shift).
export function formatThaiDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

// LINE official account id ("@name") -> add-friend URL; full URLs are
// validated as-is. Anything else yields null.
export function lineUrlFromId(lineId) {
  const value = text(lineId);
  if (!value) return null;
  if (value.startsWith("https://")) return getLineUrl(value);
  if (!/^@?[A-Za-z0-9._-]{3,30}$/.test(value)) return null;
  const id = value.startsWith("@") ? value : `@${value}`;
  return getLineUrl(`https://line.me/R/ti/p/${encodeURIComponent(id)}`);
}
