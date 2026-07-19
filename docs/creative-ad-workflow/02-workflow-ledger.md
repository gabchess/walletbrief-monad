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

- Public Railway deployment of the corrected indexed adapter and runtime token.
- Rough search-to-result screen played against live data.
- Human-approved creative concept, storyboard, animatic, cut, sound mix, and final master.

## Cost ledger

| Date | Provider | Action | Cost | Status |
|---|---|---|---:|---|
| 2026-07-19 | Higgsfield | Creative-ad generation | 0 credits | Not started |
| 2026-07-19 | Envio | HyperSync provisioning | No paid generation spend | Enabled; live proof passed |
