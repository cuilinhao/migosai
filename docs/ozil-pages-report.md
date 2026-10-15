# Ozil public-page migration report

Implemented the home page and all six requested guides at `/ozil-goal-generator` and the six original guide slugs beneath it. This is a content-focused React clone (L3): public SSR content, deployed CSS, media and documented client interactions were recoverable. The original service’s backend prompt/model configuration is unknown; the paid generator is a separate Seedance 2.0 integration.

## Delivered behavior

- Full home structure: pitch hero, generator slot, original reference video, three sample jump buttons and three image jump cards, animated board, trend text, facts, workflow, photo advice, CapCut comparison, shared-credit cards, all 12 FAQs, guide links, CTA and footer.
- Full six-guide prose, headings, tables and all 39 guide FAQs. Data is sanitized during import and rendered as React nodes; source JavaScript and tracking are not executed.
- Public prompt builder: all original choices, exact default and sentence assembly, one-prompt/three-shot modes, live word count and copy success/fallback behavior. It does not submit these public prompts to the paid generator.
- Template checklist: six toggles, mandatory adult/consent checks, original five verdict branches and missing-item advice.
- Photo checker: browser-only optional file inspection, seven weighted questions, consent blocker, readiness score, fixes and reset. The source checker’s 8 MB/300px/aspect recommendations are identified as recommendations; the integrated generator’s 10 MB limit is documented separately.
- Trend timeline: range input and all three segment buttons update the still, time, title and explanation.
- Meme caption board: 25 source captions, six mood filters, name substitution, random selection avoiding the previous pick, copy state and fallback.
- CapCut route chooser: all four questions/eight options, original recommendation branching, both/site/CapCut CTAs and reset. Commercial text uses current shared credits and variable generation time.
- Sample videos: explicit play/pause, reduced-motion preference defaults to poster/paused, home sound toggle, and original 0/3/8.5-second seeks.
- Local Ozil navigation plus mobile menu and sticky mobile CTA. migosai global navigation is retained by the parent integration; Ozil pages provide their own footer.

## Business and isolation changes

Original dollar packs, separate balance purchases, 5–8 minute promises, automatic photo deletion and 30-day/1-year retention claims were replaced. Price text uses the shared `OZIL_GOAL_COST` at render time. Account, credit, history, legal and support links use migosai routes. Reference media is explicitly labeled as the original sample, not as a result produced by the new integration. The source’s fixed-timing guarantees were changed to requested reference behavior and variable AI results.

The original stylesheet is preserved with every selector scoped under `.ozil-page`; registered custom properties and animations have unique prefixes, and fonts have unique family names. The local stylesheet handles the fixed migosai header (80px desktop, 64px at ≤900px), credit cards, focus visibility and playback controls. All images, fonts and videos use local paths. Original scripts, support widget, trackers, account endpoints, source pricing and source llms links are absent from runtime content.

## Verification

Latest targeted run: `npx vitest run tests/ozil-content-prompt.test.ts tests/ozil-content-pages.test.ts tests/ozil-content-route-choice.test.ts` — **29 tests passed**. Assertions include all 648 prompt combinations, default character parity with original SSR, all 16 CapCut chooser branches, all seven routes and FAQ counts, preserved non-commercial headings, safe local assets/links, no stale source billing/retention claims, no unhandled static buttons, and CSS isolation. `npm run typecheck` passed.

`ffprobe` verified the preserved display video is 15.046009s and the derived model input is 15.000000s in the container, video stream and audio stream.

The coordinating agent reported these actual Chrome checks on 2026-10-15: 1512×806 desktop first-screen comparison matched the original layout with the additional shared migosai header; 390×844 mobile viewport had `scrollWidth=390` and no horizontal overflow; selecting the source sample photo, opening the shared login modal and closing it retained the selection; 15s + Three shots + Office suit + red scarf copied the expected prompt; beat 2 sought the sample to ~3.17 seconds; and expanding “Is it free?” showed 300 shared credits. Browser screenshots were visible in tool output, not saved as local files. Further coordinating-agent checks passed: 768×1024 tablet had no horizontal overflow; clicking Pause sample video set `video.paused=true`; the mobile CapCut chooser with no app / unopened link / willing to pay / no editor recommended Ozil, and Start over restored 0 of 4 answers. All seven canonical routes, the French prompt route, local motion video and font, and sitemap returned HTTP 200; each route had exactly one H1. The parent’s complete suite passed 51 files / 844 tests. An independent follow-up review confirmed the photo-retention claim, CapCut chooser, and playback accessibility findings were resolved without new substantive findings. Final coordinating-agent verification passed: `npm run typecheck`, `npm run build` and `npm run cf:build` all exited 0; OpenNext produced `.open-next/worker.js`. No deployment was performed.

## Files and maintenance

Routes: `app/ozil-goal-generator/**/page.tsx`.
Renderer and tools: `components/ozil-goal/page-content.tsx`, `shell.tsx`, `media.tsx`, `prompt.ts`, `prompt-builder.tsx`, `guide-tools.tsx`, `route-choice.ts`, `route-chooser.tsx`, `credits.tsx`, `reference.css`, `ozil.css`. The generator component and generator CSS are owned by the coordinating task.
Source data: `content/ozil-goal-pages.json`, `ozil-goal-interactions.json`, `ozil-goal-source-manifest.json`. Repeatable source fetch/import/CSS scoping scripts live in `scripts/ozil-*`. Source URLs and checksums are in `docs/ozil-goal-sources.md`.

Known limits: no paid provider generation was performed; this task does not establish the original provider’s private model or hidden prompt; no arbitrary language translations were fabricated (locale-aware routes/metadata follow the existing localization system); source content was migrated at the site owner’s request. No git commit or deployment was made by this page task.
