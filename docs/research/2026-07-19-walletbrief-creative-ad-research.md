# WalletBrief Creative Ad Research

Date: 2026-07-19
Status: evidence synthesis only; no creative direction approved and no generation credits spent.

## Decision summary

WalletBrief should not use a template-driven URL-to-ad workflow. It is a digital security product with no physical hero object, and the supplied research says those systems perform best when a clean product photo anchors every template. The stronger production architecture is:

1. Use the working product and its real UI as the source of truth.
2. Express the pain as a short cinematic metaphor generated in Higgsfield.
3. Previsualize every generated shot before paying for video.
4. Keep all legible text, wallet data, product UI, captions, logo animation, and CTA deterministic in Remotion.
5. Let music, tactile sound design, and editing connect the metaphor to the demo.

This creates a bespoke narrative ad without asking a generative video model to reproduce wallet addresses, dashboards, or transaction details accurately.

## Findings that change the workflow

### 1. Plan the movie before generating it

Higgsfield defines previsualization as the cheap stage for deciding framing, character positions, light direction, and camera coverage. Popcorn can generate an entire storyboard sequence from shared references, while Cinema Studio turns approved panels into shots with explicit lighting, lens, focal length, aperture, and camera movement. The recommended frame count is four for a simple sequence, six for a clear arc, and eight only for a complex multi-beat scene.

WalletBrief implication: approve a six-frame storyboard and animatic before any final video generation. A weak panel is regenerated as a still, not discovered after an expensive motion render.

Sources: [AI previsualization tools](https://higgsfield.ai/blog/ai-previsualization-tools), [script to storyboard](https://higgsfield.ai/blog/script-to-storyboard-ai).

### 2. Generated shots need one job each

The Seedance guidance repeatedly converges on one subject action, one camera move, and explicit physical context per shot. Good prompts follow subject/action, environment, camera, style, and constraints. Reference-video transfer works best with one continuous 3-8 second source shot where either the subject or camera moves, not both. For image-to-video, describe only what changes and preserve the composition and colors of the input frame.

WalletBrief implication: do not ask Seedance to create the whole commercial in one prompt. Generate short shots with a single focal event, then build the causal story in the edit.

Sources: [HeyGen Seedance guide](https://x.com/HeyGen/status/2041295005462245471), [generating with Seedance 2.0](https://higgsfield.ai/blog/generating-with-seedance-2-0).

### 3. Lock continuity as reusable assets

The strongest film examples create named character, location, wardrobe, and prop assets before shot generation. Tags must match the orchestrator's element names exactly. Character sheets work best when the face anchor is unambiguous; multiple competing faces can cause identity drift. Location references benefit from three-quarter angles that give the camera spatial depth.

WalletBrief implication: if the ad uses a recurring human, phone, threatening entity, or room, each becomes a named reusable element with a single approved reference. The real WalletBrief UI remains a captured/composited asset, never a generated screen.

Sources: [Case 4K workflow](https://higgsfield.ai/blog/case4k), [Cinema Studio 3.0](https://higgsfield.ai/blog/cinema-studio-3.0), [why AI characters look weird](https://higgsfield.ai/blog/why-ai-characters-look-weird).

### 4. Human motion needs physics, context, and references

The motion guide says believable movement depends less on vague adjectives and more on joint direction, weight transfer, contact with surfaces, material response, and the environment reacting to the action. The failure modes in earlier avatar experiments match the article's warnings: image anchors weaken across angles, missing native lip sync looks dubbed, and high resolution exposes facial and accessory artifacts.

WalletBrief implication: prefer hands, silhouettes, POV shots, environmental reactions, or one brief UGC performance over a recurring full-body hero. Avoid persistent jewelry and other small identity details. This is a cinematic ad, not another talking-head pipeline.

Sources: [realistic AI human movement](https://higgsfield.ai/blog/realistic-ai-human-movement), [why AI characters look weird](https://higgsfield.ai/blog/why-ai-characters-look-weird).

### 5. Prototype cheaply and change one variable

Higgsfield recommends validating composition and motion at 720p, reviewing the entire clip because failures often appear after five seconds, changing either the prompt or reference per iteration, and running final 1080p/audio only after the motion is locked. Enhanced Fast is for variation speed; standard Seedance is for final 1080p output.

WalletBrief implication: budget gates are storyboard approval, 720p motion test, and final-resolution render. No speculative variant farm. Every retry states the single variable being tested.

Source: [generating with Seedance 2.0](https://higgsfield.ai/blog/generating-with-seedance-2-0).

### 6. Native 4K is a finishing decision, not a concept fix

The 4K tests focus on dense texture, fluid dynamics, complex environments, VFX integration, animation, and packshots. Their prompts explicitly lock style, lighting, color, camera, material, acting, physics, continuity, optics, action, and audio. Higher resolution preserves complex detail but cannot rescue unclear staging or contradictory direction.

WalletBrief implication: master the edit at 1080p for X/YouTube. Use a higher-resolution generation or upscale only for the selected hero shot when detail materially benefits the image.

Source: [Seedance 4K](https://higgsfield.ai/blog/Seedance-4k).

### 7. A commercial still needs a simple dramatic engine

The long-form perfume example succeeds by reducing each shot to a recognizable genre beat: forbidden object, security system, pursuit, confrontation, reversal, packshot. Start and end frames specify exact changes; post-production adds CCTV artifacts that generation did not deliver cleanly. The product remains the focal object even when characters carry the narrative.

WalletBrief implication: choose one visual metaphor for hidden approvals and build a clean escalation/reversal around it. Do not make a generic "crypto is confusing" montage.

Source: [AI commercial guide](https://higgsfield.ai/blog/ai-commercial-youtube-guide).

### 8. Brand motion must be specified, not inferred

HeyGen's HyperFrames workflow separates static brand rules in `DESIGN.md` from video behavior in `FRAME.md`: entrances, exits, easing, transition style, and pacing. The same motion contract then travels with every website-to-video, launch, caption, and product workflow.

WalletBrief implication: freeze a small `DESIGN.md` and `FRAME.md` before Remotion work. The approved dark surface, restrained chartreuse accent, mono data typography, fast ease-out entrances, and minimal deformation should behave consistently across the demo and ad.

Source: [Give your brand a motion language](https://x.com/HeyGen/status/2074574265714905167).

### 9. Template ads are useful for scale, not for this hero film

Higgsfield's Click to Ad extracts a product name, description, up to eight photos, colors, and logo from a page, then fills one of ten templates. Its own limitations are decisive here: it is strongest for clean physical product photography, template-based rather than bespoke, and less suitable for digital products without a clear object.

WalletBrief implication: do not start from Click to Ad. Once a bespoke hero concept proves effective, deterministic Remotion templates can scale hooks, aspect ratios, CTAs, and copy variants.

Source: [100+ AI ad creatives](https://higgsfield.ai/blog/how-to-make-100-creative-ads).

### 10. MCP orchestration should produce evidence, not hide judgment

The motion-designer workflow shows an orchestrator generating assets, assembling a portfolio, and iterating through tools. The Case 4K workflow goes further: a skill maps plain-language scene intent into exact element tags and production prompts, then feedback returns to the orchestrator for narrowly scoped fixes.

WalletBrief implication: the eventual ads skill should own the state machine and gates: brief, reference board, storyboard, shot manifest, generation ledger, deterministic edit, QA, and ready-to-post copy. Higgsfield remains one provider behind an adapter, not the workflow itself.

Sources: [MCP for motion designers](https://higgsfield.ai/blog/MCP-For-Motion-Designers), [Case 4K workflow](https://higgsfield.ai/blog/case4k).

## Source-by-source checklist

| # | Source | Useful evidence |
|---|---|---|
| 1 | [HeyGen Seedance guide](https://x.com/HeyGen/status/2041295005462245471) | Prompt formula, one camera move, reference-video rules, timeline beats |
| 2 | [HeyGen motion language](https://x.com/HeyGen/status/2074574265714905167) | `DESIGN.md` plus `FRAME.md` as portable brand-motion contract |
| 3 | [Zentrix beginner guide](https://x.com/ZentrixHQ/status/2069820831564251585) | Character lock, storyboard review, clip selection, beat-synced music, grading |
| 4 | [AI previsualization tools](https://higgsfield.ai/blog/ai-previsualization-tools) | Popcorn-to-Cinema Studio previs and reference workflow |
| 5 | [Script to storyboard](https://higgsfield.ai/blog/script-to-storyboard-ai) | Six-frame arc, shared context, aspect-ratio and review gates |
| 6 | [Cinema Studio 3.5](https://higgsfield.ai/blog/cinema-studio-3.5-full-tutorial) | Lighting, focal length, aperture, camera placement as generation inputs |
| 7 | [Realistic human movement](https://higgsfield.ai/blog/realistic-ai-human-movement) | Physics, weight transfer, environmental response, motion references |
| 8 | [Cinema Studio 3.0](https://higgsfield.ai/blog/cinema-studio-3.0) | Reusable cast/location assets, start/end frames, product-ad structure |
| 9 | [Why AI characters look weird](https://higgsfield.ai/blog/why-ai-characters-look-weird) | Identity, reference drift, model fit, lip sync, resolution failure modes |
| 10 | [Generating with Seedance 2.0](https://higgsfield.ai/blog/generating-with-seedance-2-0) | Multimodal references, 720p prototype, single-variable iteration |
| 11 | [Seedance 4K](https://higgsfield.ai/blog/Seedance-4k) | Continuity locks, material/physics prompting, high-detail finishing |
| 12 | [100+ creative ads](https://higgsfield.ai/blog/how-to-make-100-creative-ads) | URL-to-ad strengths and why digital products need bespoke concepts |
| 13 | [MCP for motion designers](https://higgsfield.ai/blog/MCP-For-Motion-Designers) | Orchestrated generation and repeatable asset-production loop |
| 14 | [AI commercial guide](https://higgsfield.ai/blog/ai-commercial-youtube-guide) | Genre engine, product focal point, compositing, post-production fixes |
| 15 | [Case 4K](https://higgsfield.ai/blog/case4k) | Named elements, asset sheets, prompt skill, feedback loop |

## Questions the creative design must answer

1. Which single metaphor makes an invisible token approval immediately legible?
2. Is the audience primarily a Monad judge or a broader crypto user encountering the X post?
3. How early must the working product appear to prove this is not a concept film for vaporware?
4. What one action should the viewer remember: check a wallet, understand exposure, or revoke safely?
5. Which shot earns generative video, and which shots become stronger when built deterministically from the real product?
