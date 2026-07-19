# WalletBrief creative-ad workflow ledger

This ledger records decisions, evidence, costs, failures, and resumption state. Append entries; do not silently rewrite history.

## 2026-07-19 — product rescue baseline

- Working branch: `feat/spark-finish`
- Checkpoint commit: `85756da feat: add public wallet rescue spike`
- Implemented: arbitrary-address search, live MON/WMON/transaction/block summary, indexed approval adapter, approval API, injected-wallet revoke with mandatory simulation-before-write, and the public search/result UI.
- Verification at checkpoint: 161 tests passed, 1 skipped; typecheck passed; web build passed; 16 Forge tests passed; Forge format/build passed with pre-existing lint notes.
- Hosted product and verified mainnet executor remain the product evidence. The public service does not hold a wallet private key.

## 2026-07-19 — creative research

- Read the 15 supplied HeyGen/Higgsfield sources and synthesized them in `../research/2026-07-19-walletbrief-creative-ad-research.md`.
- Rejected template-first URL-to-ad as the hero-film architecture because WalletBrief has no physical hero object and generated UI would weaken trust.
- Selected architecture for concept development: one cinematic metaphor → real product reveal → deterministic safe-action proof.
- Cost: 0 generation credits.
- Human decision: audience locked to crypto users first; output should be shareable, creative, and memorable.

## 2026-07-19 — Arcana memory query

- Queried `/Users/gava/Obsidian/Arcana Wiki/arcana-wiki/index.md` for video workflow, Creative-Film, HyperFrames, ads, and product-video concepts.
- Read the relevant full pages: `video-workflow-architecture`, `heygen-avatar-video-pipeline`, `website-to-hyperframes-production-discipline`, `hyperframes-audio-contract`, and `sarah-pipeline-split`.
- Read the locked `Product-Educator-Video-Pipeline-v2.md` workflow for transferable gates only. This ad remains a distinct creative-film workflow.
- Resulting rule: generated footage expresses the metaphor; deterministic tools express the product truth.

## 2026-07-19 — HyperSync provisioning

- Gabe enabled HyperSync for package `gabchess` in Envio.
- Envio status reported: “HyperSync enabled. Tokens will appear shortly.”
- Local Keychain service: `walletbrief-hypersync`.
- Secret-handling rule: the token is copied directly into macOS Keychain and never pasted into chat, committed, written into the vault, or printed by verification commands.
- Token name in Envio: `Prod`.
- Keychain presence verified without printing the token.

## 2026-07-19 — live feasibility proof

- First run failed honestly: the adapter decoded HyperSync as `data.logs`, while the live API returns chunked `data[].logs`.
- A read-only exact-block diagnostic proved the known WMON Approval event was present at block `88,133,622` and transaction `0x880e68918c5852e4e62da078063469a2d3aa44c1dcc220ffc5ed7dd65eb3a10f`.
- Fixed the response decoder to flatten the live chunk shape and added a regression test using that structure.
- Targeted approval tests: 7 passed. Typecheck: passed.
- Corrected live proof: arbitrary-wallet snapshot returned in `701 ms` at block `88,805,231` with five transactions.
- HyperSync returned two exact seeded-pair events: the grant and later revoke. Current active approvals correctly resolved to zero.
- Revoke simulation completed in `130 ms` for exact `approve(spender, 0)` calldata. No transaction was sent.
- Feasibility verdict: all three load-bearing technical claims passed locally. Public Railway verification remains.

## Pending evidence

- Human-approved creative concept, storyboard, animatic, cut, sound mix, and final master.

## 2026-07-19 — public deployment proof

- Railway deployment: `6edc786a-fdd0-40a8-9a5a-c4e3db7aaeba`, status `SUCCESS`.
- Public health: HTTP `200`, Monad chain `143`, `0.477 s` request time.
- Public approvals API: HTTP `200`, exact demo wallet returned `{"approvals":[]}` in `1.413 s`.
- Public arbitrary-wallet page: HTTP `200`; server-rendered snapshot returned in `222 ms` during the curl proof and `177 ms` during the browser pass.
- Browser QA: live MON/WMON/transaction/block values rendered; indexed approval scan resolved to “No active ERC-20 approvals found”; zero browser console errors.
- Public GitHub `main`: `57402d9`, clean rewritten history preserved; deployed source and tested rescue tree are byte-equivalent.
- Product feasibility verdict: PASS. The next gate is creative concept selection, not more product engineering.

## Cost ledger

| Date | Provider | Action | Cost | Status |
|---|---|---|---:|---|
| 2026-07-19 | Higgsfield | Creative-ad generation | 0 credits | Not started |
| 2026-07-19 | Envio | HyperSync provisioning | No paid generation spend | Enabled; live proof passed |

## 2026-07-19 — Production kickoff

- Gabe approved the complete Permission Afterparty design and authorized the video build.
- Production project created at `video/permission-afterparty` for X, 1920×1080, 30 fps, social duration.
- Clean baseline passed: 162 tests passed, 1 skipped; TypeScript build passed.
- Live Higgsfield account verified on Plus with 819.56 credits before generation.
- Live routing selected `soul_location` for the text-only venue frame and Seedance 2.0 as the quality motion lane, subject to exact cost preflight.
- No generation credits spent yet.

## 2026-07-19 — First continuity frame and real product proof

- Higgsfield Soul Location quote: `0.12` credits exact for one 16:9 still; one generation submitted under Gabe's approved build scope.
- The environment mood passed. The foreground object read as a glow stick, not a wristband, and the gate was too soft to carry the metaphor.
- Decision: retain the still as the environment plate; build the wristband, reader, and scanner ring deterministically. No paid retry or variant.
- Captured the live WalletBrief address/result frame and current no-active-approvals state.
- Captured the existing verified MonadVision WMON grant and revoke receipts. No new mainnet transaction was sent.

## 2026-07-19 — Copy and creative-design audit

- Caveman found the product UI already dense enough to resist broad compression. The hero was rewritten for a more concrete benefit: “See what your wallet still allows.”
- The public README had stale WMON-only language from the earlier batch-executor architecture. It now distinguishes the live arbitrary-address HyperSync path from the separate EIP-7702 mainnet proof.
- Product test result after copy changes: 162 passed, 1 skipped. Production web build passed.
- Gabe selected **The Permission Afterparty**. Marketing Lab patterns adopted: invisible problem, ordinary-action progression, memorable reframe, and real before-and-after proof.
- The full narration, beat sheet, six-frame previs, deterministic/generative split, safety boundaries, cost gates, and QA gates are recorded in `04-permission-afterparty-design.md`.
- No generation credits were spent. Final design approval remains required before previs or paid generation.

## 2026-07-19 — Final narration polish

- Caveman found no safe large cut; the narration was already dense.
- Humanizer converted technical and ad-like phrasing into spoken language while preserving the product claims.
- The final voice-over is 93 words, approximately 38 seconds at 145 words per minute.
- The hook and product truth remain unchanged. No generation credits were spent.
