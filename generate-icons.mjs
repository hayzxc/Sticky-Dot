import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const check = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  buf.writeUInt32BE(crc32(check), 8 + len);
  return buf;
}

function generateIconPNG(size) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc(height * (1 + width * 4));

  // Visual design:
  // Rounded sticky note card (yellow #FFF4A3, border #E6D76A), with a distinct colored dot (emerald/teal #10B981) in the top right or center
  const pad = Math.max(1, Math.round(size * 0.08));
  const radius = Math.max(2, Math.round(size * 0.18));
  const dotRadius = Math.max(1.5, size * 0.16);
  const dotCenterX = size - pad - Math.max(2, size * 0.22);
  const dotCenterY = pad + Math.max(2, size * 0.22);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      // Check if inside rounded rectangle
      const inX = x >= pad && x < width - pad;
      const inY = y >= pad && y < height - pad;

      let inCard = false;
      let onBorder = false;

      // Distance to card bounds
      const left = pad;
      const right = width - pad - 1;
      const top = pad;
      const bottom = height - pad - 1;

      if (x >= left && x <= right && y >= top && y <= bottom) {
        // Check corner radius
        const inCornerTL = x < left + radius && y < top + radius;
        const inCornerTR = x > right - radius && y < top + radius;
        const inCornerBL = x < left + radius && y > bottom - radius;
        const inCornerBR = x > right - radius && y > bottom - radius;

        let d2 = 0;
        if (inCornerTL) {
          d2 = (x - (left + radius)) ** 2 + (y - (top + radius)) ** 2;
        } else if (inCornerTR) {
          d2 = (x - (right - radius)) ** 2 + (y - (top + radius)) ** 2;
        } else if (inCornerBL) {
          d2 = (x - (left + radius)) ** 2 + (y - (bottom - radius)) ** 2;
        } else if (inCornerBR) {
          d2 = (x - (right - radius)) ** 2 + (y - (bottom - radius)) ** 2;
        }

        if (!inCornerTL && !inCornerTR && !inCornerBL && !inCornerBR) {
          inCard = true;
          if (x === left || x === right || y === top || y === bottom) onBorder = true;
        } else if (d2 <= radius * radius) {
          inCard = true;
          if (d2 >= (radius - 1) * (radius - 1)) onBorder = true;
        }
      }

      // Check if inside dot
      const distToDot2 = (x - dotCenterX) ** 2 + (y - dotCenterY) ** 2;
      const inDot = distToDot2 <= dotRadius * dotRadius;
      const onDotBorder = distToDot2 <= dotRadius * dotRadius && distToDot2 >= (dotRadius - 1) * (dotRadius - 1);

      if (inDot) {
        // Emerald / teal dot #10B981
        if (onDotBorder && size >= 32) {
          raw[offset++] = 0x05; raw[offset++] = 0x96; raw[offset++] = 0x69; raw[offset++] = 255;
        } else {
          raw[offset++] = 0x10; raw[offset++] = 0xb9; raw[offset++] = 0x81; raw[offset++] = 255;
        }
      } else if (inCard) {
        if (onBorder) {
          // #E6D76A
          raw[offset++] = 0xe6; raw[offset++] = 0xd7; raw[offset++] = 0x6a; raw[offset++] = 255;
        } else {
          // Note body: #FFF4A3 with slight horizontal note line at size >= 32
          const isLine = size >= 32 && (y === Math.round(height * 0.52) || y === Math.round(height * 0.70)) && x >= left + 3 && x <= right - 3;
          if (isLine) {
            raw[offset++] = 0xf0; raw[offset++] = 0xe2; raw[offset++] = 0x88; raw[offset++] = 255;
          } else {
            raw[offset++] = 0xff; raw[offset++] = 0xf4; raw[offset++] = 0xa3; raw[offset++] = 255;
          }
        }
      } else {
        // Transparent
        raw[offset++] = 0; raw[offset++] = 0; raw[offset++] = 0; raw[offset++] = 0;
      }
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idatData = zlib.deflateSync(raw);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve('src/icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const buf = generateIconPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buf);
  console.log(`Generated icon-${size}.png (${buf.length} bytes)`);
}
