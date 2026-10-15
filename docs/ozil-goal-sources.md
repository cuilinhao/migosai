# Ozil Goal public-source inventory

Retrieved on 2026-10-15. These public resources are source evidence, not executable dependencies. The application never loads or executes the original JavaScript, account flow, payment flow or tracking code.

## Public routes

| Original | Local route | FAQs preserved |
| --- | --- | --- |
| [home](https://ozilgoal.com/) | `/ozil-goal-generator` | 12 |
| [ozil-goal-ai-prompt](https://ozilgoal.com/ozil-goal-ai-prompt) | `/ozil-goal-generator/ozil-goal-ai-prompt` | 6 |
| [ozil-goal-ai-template](https://ozilgoal.com/ozil-goal-ai-template) | `/ozil-goal-generator/ozil-goal-ai-template` | 7 |
| [ozil-goal-trend](https://ozilgoal.com/ozil-goal-trend) | `/ozil-goal-generator/ozil-goal-trend` | 6 |
| [ozil-goal-meme](https://ozilgoal.com/ozil-goal-meme) | `/ozil-goal-generator/ozil-goal-meme` | 7 |
| [ozil-goal-capcut-template](https://ozilgoal.com/ozil-goal-capcut-template) | `/ozil-goal-generator/ozil-goal-capcut-template` | 6 |
| [ai-football-video-from-photo](https://ozilgoal.com/ai-football-video-from-photo) | `/ozil-goal-generator/ai-football-video-from-photo` | 7 |

Page HTML SHA-256 hashes and the original heading inventories are recorded in `content/ozil-goal-source-manifest.json`.

## Deployed source artifacts

| Source | SHA-256 |
| --- | --- |
| [styles-B2w4TpLD.css](https://ozilgoal.com/assets/styles-B2w4TpLD.css) | `637c25179920b2a7db7e3484e7a2d7e286dd63caa8e37e99fa5ff92f53819282` |
| [home-DgE8Zpu7.js](https://ozilgoal.com/assets/home-DgE8Zpu7.js) | `5d81e3bd4d86310f338ddd6fa395d111ab11736f85faf4877c5934c97406ba7c` |
| [ozil-goal-ai-prompt-C756gsav.js](https://ozilgoal.com/assets/ozil-goal-ai-prompt-C756gsav.js) | `51abf3e4ef0bbf143e0813665f70f8f3b8b2fc78e1a81a831d747ddb82f8d95d` |
| [ozil-goal-ai-template-qflki_MJ.js](https://ozilgoal.com/assets/ozil-goal-ai-template-qflki_MJ.js) | `f98e4bd1105a8f36d29275e5e8611572ee7ef0f7089c39592cee204372685c1b` |
| [ozil-goal-trend-DcDoH35s.js](https://ozilgoal.com/assets/ozil-goal-trend-DcDoH35s.js) | `3520593e81039537ec2ecaaf639d1fab71c0726ebd7f566a9421549797b8c318` |
| [ozil-goal-meme-DejIsxVd.js](https://ozilgoal.com/assets/ozil-goal-meme-DejIsxVd.js) | `7b16943e6a62000d19792a3a4773f04f3ed9d732986053a572225f3ee3d63181` |
| [ozil-goal-capcut-template-CjsIgeh5.js](https://ozilgoal.com/assets/ozil-goal-capcut-template-CjsIgeh5.js) | `894f30fb40c3d0ec8362a1e231204ad231ee5a6c40ee4ff1b1549357527943d3` |
| [ai-football-video-from-photo-CHbXsi-G.js](https://ozilgoal.com/assets/ai-football-video-from-photo-CHbXsi-G.js) | `ec47c53fdfecebf5431656aadd57e7bdc152d41fb713a7f28d984f04b65d9fd4` |
| [guide-shell-DSn_khR5.js](https://ozilgoal.com/assets/guide-shell-DSn_khR5.js) | `947de7b00ee39d0d07b9d64a1ac319c9fe54dafc08930f9de388f9199ad189a9` |
| [parts-qV7UCn_Z.js](https://ozilgoal.com/assets/parts-qV7UCn_Z.js) | `a7d5b4f8e9348779e19a601a2e2fd5e4b4e023426ed5e196f67ae86ef590228b` |

The prompt builder was transcribed from `ozil-goal-ai-prompt-C756gsav.js`: all duration, outfit, setting, camera, ending and split choices; detail normalization (NFKD, combining-mark removal, quote normalization, ASCII filtering, whitespace normalization, 90-character truncation); half-second beat rounding; every sentence; and newline joining. `tests/ozil-content-prompt-default.txt` is extracted from the original SSR `<pre>` and verifies the default character for character.

The template checklist, 7-question weighted photo checker, 25 captions and 6 caption moods, timeline descriptions, and CapCut 4-question recommendation tree were read from their real guide chunks. Literal data arrays are parsed as JSON without evaluating downloaded JavaScript. React behavior is implemented locally.

## Self-hosted media

| Original asset | Local asset | SHA-256 |
| --- | --- | --- |
| [source](https://ozilgoal.com/logo.png) | `public/ozil-goal/logo.png` | `49bf0288626d618feb89db6c623b4ac63a032ec3a83477ac26870a051f789d18` |
| [source](https://ozilgoal.com/assets/instrument-sans-latin-wght-BbzFLZTg.woff2) | `public/ozil-goal/fonts/instrument-sans.woff2` | `2ee17598a98d8a59e4df8152d015bec9ab8e4d5672cc0ab42bef806b568e3971` |
| [source](https://ozilgoal.com/assets/barlow-condensed-800i-latin-BaEn-VSx.woff2) | `public/ozil-goal/fonts/barlow-condensed-800i.woff2` | `32f1f20a0581659cb453205948c8826a28819723130d3466729597ab06ba1037` |
| [source](https://assets.ozilgoal.com/samples/ozil-goal-demo-ai.mp4) | `public/ozil-goal/samples/ozil-goal-demo-ai.mp4` | `01066b13a884dcdd682b5f5e7f79f98b9618351944caa14634cb80b1c983f375` |
| [source](https://assets.ozilgoal.com/samples/ai-shot1.jpg) | `public/ozil-goal/samples/ai-shot1.jpg` | `39141b3d1719fa48391445b2ac45e980d486a8608c4973ea5f751e636f66516f` |
| [source](https://assets.ozilgoal.com/samples/ai-shot2.jpg) | `public/ozil-goal/samples/ai-shot2.jpg` | `14ee3eabbe766994502d13149924d55ce5bcfb894fdf69816395a5bb99f0e335` |
| [source](https://assets.ozilgoal.com/samples/ai-shot3.jpg) | `public/ozil-goal/samples/ai-shot3.jpg` | `3536ab442d444b36346a7e88328a4f4b33f44ddadc51e23f5d8724bcf4b3f4b6` |

The complete display video is preserved byte-for-byte: MP4/H.264, 496×864, 24 fps, AAC, container duration 15.046009 seconds. The three JPEGs and both original fonts are not redrawn. Font-family names are prefixed for isolation.

The generation reference is a derived trim at `public/templates/ozil-goal/motion.mp4`: video, audio and container are all 15.000000 seconds, H.264/AAC, 496×864. This is the chosen reference for the new Seedance integration, not a claim about the original service’s hidden generation setup.

```sh
ffmpeg -i public/ozil-goal/samples/ozil-goal-demo-ai.mp4 -t 15 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart public/templates/ozil-goal/motion.mp4
```

## Reproduction and source limits

```sh
python3 scripts/ozil-fetch-sources.py /tmp/ozil-source
python3 scripts/ozil-import-content.py /tmp/ozil-source
node scripts/ozil-scope-css.mjs /tmp/ozil-source/styles-B2w4TpLD.css
```

The importer is pinned to the reviewed deployed chunk structure and intentionally fails if those expected literals change. Re-review source changes before regenerating. The source JavaScript is not copied into `public/` or imported by the app.

The user identified ozilgoal.com as their own site and requested this migration. Source attribution is recorded here. Publication and real-generation verification are tracked separately in the deployment report.
