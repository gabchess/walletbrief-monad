#!/usr/bin/env node
/** Deterministic 1920x1080 final compositor for The Permission Afterparty. */
import {execFileSync} from 'node:child_process';
import {accessSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = resolve(root, '02-source');
const edit = resolve(root, '03-edit');
const audio = resolve(root, '05-audio');
const out = resolve(root, '07-handoff');
const work = resolve(edit, 'final-assets');
const captionsDir = resolve(work, 'captions');
const W = 1920;
const H = 1080;
const FPS = 30;
const DURATION = 1192 / FPS;

mkdirSync(out, {recursive: true});
rmSync(work, {recursive: true, force: true});
mkdirSync(captionsDir, {recursive: true});

const paths = {
  party: resolve(source, 'actor-film/finals/01-party-exit-1080p.mp4'),
  morning: resolve(source, 'actor-film/finals/02-morning-discovery-1080p.mp4'),
  resolution: resolve(source, 'actor-film/finals/03-resolution-1080p.mp4'),
  live: resolve(source, 'product/walletbrief-live-snapshot.png'),
  result: resolve(source, 'product/walletbrief-no-active-live.png'),
  proof: resolve(source, 'product/monadvision-approval-revoke.png'),
  narration: resolve(audio, 'gabe-permission-afterparty-conformed-v1.wav'),
  partyAudio: resolve(source, 'actor-film/tests/01-party-exit-720p-fast-v2.mp4'),
  morningAudio: resolve(source, 'actor-film/tests/02-morning-discovery-720p-fast.mp4'),
  resolutionAudio: resolve(source, 'actor-film/tests/03-resolution-720p-fast.mp4')
};

for (const [name, path] of Object.entries(paths)) {
  try { accessSync(path); } catch { throw new Error(`Missing ${name}: ${path}`); }
}

const run = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], {stdio: 'inherit'});
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const svg = (body) => Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000" flood-opacity=".68"/></filter>
  <filter id="glow"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <style>
    text{font-family:Inter,Arial,sans-serif;fill:#f4f2ec}
    .wordmark{font-size:88px;font-weight:800;letter-spacing:-4px}
    .title{font-size:54px;font-weight:760;letter-spacing:-1.5px}
    .label{font-size:20px;font-weight:760;letter-spacing:2.6px}
    .body{font-size:28px;font-weight:560}
    .mono{font-family:Menlo,Consolas,monospace;font-size:18px}
  </style>
</defs>${body}</svg>`);

const panelOverlay = (label, title, detail) => svg(`
  <rect x="0" y="0" width="1920" height="1080" fill="#0d0d0c" fill-opacity=".20"/>
  <rect x="68" y="60" width="1784" height="112" rx="24" fill="#0d0d0c" fill-opacity=".92" filter="url(#shadow)"/>
  <circle cx="112" cy="116" r="10" fill="#b8f13f" filter="url(#glow)"/>
  <text x="140" y="123" class="label" fill="#b8f13f">${esc(label)}</text>
  <text x="1110" y="112" class="body" text-anchor="end">${esc(title)}</text>
  <text x="1786" y="112" class="mono" text-anchor="end" fill="#989895">${esc(detail)}</text>
  <rect x="52" y="44" width="1816" height="992" rx="32" fill="none" stroke="#b8f13f" stroke-opacity=".38" stroke-width="3"/>
`);

const liveFrame = resolve(work, 'product-live.png');
await sharp(paths.live)
  .resize(W, H, {fit: 'cover'})
  .modulate({brightness: 0.82, saturation: 0.92})
  .composite([{input: panelOverlay('LIVE MONAD CHECK', 'Paste any address.', 'WALLETBRIEF')}])
  .png().toFile(liveFrame);

const resultFrame = resolve(work, 'product-result.png');
await sharp(paths.result)
  .resize(W, H, {fit: 'cover'})
  .modulate({brightness: 0.84, saturation: 0.94})
  .composite([{input: panelOverlay('LIVE WALLET RESULT', 'Balances, activity, and approval state.', 'CHECKED ONCHAIN')}])
  .png().toFile(resultFrame);

const proofFrame = resolve(work, 'product-proof.png');
await sharp(paths.proof)
  .resize(W, H, {fit: 'cover'})
  .modulate({brightness: 0.84, saturation: 0.94})
  .composite([{input: panelOverlay('HISTORICAL ONCHAIN PROOF', 'Revoke confirmed: approve 0 WMON.', 'MONADVISION')}])
  .png().toFile(proofFrame);

const endCard = resolve(work, 'end-card.png');
await sharp(svg(`
  <rect width="1920" height="1080" fill="#0d0d0c"/>
  <circle cx="960" cy="272" r="72" fill="none" stroke="#b8f13f" stroke-width="18" filter="url(#glow)"/>
  <path d="M930 272 h60" stroke="#b8f13f" stroke-width="18" stroke-linecap="round"/>
  <text x="960" y="510" class="wordmark" text-anchor="middle">WalletBrief</text>
  <text x="960" y="590" class="title" text-anchor="middle">See what stayed after the party.</text>
  <text x="960" y="674" class="body" text-anchor="middle" fill="#989895">walletbrief-production.up.railway.app</text>
  <text x="960" y="930" class="label" text-anchor="middle" fill="#b8f13f">BUILT FOR MONAD</text>
`)).png().toFile(endCard);

const captionCues = JSON.parse(readFileSync(resolve(edit, 'final-captions.json'), 'utf8'));
for (let i = 0; i < captionCues.length; i += 1) {
  const cue = captionCues[i];
  const lines = cue.lines;
  const maxChars = Math.max(...lines.map((line) => line.length));
  const width = Math.min(1650, Math.max(520, maxChars * 24 + 110));
  const height = lines.length === 1 ? 76 : 126;
  const x = (W - width) / 2;
  const y = H - height - 58;
  const text = lines.map((line, lineIndex) => `<text x="960" y="${y + 50 + lineIndex * 49}" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="650" fill="#ffffff" text-anchor="middle">${esc(line)}</text>`).join('');
  const overlay = svg(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="#050505" fill-opacity=".82"/>${text}`);
  await sharp(overlay).png().toFile(resolve(captionsDir, `caption-${String(i + 1).padStart(2, '0')}.png`));
}

const encodeVideo = (input, output, frames, filter, loop = false) => run([
  ...(loop ? ['-loop', '1', '-framerate', String(FPS)] : []), '-i', input,
  '-an', '-vf', filter, '-frames:v', String(frames), '-r', String(FPS),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-g', '60', '-movflags', '+faststart', output
]);

encodeVideo(paths.party, resolve(work, '01-party.mp4'), 243,
  'scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=0.2,trim=duration=8.1,setpts=PTS-STARTPTS,fps=30,format=yuv420p');
encodeVideo(paths.morning, resolve(work, '02-morning.mp4'), 259,
  'scale=2304:1296:flags=lanczos,crop=1920:1080:0:108,trim=duration=8.633333,setpts=PTS-STARTPTS,fps=30,format=yuv420p');
encodeVideo(liveFrame, resolve(work, '03a-product-search.mp4'), 75,
  "scale=2048:1152:flags=lanczos,zoompan=z='min(zoom+0.00014,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p", true);
encodeVideo(resultFrame, resolve(work, '03b-product-result.mp4'), 156,
  "scale=2048:1152:flags=lanczos,zoompan=z='min(zoom+0.00016,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p", true);
encodeVideo(paths.resolution, resolve(work, '04-resolution.mp4'), 243,
  'scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=0.2,trim=duration=8.1,setpts=PTS-STARTPTS,fps=30,format=yuv420p');
encodeVideo(proofFrame, resolve(work, '05-product-proof.mp4'), 120,
  "scale=2048:1152:flags=lanczos,zoompan=z='min(zoom+0.00018,1.018)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p", true);
encodeVideo(endCard, resolve(work, '06-end-card.mp4'), 96,
  "scale=1920:1080:flags=lanczos,zoompan=z='min(zoom+0.00022,1.014)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,fade=t=in:st=0:d=0.22,format=yuv420p", true);

const concat = ['ffconcat version 1.0', ...['01-party.mp4','02-morning.mp4','03a-product-search.mp4','03b-product-result.mp4','04-resolution.mp4','05-product-proof.mp4','06-end-card.mp4'].map((file) => `file '${file}'`)].join('\n');
const concatPath = resolve(work, 'final.ffconcat');
writeFileSync(concatPath, `${concat}\n`);
const silent = resolve(work, 'picture-silent.mp4');
run(['-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', silent]);

const pulse = resolve(audio, 'permission-pulse-original.wav');
run([
  '-f', 'lavfi', '-i', `sine=frequency=48:sample_rate=48000:duration=${DURATION}`,
  '-f', 'lavfi', '-i', `sine=frequency=96:sample_rate=48000:duration=${DURATION}`,
  '-f', 'lavfi', '-i', `anoisesrc=color=pink:amplitude=.018:sample_rate=48000:duration=${DURATION}`,
  '-filter_complex', '[0:a]tremolo=f=1.6:d=.84,volume=.10[a0];[1:a]tremolo=f=3.2:d=.74,volume=.028[a1];[2:a]highpass=f=4300,lowpass=f=9000,tremolo=f=3.2:d=.93,volume=.022[a2];[a0][a1][a2]amix=inputs=3:normalize=0,lowpass=f=11000,afade=t=in:st=0:d=1.2,afade=t=out:st=31.8:d=4.5[a]',
  '-map', '[a]', '-c:a', 'pcm_s24le', pulse
]);

const mixed = resolve(work, 'mixed-no-captions.mp4');
run([
  '-i', silent, '-i', paths.narration, '-i', pulse, '-i', paths.partyAudio, '-i', paths.morningAudio, '-i', paths.resolutionAudio,
  '-filter_complex',
  '[1:a]loudnorm=I=-15.4:TP=-1.2:LRA=7[voice];' +
  '[2:a]volume=.55[pulse];' +
  '[3:a]atrim=0:8.1,asetpts=PTS-STARTPTS,volume=.17[party];' +
  '[4:a]atrim=0:8.633333,asetpts=PTS-STARTPTS,adelay=8100|8100,volume=.13[morning];' +
  '[5:a]atrim=0:8.1,asetpts=PTS-STARTPTS,adelay=24433|24433,volume=.15[resolution];' +
  '[voice][pulse][party][morning][resolution]amix=inputs=5:duration=longest:dropout_transition=0,loudnorm=I=-16:TP=-1:LRA=9[mix]',
  '-map', '0:v:0', '-map', '[mix]', '-frames:v', '1192', '-t', String(DURATION), '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', mixed
]);

const captionInputs = captionCues.flatMap((_, i) => ['-loop', '1', '-framerate', String(FPS), '-i', resolve(captionsDir, `caption-${String(i + 1).padStart(2, '0')}.png`)]);
let previous = '[0:v]';
const filters = [];
for (let i = 0; i < captionCues.length; i += 1) {
  const cue = captionCues[i];
  const next = `[v${i + 1}]`;
  filters.push(`${previous}[${i + 1}:v]overlay=0:0:enable='between(t,${cue.start},${cue.end})'${next}`);
  previous = next;
}
const master = resolve(out, 'walletbrief-permission-afterparty-master.mp4');
run([
  '-i', mixed, ...captionInputs, '-filter_complex', filters.join(';'), '-map', previous, '-map', '0:a:0',
  '-frames:v', '1192', '-t', String(DURATION), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '60',
  '-c:a', 'copy', '-movflags', '+faststart', master
]);

run(['-i', master, '-vf', 'fps=1/4,scale=640:360,tile=5x2', '-frames:v', '1', resolve(out, 'walletbrief-permission-afterparty-contact-sheet.png')]);
console.log(master);
