import "server-only";

// Display hints for specific media assets (docs/client-review-mode.md §14).
// The CMS has no image-fit field, and media categories cannot tell an
// isolated object from a photograph, so these hints are presentation data
// kept here instead of in the database. Nothing is written to MongoDB or
// Cloudinary.
//
// Keys are Cloudinary public ids without the "sanpudam168/<env>/legacy/"
// prefix, so the same asset matches in any environment. Assets not listed
// use the default: fit "cover" (scene photography).
//
//   contain + white matte    object cut out on a plain white background
//                            (verified: border pixels uniform, near white)
//   contain + neutral matte  posters, newsletters, and infographics whose
//                            whole frame carries content

const CUTOUT = Object.freeze({ fit: "contain", matte: "white" });
const POSTER = Object.freeze({ fit: "contain", matte: "neutral" });
const DEFAULT = Object.freeze({ fit: "cover", matte: null });

const HINTS = Object.freeze({
  "shrine/sacred-objects/pu-dam-168-statue": CUTOUT,
  "events/2569-03-16-tra-phaendin-ceremony-newsletter-a": POSTER,
  "events/2569-03-16-tra-phaendin-ceremony-newsletter-b": POSTER,
  "editorial/infographics/tra-phaendin-infographic": POSTER,
  "sacred-items/coin-charoenlap-charoenyot/poster": POSTER,
});

export function mediaPresentation(publicId) {
  if (typeof publicId !== "string") return DEFAULT;
  const key = publicId.replace(/^sanpudam168\/[a-z0-9-]+\/legacy\//, "");
  return HINTS[key] ?? DEFAULT;
}
