// Generate proper PWA icons as valid PNG files
// Run: node scripts/generate-icons.mjs

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));

function isInW(nx, ny) {
  if (ny < 0.25 || ny > 0.78 || nx < 0.15 || nx > 0.85) return false;
  const thickness = 0.08;
  const progress = (ny - 0.25) / (0.78 - 0.25);
  const l1 = 0.15 + progress * 0.2;
  if (Math.abs(nx - l1) < thickness) return true;
  const l2 = 0.35 + progress * 0.15;
  if (Math.abs(nx - l2) < thickness) return true;
  const r1 = 0.65 - progress * 0.15;
  if (Math.abs(nx - r1) < thickness) return true;
  const r2 = 0.85 - progress * 0.2;
  if (Math.abs(nx - r2) < thickness) return true;
  return false;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0);
  return Buffer.concat([length, typeBuffer, data, crcBuf]);
}

function createIcon(size) {
  const bgR = 37, bgG = 99, bgB = 235;
  const fgR = 255, fgG = 255, fgB = 255;

  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte: none
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      if (isInW(nx, ny)) {
        rawData.push(fgR, fgG, fgB);
      } else {
        rawData.push(bgR, bgG, bgB);
      }
    }
  }

  const compressed = deflateSync(Buffer.from(rawData));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdrData),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = join(__dirname, "..", "public", "icons");
mkdirSync(iconsDir, { recursive: true });

writeFileSync(join(iconsDir, "icon-192.png"), createIcon(192));
writeFileSync(join(iconsDir, "icon-512.png"), createIcon(512));

console.log("✓ Generated icon-192.png and icon-512.png");
