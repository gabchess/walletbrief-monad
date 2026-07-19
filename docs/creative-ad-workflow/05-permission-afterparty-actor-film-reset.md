# WalletBrief: The Permission Afterparty — Actor-Led Reset

Date: 2026-07-19

Status: creative reset ready for human review; no new paid generation approved

Concept board: `../../video/permission-afterparty/03-edit/actor-film-storyboard-v1.png`

## What changed

The rejected previs was a product deck with a short film wrapper. This version is a film. One lead actor carries a physical story from the party exit to the morning after. WalletBrief appears as the tool that resolves the story, not as a run of slides.

Target split: about 75% actor footage, 15% product interaction inside the scene, and 10% legible product proof plus end card.

## Film premise

A crypto user leaves an afterparty at dawn with a glowing access wristband. The next morning, the party is over but the wristband still works. She opens WalletBrief, checks what her wallet still allows, and simulates a revoke. The wristband goes dark and slips free.

The physical plot makes the invisible approval clear. The product insert proves the claim. The final action closes the loop.

## Cast and locked elements

### Lead actor — `@nina`

- Woman, late 20s to early 30s, Brazilian or Latina, warm olive skin, dark wavy shoulder-length hair.
- Natural skin and expression. No glossy beauty grade, no HDR skin, no heavy makeup.
- Clear single-face anchor plus separate body and wardrobe references. Do not place several visible faces on one reference sheet.
- Party wardrobe: black leather jacket, charcoal top, dark jeans, plain boots.
- Morning wardrobe: soft cream T-shirt, dark lounge trousers.
- No rings, earrings, watches, logos, nail art, or tiny accessories. The wristband is the only persistent hand detail.

### Supporting cast

- Two or three party friends appear only as background extras in the opening shot.
- One door attendant may appear in the wide party-exit frame. The attendant does not recur.
- Extras do not need identity continuity across later shots.

### Prop — `@permission_wristband`

- Simple translucent access band with one broad chartreuse light strip.
- No text, QR code, logo, clasp detail, or small moving parts.
- It stays on the lead's right wrist until the final shot.
- The light state carries the plot: active pulse at the party, slow pulse in the morning, dark after the simulated revoke.

### Locations

- `@afterparty_exit`: wet pavement, dawn haze, club door, simple access reader, warm light inside, cool blue street light outside. Three-quarter angle with depth.
- `@morning_apartment`: modest warm kitchen/living room, wood table, soft window light, laptop, coffee mug. Three-quarter master angle plus one reverse angle.

## Locked voice-over

> The party ended hours ago. The wristband still works.
>
> Token approvals can do the same. You close the tab, but the allowance stays.
>
> WalletBrief shows what a Monad wallet still allows. Paste an address, see active approvals, and simulate a revoke before you sign.
>
> Keep the memory. Drop the permission.

The actors do not speak. Party laughter, street sound, fabric movement, coffee-room tone, reader chirps, laptop clicks, and the wristband power-down carry the lived-in feel without adding a lip-sync risk.

## Storyboard and cut

| Time | Film action | Camera and sound | Production method |
| --- | --- | --- | --- |
| 0:00–0:04 | Handheld phone-style shot follows Nina and friends out of the party. Nina laughs, turns toward camera, and raises the wrist with the glowing band. | Documentary handheld at arm's length; one backward follow. Native party spill, shoes on wet pavement, a quick laugh. | Seedance with locked actor, party wardrobe, wristband, and location. |
| 0:04–0:08 | Friends leave frame. Nina passes the closed reader; it chirps and the empty door unlocks behind her. She turns back. | Low shoulder-height follow, then a short rack focus from Nina to the reader. One action: the reader reacts after she has left. | Seedance. No generated text. |
| 0:08–0:12 | Morning. Nina sits at the table with coffee, notices the band still pulsing, and tries once to peel it off. It holds. | Intimate observer, 50mm, fixed camera with a small push. Fabric and band contact sound. | Seedance with the same actor, morning wardrobe, band, and apartment. |
| 0:12–0:17 | She opens the laptop, pastes a Monad address, and watches the result resolve. The band remains in the foreground. | Over-shoulder locked frame. One hand action and one screen event. | Seedance plate with a blank tracked screen; real WalletBrief UI composited in post. |
| 0:17–0:22 | One clean full-screen product insert shows the live address, active approval, owner boundary, and simulation state. | Fast but readable deterministic moves; no carousel. Cursor and data sounds. | Real browser capture in Remotion/HyperFrames. |
| 0:22–0:27 | Back in the apartment, Nina confirms the simulated action. The wristband light powers down. She exhales. | Fixed medium close-up. Hold on the face, then rack focus to the dark band. | Seedance plate plus simple deterministic light cleanup if needed. |
| 0:27–0:31 | The dark band slips free. Nina drops it beside the laptop and lifts her coffee. | Close tabletop insert followed by a short tilt to Nina. Soft plastic drop, room tone resolves. | Seedance. |
| 0:31–0:34 | Brief end card only: WalletBrief logo, URL, and “See what your wallet still allows.” | One fast ease-out entrance, no other slide. | Deterministic Remotion. |

## Shot rules

- Use 16:9, 1920×1080 master, 30 fps delivery. Generate film motion at a natural 24 fps look and conform in the edit.
- Build an eight-panel Popcorn board in manual mode from the locked actor, wardrobe, prop, and location references.
- Generate each film beat from its approved board frame. Keep shots between four and eight seconds.
- Use one main action and one camera move per shot.
- State physical contact, weight shift, eye line, and environmental response. Do not rely on “natural movement” as a prompt.
- Carry the last good frame or prior clip into the next shot when the same actor and location continue.
- Use Seedance 2.0 at 720p for motion tests. Change either the prompt or a reference per retry, never both.
- Review the full clip, not the first two seconds. Reject face drift, hand drift, wristband drift, weightless motion, broken eye lines, or reader events that happen before the actor moves.
- Run the selected clips at 1080p only after the motion tests pass.

## Tool split

- Higgsfield Popcorn: actor-led storyboard with shared continuity.
- Higgsfield Cinema Studio / Elements: cast, wardrobe, prop, and location locks.
- Seedance 2.0: all acted footage and native room sound.
- Remotion / HyperFrames: screen replacement, one product insert, captions, end card, and edit.
- FFmpeg / ffprobe: audio finish, encode, and technical QA.

No ChatCut. No HeyGen avatar. No Higgsfield talking head. No generated wallet UI. No screenshot carousel.

## New gate

The next paid action is not generation. First approve the actor-led board. Then show the exact model, clip count, duration, resolution, and current Higgsfield credit quote. The old end-to-end cost approval applied to the rejected direction and does not carry forward.

### Live preflight, 2026-07-19

- Current Higgsfield balance: 815.44 Plus credits.
- Route: Seedance 2.0, 16:9, reference-driven actor footage.
- Prototype plan: three sequences at 8, 10, and 8 seconds, 720p fast, 91 credits total.
- Final plan: rerender the three selected sequences at 1080p standard, 234 credits total.
- Maximum if every prototype earns a final: 325 credits.
- No video job was submitted during this preflight.
