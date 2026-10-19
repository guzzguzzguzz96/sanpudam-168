// Media validation and hashing. Uses sharp, already installed with Next.js.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

// Magic-byte detection: the response must really be a supported file,
// not an HTML error page served with an image extension.
export function sniff(buffer) {
  const ascii = (start, end) => buffer.toString("ascii", start, end);
  if (buffer.length > 8 && buffer.readUInt32BE(0) === 0x89504e47) return { mime: "image/png", ext: "png" };
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buffer.length > 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return { mime: "image/gif", ext: "gif" };
  if (buffer.length > 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand.startsWith("avi")) return { mime: "image/avif", ext: "avif" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  const head = buffer.toString("utf8", 0, Math.min(buffer.length, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return { mime: "image/svg+xml", ext: "svg" };
  return null;
}

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
export const md5 = (buffer) => createHash("md5").update(buffer).digest("hex");

export async function describeImage(buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width ?? null,
    height: meta.height ?? null,
    format: meta.format ?? null,
    hasAlpha: meta.hasAlpha ?? false,
    hasExif: Boolean(meta.exif),
    density: meta.density ?? null,
  };
}

// 64-bit difference hash for near-duplicate detection.
export async function dhash(buffer) {
  const px = await sharp(buffer)
    .flatten({ background: "#ffffff" })
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export function hamming(a, b) {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}
