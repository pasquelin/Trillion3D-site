import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { copyChanged } from '../copy-changed.ts'

/** The model library, under the root: every imported model once, as imported (`CREDITS.md`). */
export const MODEL_LIBRARY = 'site/assets/examples/models'

/**
 * The library's files an example scene's source folder serves as its own, kept once in the
 * library: by scene folder (`site/assets/examples/<scene>`), the path under its `source/` -> the
 * path under `MODEL_LIBRARY`, or a library folder (ending in `/`) whose every file it serves at
 * the same path. Placed there before a cook or a build reads the folder (`placeLibraryFiles`), so
 * the compiler reads them and the published site serves them at the same addresses as before.
 */
export const LIBRARY_FILES: Readonly<Record<string, string | Readonly<Record<string, string>>>> = {
  bust: {
    'marble_bust_01.bin': 'marble-bust/marble_bust_01.bin',
    'textures/marble_bust_01_diff_1k.jpg': 'marble-bust/textures/marble_bust_01_diff_1k.jpg',
    'textures/marble_bust_01_nor_gl_1k.jpg': 'marble-bust/textures/marble_bust_01_nor_gl_1k.jpg',
    'textures/marble_bust_01_rough_1k.jpg': 'marble-bust/textures/marble_bust_01_rough_1k.jpg',
  },
  'marble-bust': 'marble-bust/',
  'street-corner': {
    'lantaarn.mtl': 'lantern/lantaarn.mtl',
    'lantaarn.png': 'lantern/lantaarn.png',
  },
  crates: {
    'box1.mtl': 'crate/box1.mtl',
    'box1.png': 'crate/box1.png',
  },
}

/**
 * The list of the files placed in a scene's source folder, written in the scene folder beside it:
 * a git ignore file naming each of them and itself, so git ignores exactly what was placed, and
 * the next placement removes what the library no longer serves. Never published.
 */
export const PLACED_LIST = '.gitignore'
const PLACED_HEADER = '# Written by `placeLibraryFiles` (`scripts/docs/examples/library.ts`).'

/** The files `LIBRARY_FILES` names for `scene`, a library folder expanded to its files, hidden
 *  ones (`.DS_Store`) left out: the path under its `source/` -> the path under `library`. */
function libraryFilesOf(scene: string, library: string): Record<string, string> {
  const files = LIBRARY_FILES[scene] ?? {}
  if (typeof files !== 'string') return { ...files }
  const folder = resolve(library, files)
  return Object.fromEntries(
    readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => {
        const path = relative(folder, resolve(entry.parentPath, entry.name)).split(sep).join('/')
        return [path, `${files}${path}`]
      }),
  )
}

/** A path under `source/` as the git ignore pattern of the scene folder matching only it, and
 *  back (`null` for a line that is no such pattern). */
const toPattern = (path: string) => `/source/${path.replace(/[\\*?[\]!# ]/g, '\\$&')}`
const fromPattern = (line: string) =>
  line.startsWith('/source/') ? line.slice('/source/'.length).replace(/\\(.)/g, '$1') : null

/**
 * Places in `source`, the source folder of the example scene `scene`, the files of the library
 * folder `library` it serves (`LIBRARY_FILES`), each only when missing or changed
 * (`copyChanged`), and lists them in its `PLACED_LIST`; a file the previous list names and the
 * library no longer serves is removed, with the folders it leaves empty.
 */
export function placeLibraryFiles(scene: string, source: string, library: string): void {
  const files = libraryFilesOf(scene, library)
  for (const [path, file] of Object.entries(files))
    copyChanged(resolve(library, file), resolve(source, path))
  const list = resolve(source, '..', PLACED_LIST)
  const previous = existsSync(list) ? readFileSync(list, 'utf8') : ''
  // A list this function did not write is not its own: it is left as is.
  if (previous && !previous.startsWith(`${PLACED_HEADER}\n`)) return
  for (const path of previous.split('\n').map(fromPattern))
    if (path !== null && !Object.hasOwn(files, path)) removePlaced(source, path)
  const paths = Object.keys(files).sort()
  if (!paths.length) {
    rmSync(list, { force: true })
    return
  }
  const written = [PLACED_HEADER, `/${PLACED_LIST}`, ...paths.map(toPattern), ''].join('\n')
  // Written only when it changes: the development server rebuilds on a write under `site/`.
  if (written !== previous) writeFileSync(list, written)
}

/** Removes the placed file `path` of `source`, then each folder up to `source` it leaves empty. */
function removePlaced(source: string, path: string) {
  rmSync(resolve(source, path), { force: true })
  for (let folder = dirname(resolve(source, path)); folder !== source; folder = dirname(folder))
    try {
      rmdirSync(folder)
    } catch {
      return
    }
}
