import { readFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const MEDIA = import.meta.dirname;
const TMP = join(MEDIA, '..', '.tmp-gif-frames');

// Animation: opacity goes 1 -> 0.1 -> 1 over 0.8s
// 16 frames at 50ms each = 0.8s total
const FRAME_COUNT = 16;
const FRAME_DELAY_CS = 5; // centiseconds for gifsicle (50ms)

function opacityAtFrame(i) {
  // values="1;0.1;1" linear interpolation over FRAME_COUNT frames
  const t = i / FRAME_COUNT;
  if (t < 0.5) {
    return 1.0 - (1.0 - 0.1) * (t / 0.5);
  } else {
    return 0.1 + (1.0 - 0.1) * ((t - 0.5) / 0.5);
  }
}

async function makeGif(svgFile, gifFile) {
  const sharp = (await import('sharp')).default;
  const svg = readFileSync(join(MEDIA, svgFile), 'utf8');

  mkdirSync(TMP, { recursive: true });

  const gifFramePaths = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const opacity = opacityAtFrame(i).toFixed(3);
    const frameSvg = svg
      .replace(/<animate[^/]*\/>/g, '')
      .replace(
        /(<rect x="38" y="210" width="12" height="3"[^>]*?)>/,
        `$1 opacity="${opacity}">`
      );

    const pngPath = join(TMP, `frame-${String(i).padStart(3, '0')}.png`);
    await sharp(Buffer.from(frameSvg))
      .resize(256, 256)
      .png()
      .toFile(pngPath);

    const gifPath = join(TMP, `frame-${String(i).padStart(3, '0')}.gif`);
    await sharp(pngPath).gif().toFile(gifPath);
    gifFramePaths.push(gifPath);
  }

  const outPath = join(MEDIA, gifFile);
  const args = gifFramePaths.map(p => `"${p}"`).join(' ');
  execSync(
    `gifsicle --loop --delay=${FRAME_DELAY_CS} --colors 256 --optimize=3 ${args} -o "${outPath}"`,
    { stdio: 'inherit' }
  );

  console.log(`Created ${outPath}`);
}

try {
  await makeGif('icon-color.svg', 'icon-color.gif');
  await makeGif('icon-color-geo.svg', 'icon-color-geo.gif');
  await makeGif('icon-color-flat.svg', 'icon-color-flat.gif');
  await makeGif('icon-color-geo-flat.svg', 'icon-color-geo-flat.gif');
} finally {
  rmSync(TMP, { recursive: true, force: true });
}
