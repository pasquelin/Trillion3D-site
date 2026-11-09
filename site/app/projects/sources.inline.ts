import { existsSync, readdirSync } from 'node:fs'

/** The site's assets, where each compiled scene's folder holds its `cache` and, unless its source
 *  is downloaded, the `source` it is compiled from. */
const ASSETS = new URL('../../assets/', import.meta.url)

/** The files under `folder`, by their `/`-separated path in it. */
const filesUnder = (folder: URL) =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const parent = entry.parentPath.slice(decodeURIComponent(folder.pathname).length)
      return [parent, entry.name].filter(Boolean).join('/')
    })
    .sort()

/**
 * Each compiled scene of the site, by its folder under `site/assets/` (`examples/bust`): the files
 * of its source folder, an empty list for one whose source is downloaded and never served (the
 * NVIDIA ORCA scenes). Read when the portal is built: an editor project copies a scene's source
 * when its page loads the scene compiled.
 */
export const SCENE_SOURCES: Record<string, string[]> = Object.fromEntries(
  ['examples', 'gallery'].flatMap((kind) =>
    readdirSync(new URL(`${kind}/`, ASSETS), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap(({ name }) => {
        const folder = new URL(`${kind}/${name}/`, ASSETS),
          source = new URL('source/', folder)
        if (existsSync(source)) return [[`${kind}/${name}`, filesUnder(source)]]
        return existsSync(new URL('cache/', folder)) ? [[`${kind}/${name}`, []]] : []
      }),
  ),
)
