#!/usr/bin/env node
/**
 * Build SellerBase brand icons from SVG source.
 *
 * Tries renderers in this order:
 *  1. sharp (Node)
 *  2. ImageMagick `convert` CLI
 *  3. Python + cairosvg + Pillow (fallback used in CI/sandbox)
 *
 * Outputs into apps/web/public/branding/ + branding/sellerbase.ico
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const brandingDir = resolve(repoRoot, 'apps/web/public/branding');
const rootBrandingDir = resolve(repoRoot, 'branding');
const masterSvg = resolve(brandingDir, 'icon.svg');
const maskableSvg = resolve(brandingDir, 'icon-maskable.svg');

if (!existsSync(brandingDir)) mkdirSync(brandingDir, { recursive: true });
if (!existsSync(rootBrandingDir)) mkdirSync(rootBrandingDir, { recursive: true });

// Generate maskable variant with 80% safe-zone (SB shrunk, bg full-bleed square)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="0" y="0" width="512" height="512" fill="#0B0F17"/>
  <g transform="translate(256 256) scale(0.8) translate(-256 -256)">
    <rect x="0" y="0" width="512" height="512" rx="96" ry="96" fill="#0B0F17"/>
    <text x="256" y="256" text-anchor="middle" dominant-baseline="central"
          font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          font-weight="800" font-size="260" letter-spacing="-10.4" fill="#FFFFFF">SB</text>
    <circle cx="424" cy="424" r="24" fill="#10B981"/>
  </g>
</svg>
`;
writeFileSync(maskableSvg, maskable);

function has(cmd) {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

const renderQueue = [
  { src: masterSvg, out: resolve(brandingDir, 'icon-512.png'), size: 512 },
  { src: masterSvg, out: resolve(brandingDir, 'icon-192.png'), size: 192 },
  { src: maskableSvg, out: resolve(brandingDir, 'icon-maskable-512.png'), size: 512 },
  { src: masterSvg, out: resolve(brandingDir, 'apple-touch-icon.png'), size: 180 },
  { src: masterSvg, out: resolve(brandingDir, 'favicon-32.png'), size: 32 },
  { src: masterSvg, out: resolve(brandingDir, 'favicon-16.png'), size: 16 },
  { src: masterSvg, out: resolve(brandingDir, 'favicon-48.png'), size: 48 },
];

async function renderWithSharp() {
  const sharp = (await import('sharp')).default;
  for (const { src, out, size } of renderQueue) {
    await sharp(readFileSync(src)).resize(size, size).png().toFile(out);
    console.log(`sharp -> ${out}`);
  }
}

function renderWithImagemagick() {
  for (const { src, out, size } of renderQueue) {
    execSync(`convert -background none -density 1024 "${src}" -resize ${size}x${size} "${out}"`);
    console.log(`imagemagick -> ${out}`);
  }
}

function renderWithPython() {
  const script = `
import cairosvg, sys
from PIL import Image
import io, os
jobs = ${JSON.stringify(renderQueue.map(({ src, out, size }) => ({ src, out, size })))}
for j in jobs:
    png = cairosvg.svg2png(url=j['src'], output_width=j['size'], output_height=j['size'])
    with open(j['out'], 'wb') as f:
        f.write(png)
    print('python ->', j['out'])

# favicon.ico (multi-size 16/32/48)
ico_path = os.path.join("${brandingDir}", "favicon.ico")
img48 = Image.open(os.path.join("${brandingDir}", "favicon-48.png"))
img48.save(ico_path, format='ICO', sizes=[(16,16),(32,32),(48,48)])
print('python -> ' + ico_path)

# copy ico to root branding for windows shortcut
import shutil
shutil.copyfile(ico_path, os.path.join("${rootBrandingDir}", "sellerbase.ico"))
print('copied -> ${rootBrandingDir}/sellerbase.ico')
`;
  const r = spawnSync('python3', ['-c', script], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('python render failed');
}

async function buildIcoFromPngs() {
  // Used only for sharp/imagemagick paths; python path builds ICO inline.
  const png48 = resolve(brandingDir, 'favicon-48.png');
  const icoOut = resolve(brandingDir, 'favicon.ico');
  if (has('convert')) {
    execSync(`convert "${resolve(brandingDir, 'favicon-16.png')}" "${resolve(brandingDir, 'favicon-32.png')}" "${png48}" "${icoOut}"`);
  } else {
    // fallback: python Pillow
    const script = `from PIL import Image; Image.open("${png48}").save("${icoOut}", format='ICO', sizes=[(16,16),(32,32),(48,48)])`;
    spawnSync('python3', ['-c', script], { stdio: 'inherit' });
  }
  execSync(`cp "${icoOut}" "${resolve(rootBrandingDir, 'sellerbase.ico')}"`);
  console.log(`ico -> ${icoOut} + ${rootBrandingDir}/sellerbase.ico`);
}

(async () => {
  try {
    await renderWithSharp();
    await buildIcoFromPngs();
    return;
  } catch (e) {
    console.log('sharp unavailable:', e.message);
  }
  if (has('convert')) {
    renderWithImagemagick();
    await buildIcoFromPngs();
    return;
  }
  if (has('python3')) {
    renderWithPython();
    return;
  }
  throw new Error('No renderer available (sharp/imagemagick/python+cairosvg)');
})();
