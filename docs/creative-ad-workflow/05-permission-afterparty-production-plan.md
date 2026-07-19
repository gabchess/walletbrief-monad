# WalletBrief Permission Afterparty Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Preserve all approval gates and the no-publish boundary.

**Goal:** Produce one QA-passed 35–40 second, 1920×1080, 30 fps WalletBrief launch film for X and YouTube that uses a cinematic wristband metaphor, proves the live Monad product, and ends with ready-to-post copy without publishing or submitting it.

**Architecture:** Higgsfield creates only the three approved cinematic source frames and two short motion inserts. The real WalletBrief site and Monad explorer provide all product evidence. Remotion/HyperFrames own typography, captions, match cuts, timing, and end card; FFmpeg owns audio conformance, finishing, and technical QA. Every paid operation and retained asset is logged.

**Tech Stack:** Higgsfield MCP, Chromium capture, Remotion/React, HyperFrames patterns, FFmpeg/ffprobe, Vitest, TypeScript.

## Global constraints

- Do not publish, post, submit, or upload the final master to a public destination.
- Do not generate product UI, wallet addresses, transaction data, captions, logos, or CTA text.
- Do not create paid variants. One approved still and one approved motion attempt per planned shot.
- Preserve provider originals and browser captures as immutable sources.
- Use the locked 93-word narration exactly; do not use automatic translation or paraphrase it.
- Keep the HyperSync token, wallet secrets, and private provider identifiers out of source, screenshots, logs, render props, and the vault.
- Do not send a mainnet transaction without a separate exact transaction preview and explicit approval.
- Stop at each human gate: previs, source/product proof, rough cut, motion/captions, sound, and master QA.

## Task 1: Create and validate the production contract

**Files:**

- Create: `video/permission-afterparty/project.json`
- Create: `video/permission-afterparty/decision-log.jsonl`
- Create: `video/permission-afterparty/00-brief/creative-brief.md`
- Create: `video/permission-afterparty/01-script/narration.md`
- Create: `video/permission-afterparty/01-script/beat-sheet.json`
- Create: `video/permission-afterparty/02-source/source-manifest.json`

- [ ] Run the Product Educator scaffold with channel `x`, presenter mode `hybrid`, duration mode `social`, language `en-US`, and 30 fps.
- [ ] Copy the approved creative promise, locked narration, beat timings, no-publish boundary, and cost discipline into the production contract.
- [ ] Record the clean repository baseline: 162 tests passed, 1 skipped; build passed.
- [ ] Run `validate_project.py --stage scaffold` and resolve every blocking error.

## Task 2: Build the six-frame previsualization

**Files:**

- Create: `video/permission-afterparty/03-edit/storyboard.json`
- Create: `video/permission-afterparty/03-edit/animatic-edl.json`
- Create: `video/permission-afterparty/03-edit/previs-contact-sheet.png`
- Create: `video/permission-afterparty/02-source/higgsfield-generation-ledger.jsonl`

- [ ] Inspect the live Higgsfield image and video model schemas and record the selected models, settings, and exact costs.
- [ ] Generate exactly one 16:9 post-party venue still with no people, brands, or text.
- [ ] Derive the gate and scanner-ring frames deterministically from the approved still when that preserves continuity; use another paid still only after explicit approval.
- [ ] Capture three real 1920×1080 product frames: search/live snapshot, active-approval/simulation proof, and no-active/explorer proof.
- [ ] Compose exactly six storyboard frames and a timed 39-second silent animatic.
- [ ] Play the complete animatic and stop for the previs gate.

## Task 3: Produce clean source media

**Files:**

- Create: `video/permission-afterparty/02-source/cinematic/`
- Create: `video/permission-afterparty/02-source/product/`
- Create: `video/permission-afterparty/02-source/voice/`
- Update: `video/permission-afterparty/02-source/source-manifest.json`
- Update: `video/permission-afterparty/02-source/higgsfield-generation-ledger.jsonl`

- [ ] Animate two restrained 4–5 second 720p Higgsfield inserts from the approved start frame: empty-venue push and wristband/gate unlock. Generate native audio off.
- [ ] Download each completed provider render, hash it, inspect it at full duration, and reject text, logos, continuity errors, implausible object changes, or visual artifacts.
- [ ] Capture the real WalletBrief product flow at or above 1920×1080 with notifications and irrelevant browser chrome removed.
- [ ] Use historical verified grant/revoke evidence unless a separate mainnet transaction approval is granted.
- [ ] Generate one continuous narration take with Gabe's already approved voice clone. Do not retrain or reclone.
- [ ] Verify narration duration, audible audio, word fidelity, pronunciation, clipping, and noise.
- [ ] Play every clean source in sequence and stop for the source/product-proof gate.

## Task 4: Build the deterministic rough cut

**Files:**

- Create: `video/permission-afterparty/remotion/package.json`
- Create: `video/permission-afterparty/remotion/src/Root.tsx`
- Create: `video/permission-afterparty/remotion/src/PermissionAfterparty.tsx`
- Create: `video/permission-afterparty/remotion/src/timing.ts`
- Create: `video/permission-afterparty/03-edit/rough-cut.mp4`
- Create: `video/permission-afterparty/03-edit/rough-cut-report.md`

- [ ] Assemble the 39-second 1920×1080, 30 fps composition with narration and picture only.
- [ ] Match-cut the scanner ring into the real WalletBrief address field before 12 seconds.
- [ ] Keep generated footage to metaphor beats and product footage to factual claims.
- [ ] Verify no duplicate footage, repeated dialogue, gaps, overlaps, stale placeholders, or A/V drift.
- [ ] Play the full rough cut and stop for the cut gate.

## Task 5: Add motion graphics and captions

**Files:**

- Create: `video/permission-afterparty/04-motion/captions.json`
- Create: `video/permission-afterparty/04-motion/motion-spec.md`
- Create: `video/permission-afterparty/04-motion/motion-cut.mp4`
- Update: `video/permission-afterparty/remotion/src/PermissionAfterparty.tsx`

- [ ] Hand-author English caption timings from the locked narration.
- [ ] Render sentence-case captions with one or two lines, translucent black backing, and a 10% bottom safe margin.
- [ ] Add deterministic `THE PARTY ENDS.`, `SOME PERMISSIONS DON'T.`, and the WalletBrief end card.
- [ ] Use fast ease-out entrances, one focal point per beat, sequential metrics, and anticipation before the owner action; no elastic UI or fake screenshot parallax.
- [ ] Play the complete motion/caption cut and stop for the motion gate.

## Task 6: Design and mix sound

**Files:**

- Create: `video/permission-afterparty/05-audio/audio-sources.md`
- Create: `video/permission-afterparty/05-audio/mix-notes.md`
- Create: `video/permission-afterparty/05-audio/mix.wav`
- Create: `video/permission-afterparty/05-audio/mix-cut.mp4`

- [ ] Source or create one intentional afterparty music cue and the minimum scanner, click, data-sweep, gate, and confirmation effects.
- [ ] Record source URLs, creators, license terms, download dates, and retained asset paths before use.
- [ ] Align structural cuts to transients and duck music under every spoken line.
- [ ] Conform narration and mix to intelligible social-video loudness without clipping.
- [ ] Play and listen to the complete mix and stop for the sound gate.

## Task 7: Export and verify the master

**Files:**

- Create: `video/permission-afterparty/exports/walletbrief-permission-afterparty-master.mp4`
- Create: `video/permission-afterparty/06-qa/technical-report.json`
- Create: `video/permission-afterparty/06-qa/visual-qa.md`
- Create: `video/permission-afterparty/06-qa/transcript-check.md`
- Create: `video/permission-afterparty/07-handoff/ready-to-post-copy.md`

- [ ] Render H.264/AAC at 1920×1080, 30 fps, 16:9, with a 35–40 second duration.
- [ ] Run ffprobe checks for dimensions, frame rate, duration, codecs, audio stream, and sync.
- [ ] Extract midpoint stills for every semantic beat and inspect captions, UI truth, text safety, and generated-artifact risk.
- [ ] Transcribe the exported master and compare every spoken line to the locked script.
- [ ] Scan the repository and render artifacts for credentials and private provider identifiers.
- [ ] Rotate the exposed HyperSync token and redeploy before final submission; record only the rotation proof, never the secret.
- [ ] Play the complete exported MP4 and stop for the master gate.
- [ ] Prepare humanized X/YouTube copy and public product/repository links. Do not post them.

## Verification commands

Run from `/Users/gava/projects/walletbrief-monad/.worktrees/public-rescue`:

```bash
npm test
npm run build
python3 /Users/gava/.agents/skills/product-educator-video/scripts/validate_project.py --stage delivery video/permission-afterparty
ffprobe -v error -show_entries format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of json video/permission-afterparty/exports/walletbrief-permission-afterparty-master.mp4
git diff --check
git status --short
```
