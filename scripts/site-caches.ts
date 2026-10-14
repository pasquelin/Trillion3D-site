/** The scene caches git never tracks, compiled from their committed sources by the native
 *  compiler of the pinned engine (`pnpm run build:native`), on demand (`pnpm run compile:caches`)
 *  and before their readers. */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { firstNewer } from '#engine/packages/sdk-node/src/compiler/freshness.mts'
import { modelScenes } from './docs/examples/models.ts'
import { ROOT } from './engine.ts'
import { heavyStep } from './heavy-lock.ts'
import {
  compileFullCache,
  type FullCompile,
  nativeCompiler,
  requireNativeCompiler,
  TRIANGLE_BUDGET,
} from './native-compiler.ts'

/** A source too heavy for git: one file of the release `DOWNLOADS_RELEASE`, fetched into
 *  `.scenes/` before its cook and refused unless its bytes hash to `sha256`. */
export interface Download {
  file: string
  sha256: string
}

/** A scene folder, relative to the root, holding `source` and the `cache` compiled from it; a
 *  `download` scene's source is that file instead, and its folder holds only the cache. */
export interface CookedScene extends Pick<
  FullCompile,
  'source' | 'cache' | 'simplification' | 'stdio' | 'threads' | 'ramMb'
> {
  directory: string
  download?: Download
}

/** The release of this repository whose assets are the downloaded sources. */
const DOWNLOADS_RELEASE =
  'https://github.com/pasquelin/Trillion3D-site/releases/download/scenes-orca-1/'

/** Where the downloaded sources are kept, git-ignored: outside `site/`, so never served. */
export const downloadPath = ({ file }: Download, root = ROOT) => resolve(root, '.scenes', file)

/** The folder of `scene`'s cache, relative to its directory: `cache` unless it names another. */
export const cacheOf = ({ cache = 'cache' }: CookedScene) => cache

const example = (name: string): CookedScene => ({
  directory: `site/assets/examples/${name}`,
  source: 'source',
  simplification: 'qem-endpoints',
  stdio: ['ignore', 'ignore', 'inherit'],
})

/** An NVIDIA ORCA scene (`CREDITS.md`), from its glTF conversion of the release: millions of
 *  triangles admitted in 8 GB on 4 threads, which the deploy's runner holds. */
const orca = (name: string, download: Download): CookedScene => ({
  ...example(name),
  source: `../../../../.scenes/${download.file}`,
  download,
  threads: 4,
  ramMb: 8192,
})

/** The examples whose source is committed as is, written by no script. */
const COMMITTED_SOURCES = ['hall', 'cesium-man', 'animated-morph-cube']

/** Every cooked scene: the examples (`modelScenes` and `COMMITTED_SOURCES`), the terrain tiles'
 *  exact cook beside their simplified one, and the gallery's. */
export const COOKED_SCENES: Record<string, CookedScene> = {
  ...Object.fromEntries(
    [...Object.keys(modelScenes), ...COMMITTED_SOURCES].map((name) => [name, example(name)]),
  ),
  'terrain-tiles-none': {
    ...example('terrain-tiles'),
    cache: 'cache-none',
    simplification: 'none',
  },
  'emerald-square': orca('emerald-square', {
    file: 'emerald-day.glb',
    sha256: '06866a47db0a96ae53024fbfb0ebfb8309165083f69243e5131d3ba1734bddb5',
  }),
  bistro: orca('bistro', {
    file: 'bistro-exterior-uv.glb',
    sha256: '296f71e62f9de576d2ba1b93cdb2b4efea589cbc773e9084e2f4253829edaf8d',
  }),
  observatory: {
    directory: 'site/assets/gallery/signature-architecture',
    source: 'source/geometry.gltf',
    simplification: 'qem-endpoints',
  },
}

/** The source folder of `scene`, absolute. */
export const sourceOf = ({ directory }: CookedScene, root = ROOT) =>
  resolve(root, directory, 'source')

/** Whether `manifest`, under `site/`, is in the cache of a scene `compile:caches` cooks, and exists
 *  once that cache is compiled: a checkout without the compiler (a documentation-only run) has
 *  none. */
export function isCookedManifest(manifest: string, root = ROOT): boolean {
  const path = `site/${manifest}`
  const scene = Object.values(COOKED_SCENES).find((cooked) =>
    path.startsWith(`${cooked.directory}/${cacheOf(cooked)}/`),
  )
  if (!scene) return false
  return (
    !existsSync(resolve(root, scene.directory, cacheOf(scene))) || existsSync(resolve(root, path))
  )
}

/** Written beside a compiled cache: the options it was compiled with and the source files it
 *  read, so a file removed or renamed since, which no timestamp shows, makes it stale. */
const stampPath = (scene: CookedScene, root = ROOT) =>
  resolve(root, scene.directory, cacheOf(scene), 'compiled-with.json')
const stampOf = (scene: CookedScene, root = ROOT) => {
  const { source, simplification = 'none', download } = scene
  const files = download
    ? [download.sha256]
    : readdirSync(sourceOf(scene, root), { recursive: true }).map(String).sort()
  return JSON.stringify({ source, simplification, budget: TRIANGLE_BUDGET, files })
}

/** The sha256 of the file at `path`, read a chunk at a time: a source may pass a gigabyte. */
export function sha256Of(path: string): string {
  const hash = createHash('sha256'),
    chunk = Buffer.alloc(1 << 22),
    file = openSync(path, 'r')
  try {
    for (let read; (read = readSync(file, chunk)) > 0;) hash.update(chunk.subarray(0, read))
  } finally {
    closeSync(file)
  }
  return hash.digest('hex')
}

/** Puts `download` under `.scenes/`, fetched from the release unless a file of its hash is there;
 *  a download of other bytes is removed and refused. */
export function fetchDownload(download: Download, root = ROOT, release = DOWNLOADS_RELEASE): void {
  const path = downloadPath(download, root)
  if (existsSync(path) && sha256Of(path) === download.sha256) return
  mkdirSync(resolve(path, '..'), { recursive: true })
  const partial = `${path}.part`
  const fetched = spawnSync(
    'curl',
    ['-fsSL', '--retry', '3', '-o', partial, `${release}${download.file}`],
    { stdio: 'inherit' },
  )
  if (fetched.error) throw fetched.error
  const hash = fetched.status === 0 ? sha256Of(partial) : null
  if (hash !== download.sha256) {
    rmSync(partial, { force: true })
    throw new Error(
      `${download.file}: ${hash ? `sha256 ${hash}, not ${download.sha256}` : 'download failed'}.`,
    )
  }
  renameSync(partial, path)
}

/** When the compiler was built, or null when there is none to compare with; a compiler older than
 *  its sources makes every cache stale, so the run refuses it instead of keeping its output. */
function compilerTime(): number | null {
  try {
    return statSync(nativeCompiler()).mtimeMs
  } catch (error) {
    return String(error).includes('COMPILER_STALE') ? Infinity : null
  }
}

/** Compiles the cache of `scene` again, from nothing, and stamps it. */
export function compileCache(scene: CookedScene): void {
  const { directory, download, ...compile } = scene
  if (download) fetchDownload(download)
  const cwd = resolve(ROOT, directory),
    cache = cacheOf(scene)
  rmSync(resolve(cwd, cache), { recursive: true, force: true })
  // A downloaded scene's folder holds only its cache, so nothing in git makes it.
  mkdirSync(cwd, { recursive: true })
  compileFullCache({ cwd, ...compile, cache })
  rmSync(resolve(cwd, cache, 'native/.lock'), { force: true })
  writeFileSync(stampPath(scene), stampOf(scene))
}

/** Whether the cache of `scene` is missing, compiled with other options, or older than a file of
 *  its source or than the compiler built at `compiled`. */
export function isStale(scene: CookedScene, root = ROOT, compiled = compilerTime()): boolean {
  const stamp = stampPath(scene, root)
  if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== stampOf(scene, root)) return true
  const since = statSync(stamp).mtimeMs
  if ((compiled ?? 0) > since) return true
  return !scene.download && firstNewer(sourceOf(scene, root), since) !== null
}

/** Compiles every stale cache of `scenes`. Without a compiler, a `required` run throws; another
 *  names what it left and goes on, for a caller that may read none of them. */
export function compileSiteCaches(required = true, scenes = Object.values(COOKED_SCENES)): void {
  const compiled = compilerTime()
  const stale = scenes.filter((scene) => isStale(scene, ROOT, compiled))
  if (!stale.length) return
  try {
    requireNativeCompiler()
  } catch (error) {
    if (required) throw error
    const names = stale.map((scene) => `${scene.directory}/${cacheOf(scene)}`).join(', ')
    console.warn(`Scene caches not compiled (${(error as Error).message}): ${names}.`)
    return
  }
  // Only a real compilation is a heavy step: a fresh check never waits for another worktree's.
  heavyStep('compile:caches', () => {
    for (const scene of stale) compileCache(scene)
  })
}

if (import.meta.filename === process.argv[1]) compileSiteCaches()
