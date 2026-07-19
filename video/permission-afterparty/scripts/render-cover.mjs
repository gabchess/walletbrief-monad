#!/usr/bin/env node
/** Render the Spark submission cover from an accepted actor frame. */
import {execFileSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, '02-source/actor-film/finals/01-party-exit-1080p.mp4');
const outDir = resolve(root, '07-handoff');
const frame = resolve(outDir, '.walletbrief-cover-frame.png');
const output = resolve(outDir, 'walletbrief-cover.webp');

mkdirSync(outDir, {recursive: true});
execFileSync('ffmpeg', [
  '-y', '-v', 'error', '-ss', '4.2', '-i', source, '-frames:v', '1',
  '-vf', 'scale=1600:900:flags=lanczos', frame
], {stdio: 'inherit'});

const overlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#080908" stop-opacity=".86"/>
      <stop offset=".36" stop-color="#080908" stop-opacity=".42"/>
      <stop offset=".62" stop-color="#080908" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      text{font-family:Inter,Arial,sans-serif;fill:#f4f2ec}
      .wordmark{font-size:76px;font-weight:800;letter-spacing:-3px}
      .title{font-size:27px;font-weight:760;letter-spacing:4px}
      .label{font-size:20px;font-weight:700;letter-spacing:2px}
    </style>
  </defs>
  <rect width="1600" height="900" fill="url(#shade)"/>
  <circle cx="100" cy="105" r="36" fill="none" stroke="#b8f13f" stroke-width="10" filter="url(#glow)"/>
  <path d="M84 105h32" stroke="#b8f13f" stroke-width="10" stroke-linecap="round"/>
  <text x="76" y="220" class="wordmark">WalletBrief</text>
  <text x="80" y="274" class="title" fill="#b8f13f">THE PERMISSION AFTERPARTY</text>
  <text x="80" y="832" class="label">BUILT FOR MONAD</text>
</svg>`);

await sharp(frame)
  .composite([{input: overlay}])
  .webp({quality: 92, smartSubsample: true})
  .toFile(output);

rmSync(frame, {force: true});
console.log(output);
