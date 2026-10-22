# MigosAI homepage reconstruction

## Approved routes and behavior
- `/`: PicLumen-style portal, MigosAI branding. Sidebar excludes Solutions, Canvas and Text; related cards excluded. Quests remains Coming soon.
- `/landing`: Recraft-style marketing landing. Main calls to action open existing MigosAI tools.
- `/hotel-lobby-ai-video-generator`: complete former homepage integrated with previous route-specific SEO content and all original generation, examples, workflow, FAQ and pricing.
- `/ai-image-generator`: Nano Banana 2 through existing Kie credentials, 1K 5 / 2K 8 / 4K 12 credits. `/app/assets` is a private library, excluded from sitemap.
- All public pages support en, ko, ja, fr, es and zh-TW. New public routes are included in localized sitemap/canonical/hreflang handling.

## Reference evidence and implementation
User-requested skill: https://github.com/cuilinhao/claude-skill-web-clone (local web-clone v1.6.0).

Reference pages: https://www.piclumen.com/ and https://www.recraft.ai/ observed on 2026-10-22. No official reusable website-source repository found in GitHub search. PicLumen is Nuxt SSR; Recraft is a Framer page. This is an independent React/CSS implementation in the existing Next.js 15 project, based on rendered DOM, computed geometry, screenshots and observed public image resources. No reference JavaScript bundles, analytics, private APIs or user data were copied.

Complexity: L3 content/portal reconstruction with L2 marketing interactions. Reference navigation, card layouts and responsive structure retained where compatible with approved removals. Production account/payment/video/music systems remain the existing MigosAI implementation.

PicLumen measured desktop: sidebar x16/y16/w200/r24; content left256; DM Sans; hero 24px/32px; section titles20px/28px; image radii16px; dark surface#0b0b0b/#181818; purple/pink pricing pill. Recraft: black header, purple announcement, lime calls to action, oversized condensed/extended uppercase typography, editorial images and horizontal galleries.

Original proprietary Recraft fonts were not copied. DM Sans, Anton and Archivo Black are installed from @fontsource with their included licenses. Reference visual images are locally stored for preview with origin in `asset-sources.json`; website code availability does not establish reuse rights. Obtain rights or replace reference imagery before publishing. MigosAI video examples already in the repository are reused with their original context; no fake testimonials, creator counts or customer logos.

## Local development
Run `npm install` then `npm run dev`, open http://127.0.0.1:3000/ and /landing. Existing Cloudflare bindings are needed for live account/storage/provider operation. No production secrets are stored in these notes.

## Database deployment prerequisite
Apply migration `0007_image_generations.sql` through the project's existing deployment process before enabling the new image endpoint in production. It adds image generations while preserving historical rows, credit ledger, triggers, indexes and foreign keys. An isolated local D1 database was migrated successfully; no remote migration or deployment was executed in this task.

## Verification
See CLONE_REPORT.md for final commands, screenshots, interactions and remaining validation boundaries. Reference and local screenshots are in `.local-evidence/piclumen-recraft/` (ignored local evidence). Automated tests use controlled provider responses; no real paid generation was performed.
