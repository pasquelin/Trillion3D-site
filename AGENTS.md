# Trillion3D Site — agent rules

This repository follows the rules of Trillion3D: its `AGENTS.md` and `CONTRIBUTING.md`
(https://github.com/pasquelin/Trillion3D), with [CONTRIBUTING.md](CONTRIBUTING.md) for what applies
here. What differs:

- **The engine is consumed, never copied.** The site reads it at the commit `package.json` pins
  (`trillion3d.commit`), checked out under `.engine/` by `pnpm run engine`, as `#engine/<path>` in
  the sources and `ENGINE` in the scripts. An engine defect is reported on Trillion3D, not patched
  here; nothing under `.engine/` is edited.
- **Nothing outside this repository is read**, but the engine checkout: no neighbouring folder, no
  host path.
- **No image loss**: the built site is the same site, page for page, after any change but one that
  says what it adds.
- **Benches, Chrome, timings and thumbnails are the recette's**
  (`scripts/docs/examples-thumbnails.ts`, `scripts/site-first-load.ts`,
  `scripts/prove-install-page.ts`), after the merges; they never block one.
- **Built files are never committed**: `dist/`, the scene caches and the API files are rebuilt on
  demand.
- **Branches** are `<issue>-<short-name>`, cut from `develop` in `.worktrees/<branch>/`. Every change
  reaches `develop` through a pull request with `validate` and `pr-body` green; a release pull
  request carries `develop` to `main`, which publishes the site.
- Gate: `pnpm run validate`. All wording in the repository is in English. Commits carry no trailer,
  co-author, tool name or forced identity.
