# WalletBrief: The Permission Afterparty

Date: 2026-07-19

Status: design complete; human approval required before production or paid generation

## Outcome

Produce one 35–40 second crypto-first launch film that makes lingering ERC-20 approvals memorable, proves WalletBrief works on Monad, and ends at a QA-passed 1920×1080 master with ready-to-post copy. Do not publish or submit.

Success is verifiable when:

- a viewer can explain the wristband metaphor and WalletBrief's benefit after one watch;
- the live product appears by 12 seconds;
- every wallet value, address, approval, transaction, and explorer screen is captured from the real product or chain;
- the narration never implies that every approval is malicious or grants unlimited wallet access;
- picture, voice-over, captions, sound, and product interactions pass full-timeline QA.

## Audience and promise

Primary audience: crypto users with multiple wallets, dapps, approvals, and explorer tabs.

Secondary audience: Monad Spark judges.

Single promise: **See what your wallet still allows. Revoke only what you choose.**

The film must stand alone. The X post may add technical context, but it cannot be required to understand the video.

## Dramatic engine

The dapp session is represented as a party. An ERC-20 allowance is represented as an access wristband. The venue is empty, but an abandoned wristband still opens a gate: the activity ended while the permission remained. A circular scanner becomes the WalletBrief search field in a match cut. The metaphor then yields to real product evidence.

This borrows four useful patterns from the Marketing Lab without copying a source script:

1. **Invisible problem:** the consequence persists after the obvious event ends.
2. **Progression through ordinary actions:** swap, mint, approve, close tab.
3. **Reframe:** the approval is not automatically a threat; it is a permission worth seeing and choosing deliberately.
4. **Real before-and-after proof:** active approval, simulated owner action, verified no-active state.

## Locked narration

> The dapp party ends. Some permissions don't.
>
> You swap, mint, approve, then close the tab. But the allowance can stay open.
>
> Weeks later, finding it means contract addresses, explorer tabs, and guesswork.
>
> WalletBrief makes it simple.
>
> Paste any Monad address. It scans the approval history, checks what's still active onchain, and puts it all in one place.
>
> See something you don't need? Connect the wallet that owns it. WalletBrief simulates the revoke before you sign.
>
> The party can be messy. Cleaning up your permissions shouldn't be.
>
> WalletBrief. See what stayed after the party.

The script is 93 words. At 145 words per minute it runs about 38 seconds before natural pauses. Use Gabe's already approved, consented voice clone; do not retrain or reclone it for this film.

## Beat sheet

| Time | Picture | Voice-over | Sound and motion |
| --- | --- | --- | --- |
| 0:00–0:03 | Empty club at dawn. One discarded translucent wristband pulses beside confetti. Deterministic title: **THE PARTY ENDS.** | “The dapp party ends. Some permissions don't.” | Muffled bass from another room, HVAC room tone, one scanner chirp. Slow push-in; one focal object. |
| 0:03–0:08 | The abandoned wristband passes near an access reader; the empty gate unlocks. Deterministic line: **SOME PERMISSIONS DON'T.** | “You swap, mint, approve, then close the tab. But the allowance can stay open.” | Three tactile clicks land on swap / mint / approve. Gate unlock is the fourth beat. No generated text. |
| 0:08–0:12 | Scanner ring fills frame and match-cuts to the WalletBrief address field. A real address is pasted. | “Weeks later, finding it means contract addresses, explorer tabs, and guesswork.” | Bass cuts dry on the match. Cursor click and short data sweep. Product appears before 12 seconds. |
| 0:12–0:21 | Real WalletBrief results resolve: balances, transaction count, latest block, then approval scan. | “WalletBrief makes it simple. Paste any Monad address.” | Fast ease-out entrances, 160–220 ms. Metrics land sequentially, never all at once. |
| 0:21–0:31 | Real active approval row, current allowance, owner match, simulation, and owner-signature boundary. | “It scans the approval history, checks what's still active onchain, and puts it all in one place. See something you don't need? Connect the wallet that owns it.” | Hold two beats before the revoke action. One restrained impact on successful simulation; no spring or deformation. |
| 0:31–0:39 | Real no-active-approvals state and explorer proof. The wristband's light goes dark. End card: **WALLETBRIEF / SEE WHAT STAYED AFTER THE PARTY.** | “WalletBrief simulates the revoke before you sign. The party can be messy. Cleaning up your permissions shouldn't be. WalletBrief. See what stayed after the party.” | Scanner power-down, room tone resolves, restrained Monad-colored end sting. |

## Six-frame previsualization

The storyboard must contain exactly these frames before motion generation:

1. abandoned wristband in the empty venue;
2. wristband unlocking an empty access gate;
3. scanner-ring match frame;
4. real WalletBrief search and live snapshot;
5. real active approval and simulation boundary;
6. real no-active state, extinguished wristband, and CTA.

Frames 1–3 may use Higgsfield. Frames 4–6 must use real browser or explorer captures composed in Remotion/HyperFrames. Generated models may not render UI, addresses, captions, logos, or CTA text.

## Product-proof capture

Use the dedicated demo wallet and the same inert spender already documented in the mainnet proof.

1. With separate explicit transaction approval, create one harmless, bounded WMON allowance solely for the capture.
2. Record WalletBrief discovering the current active approval.
3. Record the exact owner-match and simulation-before-signature flow.
4. Revoke once and record the verified no-active result plus explorer receipt.
5. If an injected-wallet capture cannot be completed safely, do not fake it. Show the real active row, the existing verified revoke receipt, and the final real no-active state without implying that a visible button click produced the historical transaction.

Rotate the HyperSync bearer token that was exposed in chat before final submission. Never place credentials, private keys, or bearer tokens in source, render props, screenshots, logs, or the vault.

## Visual system

- Master: 1920×1080, 16:9, 30 fps.
- Palette: WalletBrief near-black surfaces, restrained chartreuse signal, Monad purple as a secondary environmental accent.
- Typography: deterministic sans for narrative lines; mono only for addresses and chain data.
- Captions: hand-authored, burned in, one or two lines, sentence case, high-contrast translucent black backing, 10% bottom safe margin. No karaoke treatment.
- Generated venue: post-party rather than active nightclub; cinematic dawn haze; discarded wristbands, paper confetti, and inactive lights; no brand marks and no legible generated text.
- Motion: fast ease-out entrances, one focal point per beat, sequential impacts, and anticipation before the owner action. No elastic UI, fake parallax on screenshots, or gratuitous camera moves.

## Audio system

- Narration is the explanation layer; the X caption is supplementary.
- Reuse Gabe's approved voice clone and record one continuous narration take before picture lock.
- Use a subdued afterparty source cue that can transition cleanly into the product section. Music is selected after the cut, not before it.
- Scanner chirps, wristband clicks, cursor clicks, and the simulation confirmation form the rhythmic spine. Align scene changes to those transients.
- Dialogue remains dominant. Music ducks under every spoken line and never masks consonants.
- Every source and license is recorded in the audio manifest before final mix.

## Production architecture

- Higgsfield: cinematic source shots only, first as approved stills, then one-action/one-camera-move 720p prototypes.
- Remotion/HyperFrames: real product capture, match cut, typography, captions, UI motion, end card, and frame-accurate assembly.
- FFmpeg/ffprobe: audio conformance, loudness finishing, encode, and technical QA.
- Manual review: complete-timeline playback at every gate; midpoint stills for semantic callout verification.

## Gates and cost discipline

1. **Design gate:** approve this document.
2. **Previs gate:** approve all six frames and timed animatic.
3. **Generation gate:** show the exact Higgsfield model, number of clips, resolution, and quoted credits before spending. No speculative variants.
4. **Cut gate:** watch the full cut with narration and real product proof, without captions, music, or finishing.
5. **Motion/caption gate:** watch the full timeline and verify every word, focal point, and A/V cue.
6. **Sound gate:** watch and listen to the complete mix; verify dialogue clarity and ducking.
7. **Master gate:** inspect the exported MP4 for duration, 1920×1080, 30 fps, H.264/AAC compatibility, sync, text safety, visual artifacts, product truth, and token leakage.

No gate may be inferred from silence. No publishing or submission occurs in this workflow.

## Ready-to-post copy direction

The post should extend the metaphor in plain language:

> The dapp session ends. The allowance can stay open.
>
> I built WalletBrief for Monad to answer one question fast: what does this wallet still allow?
>
> Paste an address. See current ERC-20 approvals. If one should go, simulate the revoke before you sign.

Final tags and public links are added only after the QA-passed master exists.
