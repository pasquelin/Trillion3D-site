<div align="center">

# Trillion3D Site

### The website of Trillion3D: the learning portal, the API reference and the examples, built against the pinned engine.

[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-2b2d30?logo=typescript&logoColor=3178c6)](tsconfig.site.json)
[![WebGPU](https://img.shields.io/badge/WebGPU-Trillion3D%20engine-2b2d30?logo=webgpu&logoColor=6fa8dc)](https://github.com/pasquelin/Trillion3D)
[![Node 22](https://img.shields.io/badge/Node-%E2%89%A522.18-2b2d30?logo=node.js&logoColor=6da95f)](#quick-start)
[![pnpm](https://img.shields.io/badge/pnpm-11-2b2d30?logo=pnpm&logoColor=f69220)](#quick-start)
[![Quality](https://github.com/pasquelin/Trillion3D-site/actions/workflows/quality.yml/badge.svg)](https://github.com/pasquelin/Trillion3D-site/actions/workflows/quality.yml)
[![Site](https://github.com/pasquelin/Trillion3D-site/actions/workflows/site.yml/badge.svg)](https://github.com/pasquelin/Trillion3D-site/actions/workflows/site.yml)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-2b2d30)](#licence)

**[Visit it ↗](https://www.trillion3d.com/)** · **[Trillion3D ↗](https://github.com/pasquelin/Trillion3D)** · **[Quick start](#quick-start)** · **[Commands](#commands)** · **[Structure](#structure)** · **[The engine](#the-engine)** · **[Deploy](#deploy)**

</div>

## What it is

https://www.trillion3d.com: a React portal with hash routes (`#/<locale>/...`) that teaches the
engine, documents its whole public API (generated from the engine's declarations) and frames one
standalone page per example, each drawn live by the engine in the browser. Every word is translated; the examples' scenes are compiled into Trillion3D caches by
the engine's native compiler.

It lives apart from Trillion3D so that the engine's checks never build a website, and the site moves
to a newer engine by one change of its pin. [docs/LEARNING_PORTAL.md](docs/LEARNING_PORTAL.md) is
the maintenance map: which folder holds what, how to add an example, a page or a language.

## Quick start

Node ≥ 22.18, pnpm 11, git; Rust (stable) and CMake to cook the scene caches.

```sh
pnpm install               # dependencies, the pinned engine under .engine/, the API files
pnpm run docs:serve        # build dist/site/ and serve it on http://127.0.0.1:4177/
```

The examples draw their scenes from compiled caches, which git never tracks. To cook them:

```sh
pnpm run build:native      # the pinned engine's native compiler, built with Cargo
pnpm run compile:caches    # every scene cache of site/assets/
```

## Commands

| Command                       | What it does                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `pnpm run engine`             | Checks out the pinned Trillion3D commit under `.engine/` (what the site reads) |
| `pnpm run build:native`       | The same, then builds the engine's native compiler                             |
| `pnpm run compile:caches`     | Compiles the scene caches of the examples and the gallery                      |
| `pnpm run generate:api`       | Writes the API reference and inventory from the engine's declarations          |
| `pnpm run build:docs`         | Builds the whole site into `dist/site/`                                        |
| `pnpm run docs:serve`         | Builds, then serves `dist/site/` cross-origin isolated (`PORT` overrides)      |
| `pnpm run docs:dev`           | The same, rebuilding and reloading on each change of `site/` or the engine     |
| `pnpm run docs:gallery`       | Regenerates the gallery's observatory and compiles its cache                   |
| `pnpm run test:docs`          | Every unit test (`node --test`)                                                |
| `pnpm run validate`           | Every gate the CI runs, in its order                                           |
| `pnpm run check:site-types`   | Type-checks `site/` against the engine                                         |
| `pnpm run check:tools-types`  | Type-checks the scripts and tests                                              |
| `pnpm run check:links`        | Every local link of the Markdown and HTML files                                |
| `pnpm run check:i18n`         | Every language gives English's keys                                            |
| `pnpm run check:translations` | Every translation follows its English (`--write`, `--accept <entry>`)          |
| `pnpm run check:english`      | A ratchet on French words left in the code                                     |
| `pnpm run check:thumbnails`   | Lists the examples whose thumbnail is still to capture (a report)              |
| `pnpm run check:docs-bundles` | Refuses a built file tracked by git                                            |

## Structure

```text
site/app/        the portal (React): primitives ui/, layouts layout/, pages, editor
site/content/    entries, API reference translations, examples list; site/demos/ per-entry demos
site/i18n/       the portal's words, one file a language; site/examples/i18n/ the examples' words
site/examples/   one standalone page per example, and their kit (kit/)
site/assets/     the examples' and the gallery's scene sources, thumbnails; site/data/
scripts/docs/    the build, the servers, the example scene generators, the tests
scripts/         the engine checkout, the API generator, the caches, the checks
tests/           the portal's integration test
```

## The engine

The site reads Trillion3D at the commit `package.json` pins:

```json
"trillion3d": {
  "repository": "https://github.com/pasquelin/Trillion3D.git",
  "commit": "2be916b85d502e0346dae018284dd578e89f317d"
}
```

`pnpm run engine` (`scripts/engine.ts`, also run by `pnpm install`) checks that commit out under
`.engine/`, ignored by git: a shallow, sparse, detached checkout of only what the site reads —
`packages/` (the browser SDK and its workers and WebAssembly, the maths, the public facade the API
reference reads, the native compiler's crate and its Jolt submodule), `.cargo/` (the compiler's
build flags), `bench/kit/` (the measurement contract of the examples' kit) and
`scripts/installed-package/` (the package fixture of the Install page proof). The sources import
the engine as `#engine/<path>` (the `imports` field of `package.json`, which Node, TypeScript and
esbuild all read); the scripts reach it as `ENGINE`. Nothing of the engine is copied here.

A pnpm git dependency cannot carry it: pnpm packs a git dependency by its `files` field, which
ships the built SDK and neither the sources the site bundles nor the compiler's crate.

- **Bump the pin**: set `trillion3d.commit` to the new full SHA, run `pnpm install` (or
  `pnpm run engine`), then `pnpm run validate`; one pull request.
- **Build against a local engine**: `export TRILLION3D_ENGINE=../Trillion3D`, then
  `pnpm run engine`, makes `.engine` a link to that checkout. Keep the variable set while you work:
  `pnpm install` (and the install pnpm may run before a script) reruns `pnpm run engine`.
  `unset TRILLION3D_ENGINE && pnpm run engine` puts the pinned commit back.

## Deploy

`.github/workflows/site.yml` builds the site on every pull request and push to `develop` and `main`. On a push to
`main`, or a manual run asked to deploy (`gh workflow run site.yml -f deploy=true --ref main`), it
also builds the engine's native compiler, cooks the scene caches, builds the published tree (with
the audience measurement), brotli-compresses the caches' objects, checks the file-count floor,
gzips the text files and transfers `dist/site/` with rsync to the web root, leaving `openworld/`
(pasquelin/Trillion3D-openworld's) and `.well-known/` alone. It then checks that the canonical
address the page declares, https://www.trillion3d.com/, answers cross-origin isolated
(`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`): without
it `crossOriginIsolated` is false and the physics falls back to one thread.

What the server holds, as for the open world:

- **The web root**, `/data/pasquelin/trillion3d/`, beside the open world's folder; nginx serves it
  for `www.trillion3d.com` with the two headers above, `gzip_static`, and the `.br` objects of the
  scene caches to a browser that accepts brotli.
- **A deploy key restricted to that root**, write-only, in the deploy user's `authorized_keys`:
  `command="/usr/bin/rrsync -wo /data/pasquelin/trillion3d",restrict ssh-ed25519 AAAA… github-actions-trillion3d-site`.
- **Four repository secrets**: `DEPLOY_SSH_KEY` (the private key), `DEPLOY_KNOWN_HOSTS` (the
  server's host key line), `DEPLOY_TARGET` (`user@host`) and `DEPLOY_SSH_PORT`. Until they are set,
  the deploy job fails with the list of those missing; the build stays green. A run started before
  the secrets were set does not see them: rerun only its deploy job, `gh run rerun <id> --failed`.

## Contributing

The rules are Trillion3D's, with what differs here in [AGENTS.md](AGENTS.md) and
[CONTRIBUTING.md](CONTRIBUTING.md): one issue and one pull request per change, on a branch
`<issue>-<short-name>` cut from `develop`, with `validate` and `pr-body` green; a release pull
request carries `develop` to `main`. `pnpm install` installs
the tracked git hooks; `.github/ruleset.json` is the ruleset applied to `develop` and `main`.

## Licence

Trillion3D Site is published under the [PolyForm Noncommercial License 1.0.0](LICENSE): free for
noncommercial use, study, research and personal projects. **Commercial use requires a separate
licence** from the copyright holder — open an issue or contact the author. Third-party models and
textures keep their own licences ([docs/ASSET_LICENSE_AUDIT.md](docs/ASSET_LICENSE_AUDIT.md),
`site/assets/examples/CREDITS.md`).

Copyright © 2026 Alban Pasquelin.
