# WalletBrief creative-ad workflow

Date: 2026-07-19  
Status: live product feasibility proof passed; public deployment verification pending. No generation credits spent.

This folder is the reproducible production record for WalletBrief's crypto-first launch film. It is written so Codex or Claude Code can resume without relying on chat history.

## Locked decisions

- Audience: crypto users first; hackathon judges are a secondary audience.
- Distribution master: X and YouTube, 1920×1080, 16:9, 30 fps.
- Desired response: shareable, creative, memorable, while proving the product is real.
- Product truth: use the live WalletBrief UI and live Monad data. Never generate wallet UI, addresses, allowances, transaction states, or explorer evidence.
- Creative shape: a short cinematic metaphor for invisible token approvals, followed by a deterministic real-product reveal and safe revoke proof.
- Provider split: Higgsfield may generate cinematic or UGC source shots. Remotion/HyperFrames own UI, typography, diagrams, captions, and motion. FFmpeg owns conformance, audio finishing, and encoded-master QA.
- Publishing boundary: stop at QA-passed masters plus ready-to-post copy and links. Do not publish or submit.

## Canonical artifacts

- Product: <https://walletbrief-production.up.railway.app>
- Repository: <https://github.com/gabchess/walletbrief-monad>
- Research synthesis: `../research/2026-07-19-walletbrief-creative-ad-research.md`
- Production ledger: `02-workflow-ledger.md`
- Creative brief: `03-creative-brief.md`
- Product rescue plan: `../superpowers/plans/2026-07-19-walletbrief-rescue.md`

## Production state machine

1. **Product proof, passed locally:** arbitrary address returns useful Monad data quickly; indexed approvals avoid sequential RPC windows; connected-owner revoke simulates before signature.
2. **Concept gate:** approve one metaphor, hook, promise, and CTA before any generation.
3. **Previsualization gate:** approve six storyboard frames and a timed animatic.
4. **Motion prototype gate:** generate only the selected cinematic shots at 720p, changing one variable per retry.
5. **Cut-only gate:** assemble the metaphor, live product capture, and CTA with no captions, music, or finishing.
6. **Motion/caption gate:** add deterministic product motion and hand-authored captions only after the cut passes.
7. **Sound gate:** add intentional music, tactile SFX, dialogue/VO treatment, and ducking.
8. **Master QA:** watch the complete 16:9 master; verify picture, audio, sync, text, product truth, duration, and encode.

Every paid step requires an explicit cost quote and approval. Variant farming is prohibited.

## Resume checklist

1. Retrieve `HYPERSYNC_BEARER_TOKEN` from macOS Keychain service `walletbrief-hypersync`; never print or write it to a file.
2. Deploy the proven adapter and secret to Railway, then verify the public arbitrary-wallet path.
3. Present two or three concept directions and obtain one explicit human choice.
4. Do not create a storyboard or spend generation credits before that concept gate passes.

## Arcana and house-rule findings

The Arcana Wiki query returned five relevant rules:

- `video-workflow-architecture`: Creative-Film is HyperFrames plus multiple generation backends, not a single-model pipeline.
- `website-to-hyperframes-production-discipline`: render from the composition folder, use relative assets, and declare fonts explicitly.
- `hyperframes-audio-contract`: every VO, SFX, and music file must be a root-level declarative audio clip or the render can be silent.
- `sarah-pipeline-split`: split authoring from VO/render when three or more compositions require narration.
- `heygen-avatar-video-pipeline`: preserve the two-phase cut-only → overlay gate, even though this film is not an avatar-led product educator.

The locked Product Educator Pipeline v2 contributes two transferable rules: the real product remains the visual evidence, and manual midpoint-frame review is mandatory because ffprobe cannot catch a semantically wrong callout.
