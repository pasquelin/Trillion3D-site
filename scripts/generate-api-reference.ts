// The two API files git never tracks, from the declarations of the pinned engine's public entries
// (`.engine/`, `scripts/engine.ts`): the
// portal's reference, one entry per export, family member and world member with its signature and
// TSDoc; and the export inventory. `pnpm install` writes them, every reader rewrites them first
// when a source is newer. The translations, `api.<language>.json`, are the translators' alone.
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { ENGINE, ROOT } from './engine.ts'
import { repositoryFiles } from './repository-files.ts'

/** Where the reference and the inventory are written. */
export const API_FILES = {
  reference: 'site/content/reference/api.json',
  inventory: 'site/data/api-inventory.json',
} as const

/** The source files the two are read from: the declarations, the consumers, the generators. */
export const API_SOURCES = /\.(?:[cm]?[jt]sx?)$/

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

const modified = (file: string) => statSync(file, { throwIfNoEntry: false })?.mtimeMs

/** The source files of the checkout `root`, absolute. */
const sourcesOf = (root: string) =>
  (repositoryFiles(root) ?? [])
    .filter((file) => API_SOURCES.test(file))
    .map((file) => join(root, file))

/** Whether both files are newer than every source file of the engine and of the site: the
 *  declarations they read, the consumers the inventory names, their generators. */
function current(): boolean {
  const since = Math.min(...Object.values(API_FILES).map((file) => modified(join(ROOT, file)) ?? 0))
  const sources = [...sourcesOf(ENGINE), ...sourcesOf(ROOT)]
  return since > 0 && sources.every((file) => (modified(file) ?? 0) <= since)
}

/** Writes the reference and the inventory from the current sources, unless they are current. */
export async function generateApiFiles(): Promise<void> {
  if (current()) return
  // Loaded only here: TypeScript and the model cost a second to every reader of current files.
  const [
    { FAMILIES },
    { buildReference },
    { apiInventory },
    { refreshApiProgram, writeGenerated },
  ] = await Promise.all([
    import('../site/content/model.ts'),
    import('./api-reference/exports.ts'),
    import('./sdk-api-inventory.ts'),
    import('./sdk-api-model.ts'),
  ])
  refreshApiProgram()
  await writeGenerated(API_FILES.reference, json(buildReference(new Set(FAMILIES))))
  await writeGenerated(API_FILES.inventory, json(apiInventory()))
}

if (import.meta.filename === process.argv[1]) await generateApiFiles()
