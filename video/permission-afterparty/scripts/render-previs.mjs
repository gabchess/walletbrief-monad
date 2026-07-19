#!/usr/bin/env node
/** Deterministic, offline compositor for the Permission Afterparty previs. */
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, '02-source');
const edit = resolve(root, '03-edit');
const frames = resolve(edit, 'frames');
const W = 1920;
const H = 1080;

mkdirSync(frames, {recursive: true});
rmSync(frames, {recursive: true, force: true});
mkdirSync(frames, {recursive: true});

const image = (relative) => `data:image/png;base64,${readFileSync(resolve(source, relative)).toString('base64')}`;
const venue = image('cinematic/afterparty-location-source-v1.png');
const live = image('product/walletbrief-live-snapshot.png');
const noActive = image('product/walletbrief-no-active-live.png');
const grant = image('product/monadvision-approval-grant.png');
const revoke = image('product/monadvision-approval-revoke.png');

const svg = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.72"/></filter>
  <filter id="glow"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#090611" stop-opacity="0.12"/><stop offset="1" stop-color="#06070a" stop-opacity="0.84"/></linearGradient>
  <style>text{font-family:Arial,Helvetica,sans-serif;fill:#f3f5f1}.kicker{font-size:24px;font-weight:700;letter-spacing:3px}.headline{font-size:66px;font-weight:800;letter-spacing:-2px}.small{font-size:22px;font-weight:600;letter-spacing:1px}.mono{font-family:Menlo,Consolas,monospace;font-size:18px;letter-spacing:0}</style>
</defs>${body}</svg>`;
const cover = (href, opacity = 1) => `<image href="${href}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" opacity="${opacity}"/>`;
const tag = (x, y, text, color = '#c9ff37') => `<g transform="translate(${x} ${y})"><rect x="0" y="-31" width="${text.length * 15 + 48}" height="46" rx="23" fill="#0a0d11" fill-opacity="0.90" stroke="${color}" stroke-opacity="0.78"/><circle cx="23" cy="-8" r="6" fill="${color}"/><text x="40" y="0" class="small" fill="${color}">${text}</text></g>`;
const wristband = (x, y, scale = 1, off = false) => `<g transform="translate(${x} ${y}) scale(${scale}) rotate(-12)" filter="url(#shadow)">
  <ellipse cx="0" cy="0" rx="220" ry="95" fill="none" stroke="${off ? '#45474b' : '#c9ff37'}" stroke-width="44" opacity="${off ? '.85' : '1'}" ${off ? '' : 'filter="url(#glow)"'}/>
  <ellipse cx="0" cy="0" rx="177" ry="60" fill="#101217" stroke="#e7ecdf" stroke-opacity=".28" stroke-width="4"/>
  <path d="M-42 -91 L58 -91 L78 -48 L-62 -48 Z" fill="${off ? '#383b3f' : '#eaff7f'}"/>
  <text x="-48" y="-63" class="mono" fill="#11170b">ALLOW</text>
</g>`;
const write = (index, body) => writeFileSync(resolve(frames, `frame-${index}.svg`), svg(body));

write(1, `${cover(venue)}<rect width="1920" height="1080" fill="url(#shade)"/>${tag(94, 105, 'METAPHOR · POST-PARTY VENUE')}<text x="92" y="890" class="headline">THE PARTY ENDS.</text><text x="95" y="930" class="small" fill="#c6ccc4">One permission can remain after the session.</text>${wristband(1290, 780, 1.2)}<path d="M125 830 l42 10 M183 760 l36 20 M1040 870 l38 14 M1120 918 l50 -7" stroke="#e7cc95" stroke-width="7" opacity=".45"/>`);

write(2, `${cover(venue)}<rect width="1920" height="1080" fill="url(#shade)"/><rect x="1110" y="210" width="540" height="650" rx="30" fill="#0b0e13" fill-opacity=".82" stroke="#bdc6c0" stroke-opacity=".48" stroke-width="6" filter="url(#shadow)"/><rect x="1200" y="340" width="360" height="410" rx="12" fill="#151a20" stroke="#c9ff37" stroke-width="10"/><rect x="1320" y="440" width="120" height="120" rx="60" fill="#c9ff37" filter="url(#glow)"/><path d="M1260 650 H1500 M1260 700 H1500" stroke="#c9ff37" stroke-width="8" opacity=".9"/><text x="1195" y="810" class="small" fill="#c9ff37">ACCESS READER · OPEN</text>${wristband(880, 570, .72)}${tag(94, 105, 'Wristband → reader')}<text x="92" y="900" class="headline">SOME PERMISSIONS DON'T.</text><text x="95" y="940" class="small" fill="#c6ccc4">The venue is empty. The access still works.</text>`);

write(3, `${cover(venue, .55)}<rect width="1920" height="1080" fill="#080a0d" fill-opacity=".66"/><circle cx="960" cy="526" r="310" fill="#0c1114" stroke="#c9ff37" stroke-width="24" filter="url(#glow)"/><circle cx="960" cy="526" r="236" fill="none" stroke="#8b5cf6" stroke-width="5" stroke-dasharray="14 24"/><circle cx="960" cy="526" r="180" fill="#10161a" stroke="#e8f0e7" stroke-opacity=".22" stroke-width="3"/><path d="M960 282 V350 M960 702 V770 M716 526 H784 M1136 526 H1204" stroke="#c9ff37" stroke-width="13"/><circle cx="960" cy="526" r="58" fill="#c9ff37"/><text x="870" y="540" class="kicker" fill="#11170b">SCAN</text>${tag(94, 105, 'MATCH CUT · SCANNER RING')}<text x="92" y="900" class="headline">FINDING IT SHOULDN'T BE GUESSWORK.</text><text x="95" y="940" class="small" fill="#c6ccc4">The ring becomes the WalletBrief address search.</text>`);

const screen = (href, x, y, w, h) => `<g filter="url(#shadow)"><rect x="${x-16}" y="${y-16}" width="${w+32}" height="${h+32}" rx="24" fill="#080b0f" stroke="#c9ff37" stroke-opacity=".58" stroke-width="4"/><image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></g>`;
write(4, `<rect width="1920" height="1080" fill="#080b0f"/><path d="M0 0 H1920 V1080 H0Z" fill="#8b5cf6" opacity=".11"/>${tag(92, 92, 'REAL PRODUCT · LIVE SNAPSHOT')}<text x="92" y="180" class="headline">PASTE ANY MONAD ADDRESS.</text><text x="95" y="220" class="small" fill="#c6ccc4">WalletBrief scans the address and resolves its live snapshot.</text>${screen(live, 165, 280, 1590, 700)}<text x="92" y="1035" class="mono" fill="#aeb8ad">SOURCE: walletbrief-live-snapshot.png · captured 2026-07-19</text>`);

write(5, `<rect width="1920" height="1080" fill="#080b0f"/><path d="M0 0 H1920 V1080 H0Z" fill="#8b5cf6" opacity=".11"/>${tag(92, 92, 'HISTORICAL ONCHAIN PROOF · NOT LIVE UI', '#b394ff')}<text x="92" y="180" class="headline">APPROVAL, THEN REVOKE.</text><text x="95" y="220" class="small" fill="#c6ccc4">Real explorer receipts establish the before-and-after. WalletBrief simulates before any owner signature.</text>${screen(grant, 90, 300, 830, 466)}${screen(revoke, 1000, 300, 830, 466)}<path d="M938 533 H978" stroke="#c9ff37" stroke-width="12"/><path d="M968 516 L990 533 L968 550" fill="none" stroke="#c9ff37" stroke-width="12"/><text x="305" y="830" class="kicker" fill="#c9ff37">01 · GRANT RECEIPT</text><text x="1195" y="830" class="kicker" fill="#c9ff37">02 · REVOKE RECEIPT</text><rect x="350" y="890" width="1220" height="82" rx="18" fill="#111820" stroke="#c9ff37" stroke-opacity=".5"/><text x="421" y="942" class="small" fill="#e5eee2">OWNER BOUNDARY: SIMULATE FIRST · SIGN ONLY WITH THE OWNING WALLET</text><text x="92" y="1035" class="mono" fill="#aeb8ad">SOURCES: monadvision-approval-grant.png + monadvision-approval-revoke.png</text>`);

write(6, `<rect width="1920" height="1080" fill="#080b0f"/><path d="M0 0 H1920 V1080 H0Z" fill="#8b5cf6" opacity=".11"/>${tag(92, 92, 'CURRENT LIVE STATE · NO ACTIVE APPROVALS')}<text x="92" y="180" class="headline">SEE WHAT STAYED AFTER THE PARTY.</text><text x="95" y="220" class="small" fill="#c6ccc4">Current WalletBrief result, shown alongside the historical revoke proof.</text>${screen(noActive, 150, 290, 1340, 754)}${wristband(1695, 830, .58, true)}<text x="1560" y="430" class="kicker" fill="#c9ff37">WALLETBRIEF</text><text x="1560" y="472" class="small" fill="#e2e8e1">SEE WHAT STAYED</text><text x="1560" y="502" class="small" fill="#e2e8e1">AFTER THE PARTY.</text><text x="92" y="1035" class="mono" fill="#aeb8ad">SOURCE: walletbrief-no-active-live.png · captured 2026-07-19</text>`);

for (let i = 1; i <= 6; i += 1) {
  // FFmpeg in this toolchain has no SVG decoder; Sharp/libvips is the installed deterministic rasterizer.
  await sharp(resolve(frames, `frame-${i}.svg`), {density: 144}).resize(W, H).png().toFile(resolve(frames, `frame-${i}.png`));
}
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', resolve(frames, 'frame-1.png'), '-i', resolve(frames, 'frame-2.png'), '-i', resolve(frames, 'frame-3.png'), '-i', resolve(frames, 'frame-4.png'), '-i', resolve(frames, 'frame-5.png'), '-i', resolve(frames, 'frame-6.png'), '-filter_complex', '[0:v]scale=640:360[a];[1:v]scale=640:360[b];[2:v]scale=640:360[c];[3:v]scale=640:360[d];[4:v]scale=640:360[e];[5:v]scale=640:360[f];[a][b][c]hstack=inputs=3[top];[d][e][f]hstack=inputs=3[bottom];[top][bottom]vstack=inputs=2', '-frames:v', '1', resolve(edit, 'previs-contact-sheet.png')]);
const concat = ['ffconcat version 1.0', 'file frames/frame-1.png', 'duration 3', 'file frames/frame-2.png', 'duration 5', 'file frames/frame-3.png', 'duration 4', 'file frames/frame-4.png', 'duration 9', 'file frames/frame-5.png', 'duration 10', 'file frames/frame-6.png', 'duration 8', 'file frames/frame-6.png'].join('\n');
writeFileSync(resolve(edit, 'animatic.ffconcat'), `${concat}\n`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', resolve(edit, 'animatic.ffconcat'), '-r', '30', '-frames:v', '1170', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(edit, 'permission-afterparty-previs-39s-silent.mp4')]);
