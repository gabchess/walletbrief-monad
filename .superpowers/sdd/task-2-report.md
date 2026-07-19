# Task 2 implementation report — Permission Afterparty previs

## Result

Completed a deterministic, offline six-frame 1920×1080 previsualization, contact sheet, and 39-second silent animatic. The retained Higgsfield plate is used only as a venue/environment background. Wristband, reader/gate, and scanner ring are SVG vector composites; no new generated imagery, UI, addresses, or fabricated product proof were created.

## Files changed

- `video/permission-afterparty/scripts/render-previs.mjs` — reproducible Node/Sharp/FFmpeg compositor.
- `video/permission-afterparty/03-edit/storyboard.json` — six-frame source/provenance/timing inventory.
- `video/permission-afterparty/03-edit/animatic-edl.json` and `animatic.ffconcat` — exact 39-second / 1,170-frame edit definition.
- `video/permission-afterparty/03-edit/frames/frame-{1..6}.svg` and `.png` — six storyboard frames, each 1920×1080.
- `video/permission-afterparty/03-edit/previs-contact-sheet.png` — 3×2 contact sheet.
- `video/permission-afterparty/03-edit/permission-afterparty-previs-39s-silent.mp4` — silent H.264 animatic.

## Exact commands and results

```sh
node video/permission-afterparty/scripts/render-previs.mjs
```

Result: exit 0. The script rasterized all six deterministic SVG composites using installed Sharp/libvips, wrote the contact sheet, and encoded the silent animatic with installed FFmpeg.

```sh
node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('video/permission-afterparty/03-edit/storyboard.json'));const e=JSON.parse(fs.readFileSync('video/permission-afterparty/03-edit/animatic-edl.json')); if(s.frames.length!==6) throw Error('storyboard frame count'); if(e.duration_seconds!==39||e.duration_frames!==1170||e.segments.length!==6) throw Error('EDL'); for(const x of s.frames) if(!fs.existsSync('video/permission-afterparty/03-edit/'+x.file)) throw Error(x.file); console.log('storyboard: 6 frames; EDL: 39s / 1170 frames')"
```

Result: `storyboard: 6 frames; EDL: 39s / 1170 frames`.

```sh
ffmpeg -v error -i video/permission-afterparty/03-edit/permission-afterparty-previs-39s-silent.mp4 -f null -
```

Result: exit 0, full decode successful.

```sh
sha256sum video/permission-afterparty/02-source/cinematic/afterparty-location-source-v1.png video/permission-afterparty/02-source/product/*.png
```

Result: all five hashes exactly match `02-source/source-manifest.json`, confirming immutable sources were not altered.

## ffprobe evidence

```json
{
  "streams": [{
    "codec_name": "h264",
    "codec_type": "video",
    "width": 1920,
    "height": 1080,
    "r_frame_rate": "30/1",
    "nb_frames": "1170"
  }],
  "format": {"duration": "39.000000"}
}
```

There is only one video stream and no audio stream, as required for a silent animatic.

## Self-review

- The contact sheet was visually inspected. Frames 1–3 read wristband → access reader → scanner ring before the product proof begins.
- Frames 4 and 6 contain the supplied live WalletBrief captures. Frame 5 contains the supplied historical grant and revoke explorer receipts, explicitly labeled as historical proof rather than current UI.
- The owner/signature language is an editorial deterministic label; it does not impersonate product UI or assert that the historical receipt was created in-frame.
- The active source files and the Higgsfield-generation ledger were left unchanged.

## Concerns

None for the previs gate. This is intentionally a silent hold-frame animatic; timing and semantic framing are ready for approval, but motion generation, narration, captions, music, and final production QA remain downstream work.

## Commit

Implementation artifacts commit: `e836d4b1f54e0cb775af6d6d0b0118fa4a658eb6`.
