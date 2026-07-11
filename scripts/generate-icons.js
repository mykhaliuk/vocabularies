// Generates the app icon set in public/ from the brand logo mark
// (public/logo-mark.svg is the visual reference; path data is inlined here
// so each variant can recompose background, scale, and safe-zone padding).
//
// Outputs:
//   favicon.svg              vector tab icon (bookmark glyph, transparent bg)
//   favicon.ico              16+32 PNG-compressed ICO fallback
//   apple-touch-icon.png     180x180 opaque, iOS applies its own corner mask
//   icon-192.png/512.png     manifest icons, purpose "any" (rounded card)
//   icon-maskable-192.png/512.png  manifest icons, purpose "maskable" (full
//                            bleed, mark kept inside the 80% safe zone)
//
// Usage: node scripts/generate-icons.js  (or `bun run icons:gen`)

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const PUBLIC_DIR = resolve(import.meta.dirname, '../public');

const PAPER = '#FBFEFF';
const ROSE = '#ED5379';
const ROSE_SPINE = '#F26B8C';

const BOOKMARK_BODY =
  'M40 28h40a8 8 0 0 1 8 8v54.6a3 3 0 0 1-4.7 2.46L62 80.2a4 4 0 ' +
  '0 0-4.6 0L36.7 93.06A3 3 0 0 1 32 90.6V36a8 8 0 0 1 8-8Z';
const BOOKMARK_SPINE = 'M40 28h40a8 8 0 0 1 8 8v6H32v-6a8 8 0 0 1 8-8Z';
const HEART =
  'M60 67.5l-.93-.83c-3.3-2.94-5.47-4.88-5.47-7.26a3.6 3.6 0 0 1 ' +
  '3.65-3.6c1.18 0 2.31.55 2.75 1.36.44-.81 1.57-1.36 2.75-1.36a3.6 ' +
  '3.6 0 0 1 3.65 3.6c0 2.38-2.18 4.32-5.47 7.27l-.93.82Z';

const markGroup = (scale = 1) => `
  <g transform="translate(60 60) scale(${scale}) translate(-60 -60)">
    <path d="${BOOKMARK_BODY}" fill="${ROSE}"/>
    <path d="${BOOKMARK_SPINE}" fill="${ROSE_SPINE}"/>
    <g transform="translate(60 61) scale(1.32) translate(-60 -61)">
      <path d="${HEART}" fill="#FFFFFF"/>
    </g>
  </g>`;

const svgDocument = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

// Bookmark glyph only, square viewBox tight around the mark: at tab sizes
// the paper card would shrink the glyph to illegibility.
const faviconSvg = svgDocument('25.5 25.5 69 69', markGroup());

// Rounded paper card, same look as logo-mark.svg — manifest purpose "any".
const anyIconSvg = svgDocument(
  '0 0 120 120',
  `<rect width="120" height="120" rx="30" fill="${PAPER}"/>${markGroup()}`,
);

// Full-bleed paper background; the mark at scale 1 stays inside the
// maskable 80% safe-zone circle (max corner radius ~42 < 48).
const fullBleedSvg = svgDocument(
  '0 0 120 120',
  `<rect width="120" height="120" fill="${PAPER}"/>${markGroup()}`,
);

// iOS rounds and never composites transparency, so opaque + slightly
// larger mark than the maskable variant (no mask cropping to survive).
const appleTouchSvg = svgDocument(
  '0 0 120 120',
  `<rect width="120" height="120" fill="${PAPER}"/>${markGroup(1.12)}`,
);

const renderPng = async (page, svg, size) => {
  await page.setViewportSize({ width: size, height: size });
  const html =
    '<!doctype html><style>*{margin:0}svg{display:block;' +
    `width:${size}px;height:${size}px}</style>${svg}`;
  await page.setContent(html);
  return page.screenshot({ type: 'png', omitBackground: true });
};

// ICO container with PNG-compressed entries (supported by all modern
// browsers): ICONDIR header + one ICONDIRENTRY per image + raw PNG data.
const buildIco = (entries) => {
  const headerSize = 6 + 16 * entries.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = headerSize;
  entries.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map((e) => e.png)]);
};

const main = async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    const targets = [
      { file: 'icon-192.png', svg: anyIconSvg, size: 192 },
      { file: 'icon-512.png', svg: anyIconSvg, size: 512 },
      { file: 'icon-maskable-192.png', svg: fullBleedSvg, size: 192 },
      { file: 'icon-maskable-512.png', svg: fullBleedSvg, size: 512 },
      { file: 'apple-touch-icon.png', svg: appleTouchSvg, size: 180 },
    ];
    for (const { file, svg, size } of targets) {
      const png = await renderPng(page, svg, size);
      await writeFile(resolve(PUBLIC_DIR, file), png);
      console.log(`wrote public/${file}`);
    }

    const icoSizes = [16, 32];
    const icoEntries = [];
    for (const size of icoSizes) {
      const png = await renderPng(page, faviconSvg, size);
      icoEntries.push({ size, png });
    }
    await writeFile(resolve(PUBLIC_DIR, 'favicon.ico'), buildIco(icoEntries));
    console.log('wrote public/favicon.ico');

    await writeFile(resolve(PUBLIC_DIR, 'favicon.svg'), `${faviconSvg}\n`);
    console.log('wrote public/favicon.svg');
  } finally {
    await browser.close();
  }
};

await main();
