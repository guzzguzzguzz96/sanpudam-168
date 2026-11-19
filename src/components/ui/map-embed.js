import { isAllowedMapEmbedUrl } from "@/config/map-embed";

// Embedded Google Maps for the homepage and /visit. Fills the existing map
// box (.home-visit__map): size, radius, and clipping come from CSS, so the
// box keeps its height on mobile and desktop and nothing shifts when the
// map loads. Renders nothing unless src is an allowed embed URL.
export function MapEmbed({ src, name = null }) {
  if (!isAllowedMapEmbedUrl(src)) return null;
  return (
    <div className="home-visit__map home-visit__map--embed">
      <iframe
        allowFullScreen
        className="home-visit__map-frame"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={src}
        title={`แผนที่ Google Maps ตำแหน่ง${name ?? "ศาล"}`}
      />
    </div>
  );
}
