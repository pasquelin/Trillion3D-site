/** The folder a core world module sits in, `/src/world/<folder>/`: the family it belongs to. */
const WORLD_FOLDER = /\/src\/world\/([a-zA-Z]+)\//

/** The browser world's own modules: the API its members call, its session, its saved scenes. */
const WORLD = /^packages\/sdk-browser\/src\/(?:api\/|session\/(?:world\/|saved\/|[^/]+$))/

/** Low-level maths and the camera bridge built on them: the "Math utilities" section. */
const MATH =
  /\/src\/(?:math|hiz)\/(?!oracles\.ts$)|sdk-browser\/src\/camera\/(?:engineCamera|world)\.ts$/
/** The camera controllers `world.controls` makes: they belong with the cameras they move. */
const CONTROLS = /sdk-browser\/src\/camera\/controls\//
/** Compiling a model, and the jobs a compilation runs as: "Node and compilation". */
const NODE = /^packages\/sdk-node\/|\/runtime\/jobs\.ts$/

/** Where a family lives, by the module its object is declared in: that module alone, or the whole
 *  folder of an `index.ts` (`materials/live/` for `texture`, `api/capability/` for `capability`). */
export const familyHome = (module: string) =>
  module.endsWith('/index.ts') ? module.slice(0, -'index.ts'.length) : module

/**
 * The reference section of an export: the world family its core folder names (the constant
 * families gathered under `constants`) or whose home holds it — `homes` gives each family's,
 * wherever the engine keeps it (`familyHome`) —, the browser world's own modules, then the maths,
 * the Node compiler and, for every other public symbol, `types`.
 */
export function sectionOf(module: string, homes: ReadonlyMap<string, string>): string {
  const folder = WORLD_FOLDER.exec(module)?.[1]
  if (folder === 'constants') return 'constants'
  if (folder && homes.has(folder)) return folder
  for (const [family, home] of homes)
    if (home.endsWith('/') ? module.startsWith(home) : module === home) return family
  if (WORLD.test(module)) return 'world'
  if (CONTROLS.test(module)) return 'camera'
  if (MATH.test(module)) return 'math-utilities'
  if (NODE.test(module)) return 'node'
  return 'types'
}
