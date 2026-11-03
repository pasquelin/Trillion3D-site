import { readFileSync } from 'node:fs'
import reference from '../../content/reference/api.json' with { type: 'json' }
import { themedEntries } from './list.ts'
import { entryIds, pageReads, uses, type ReferenceEntry } from './usage.ts'

/** How many examples an API entry names: the first ones in the gallery's learning order. */
export const SHOWN = 6

/** What each ready example reads of the engine (`pageReads`), in the gallery's order. */
const pages = themedEntries
  .flatMap(({ ready }) => ready)
  .map(({ id, file }) => ({
    id,
    ...pageReads(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')),
  }))

/** The ready examples that use each API entry, by entry id, in the gallery's order, and each
 *  member a family entry lists (`controls.transform`) by its own. Read from the example pages when
 *  the portal is built. */
export const EXAMPLE_USES: Record<string, string[]> = Object.fromEntries(
  (reference as ReferenceEntry[])
    .flatMap(entryIds)
    .map((id) => [
      id,
      pages
        .filter((page) => uses(id, page))
        .slice(0, SHOWN)
        .map((page) => page.id),
    ])
    .filter(([, ids]) => ids.length > 0),
)
