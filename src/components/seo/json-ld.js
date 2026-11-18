import { serializeJsonLd } from "@/lib/json-ld";

// Structured data (schema.org JSON-LD) built on the server from published
// records. This is the only use of dangerouslySetInnerHTML in the app; the
// payload comes from serializeJsonLd (JSON with "<" escaped).
export function JsonLd({ data }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
