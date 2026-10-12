# Contributing to Trillion3D Site

The site shows the Trillion3D engine; the engine is the product. Trillion3D's
[CONTRIBUTING.md](https://github.com/pasquelin/Trillion3D/blob/develop/CONTRIBUTING.md) holds the
mission, the image rules and the code rules; this page says what applies here.

## The site

- **The same site, or better.** A change never loses a page, a word, a translation or an image the
  site served; one that adds says so in its pull request.
- **The engine at its pin.** The site builds against the commit `package.json` pins
  (`trillion3d.commit`, [README](README.md#the-engine)), never against a neighbouring folder. A
  bump is its own pull request, proved by `pnpm run validate`.
- **Examples demonstrate the engine and are never a target**: a page shows what the engine does,
  never tunes it; live counters describe the current browser and scene, never a comparison.
- **Every word is translated**: a key added in English is added in every `site/i18n/` language
  (`check:i18n`, `check:translations`).

## Code

- TypeScript everywhere, strict; everything in English. One test per changed behaviour; no dead
  code (`knip`).
- Every browser is the system Chrome through `launchChrome` (`scripts/chrome.ts`), and only in a
  script run by hand: no test opens a browser.
- Built files stay untracked: `dist/`, the scene caches (`compile:caches`), the API files
  (`generate:api`).
- Personal tools, prompts, indexes and settings stay untracked; nothing in the workflow requires an
  assistant.

## Contribution workflow

1. Claim the issue (`in progress`, assignee `pasquelin`); branch `<issue>-<name>` from `develop` in
   `.worktrees/<branch>/`, `pnpm install`.
2. Deliver every To-do and Proof item, nothing beyond.
3. Review the whole diff twice: simplification, then correctness against these rules; then
   `pnpm run validate` once on the final head.
4. Commit in English, push, open the pull request from `.github/PULL_REQUEST_TEMPLATE.md`,
   `Closes #<issue>` first, its "Local review before push" filled (the CI checks both), auto-merge
   on.
5. Merged into `develop`: remove the worktree and branch. A release pull request (`develop` → `main`)
   publishes the site (`site.yml`).
