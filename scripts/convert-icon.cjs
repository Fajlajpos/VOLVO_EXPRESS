const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function renderExactIcon() {
  const svgPath = path.join(__dirname, '../public/favicon.svg');
  const rawSvg = fs.readFileSync(svgPath, 'utf8');

  // Strip xml header / root svg tags if present and embed inside dark rounded square container
  const cleanSvgBody = rawSvg
    .replace(/^<\?xml[^>]*\?>/i, '')
    .replace(/^<svg[^>]*>/i, '')
    .replace(/<\/svg>$/i, '');

  const compositeSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0b0e14"/>
  <g transform="translate(64, 64) scale(6)">
    ${cleanSvgBody}
  </g>
</svg>`;

  const png512 = await sharp(Buffer.from(compositeSvg)).resize(512, 512).png().toBuffer();
  const png192 = await sharp(Buffer.from(compositeSvg)).resize(192, 192).png().toBuffer();
  const pngApple = await sharp(Buffer.from(compositeSvg)).resize(180, 180).png().toBuffer();

  fs.writeFileSync(path.join(__dirname, '../public/pwa-512x512.png'), png512);
  fs.writeFileSync(path.join(__dirname, '../public/pwa-192x192.png'), png192);
  fs.writeFileSync(path.join(__dirname, '../public/apple-touch-icon.png'), pngApple);

  console.log('EXACT favicon.svg converted to high resolution PWA PNG icons!');
}

renderExactIcon().catch((err) => {
  console.error(err);
  process.exit(1);
});
