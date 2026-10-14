/**
 * The Trillion3D engine the site is built against, at the commit `package.json` pins
 * (`trillion3d.commit`), checked out under `.engine/` (ignored by git). The site reads the engine
 * there and nowhere else: its sources import it as `#engine/<path>` (the `imports` field of
 * `package.json`), its scripts as `ENGINE`. Only what the site reads is fetched (`SPARSE`).
 *
 * With `TRILLION3D_ENGINE=<folder>` in the environment, `.engine` is a link to that local engine
 * checkout instead, to build the site against a tree being worked on; the variable stays set while
 * it is used, since every install reruns this script (`prepare`). Without it, the pinned commit
 * comes back.
 *
 * A pnpm git dependency cannot carry it: pnpm packs a git dependency by its `files` field, which
 * ships the built SDK and neither the sources the site bundles nor the compiler's crate.
 *
 *   pnpm run engine          the pinned commit (or the local override) under `.engine/`
 *   pnpm run build:native    the same, then the native compiler the scene caches are cooked with
 */
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readlinkSync, symlinkSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The site's repository root. */
export const ROOT = resolve(import.meta.dirname, '..')

/** Where the engine is checked out, or linked. */
export const ENGINE = resolve(ROOT, '.engine')

/** The engine folders the site reads (cone mode also brings the files of their parent folders,
 *  the root's among them: the notices, `.gitmodules`). `packages`: the browser engine, its
 *  workers and WebAssembly, the maths, the public facade the API reference reads, the native
 *  compiler's crate and the Jolt submodule it links. `.cargo`: the compiler's build flags.
 *  `bench/kit`: the measurement contract the examples' kit reads. `scripts/installed-package`: the
 *  package fixture the Install page proof packs. */
const SPARSE = ['packages', '.cargo', 'bench/kit', 'scripts/installed-package']

/** The submodule the native compiler links. */
const JOLT = 'packages/physics-jolt-wasm/JoltPhysics'

/** The repository and commit `package.json` pins. */
export function pinnedEngine(): { repository: string; commit: string } {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    trillion3d: { repository: string; commit: string }
  }
  const { repository, commit } = manifest.trillion3d
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('trillion3d.commit is not a full SHA')
  return { repository, commit }
}

const git = (...args: string[]) =>
  execFileSync('git', ['-C', ENGINE, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim()

const isLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/** Links `.engine` to the local checkout `folder`, unless it already is. */
async function linkEngine(folder: string) {
  const target = resolve(folder)
  if (!existsSync(resolve(target, 'packages/sdk-browser/src/index.ts')))
    throw new Error(`TRILLION3D_ENGINE=${folder} is no Trillion3D checkout`)
  if (isLink(ENGINE) && resolve(ROOT, readlinkSync(ENGINE)) === target) return
  await rm(ENGINE, { recursive: true, force: true })
  symlinkSync(target, ENGINE, 'dir')
}

/** Checks out the pinned commit under `.engine/`, unless it is already there. */
async function checkoutPinned() {
  const { repository, commit } = pinnedEngine()
  if (isLink(ENGINE) || !existsSync(resolve(ENGINE, '.git')))
    await rm(ENGINE, { recursive: true, force: true })
  if (!existsSync(ENGINE)) {
    execFileSync('git', ['init', '--quiet', ENGINE])
    git('remote', 'add', 'origin', repository)
  }
  git('remote', 'set-url', 'origin', repository)
  // Set every time: a folder this script comes to read is fetched by the next run.
  git('sparse-checkout', 'set', '--cone', ...SPARSE)
  let head = ''
  try {
    head = git('rev-parse', 'HEAD')
  } catch {
    // A fresh folder has no commit yet.
  }
  if (head === commit) return
  git('fetch', '--quiet', '--depth', '1', '--filter=blob:none', 'origin', commit)
  git('checkout', '--quiet', '--detach', '--force', 'FETCH_HEAD')
}

/** The engine under `.engine/`: the local checkout `TRILLION3D_ENGINE` names, else the pinned
 *  commit. Returns what it is. */
export async function checkoutEngine(): Promise<string> {
  const local = process.env.TRILLION3D_ENGINE
  if (local) {
    await linkEngine(local)
    return `local checkout ${resolve(local)}`
  }
  await checkoutPinned()
  return pinnedEngine().commit
}

/** Whether the engine's commit holds `path` (a file or folder from its root), fetched or not: the
 *  sparse checkout holds every folder's listing, not every file. */
export function engineHas(path: string): boolean {
  try {
    git('cat-file', '-e', `HEAD:${path}`)
    return true
  } catch {
    return false
  }
}

/** Builds the native compiler in the engine's crate, from the engine's root so that its
 *  `.cargo/config.toml` applies; the pinned checkout first fetches the Jolt submodule it links. */
export function buildNativeCompiler() {
  if (!isLink(ENGINE)) git('submodule', 'update', '--init', '--depth', '1', '--quiet', JOLT)
  const manifest = 'packages/asset-compiler-rust/Cargo.toml'
  execFileSync(
    'cargo',
    ['build', '--release', '--locked', '--all-features', '--manifest-path', manifest],
    { cwd: ENGINE, stdio: 'inherit' },
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`engine: ${await checkoutEngine()} in ${ENGINE}`)
  if (process.argv.includes('--native')) buildNativeCompiler()
}
