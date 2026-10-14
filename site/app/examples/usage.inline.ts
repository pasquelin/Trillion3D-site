import { readFileSync } from 'node:fs'
import reference from '../../content/reference/api.json' with { type: 'json' }
import { themedEntries } from './list.ts'

/** How many examples an API entry names: the first ones in the gallery's learning order. */
export const SHOWN = 6

/** The types a page never names, by what writing them looks like. */
const WRITTEN_AS: Record<string, RegExp> = {
  WorldControls: /\bcontrols:\s*'|\.controls\.kind\s*=/,
  Scene: /\bscene\.(?:load|toJSON|fromJSON)\(/,
  Fog: /\.fog\s*=/,
  ObjectPhysics: /\.physics\s*=/,
  LoadedModel: /\bscene\.load\(/,
}

/** The types used wherever another entry is: what it returns, or the same thing. */
const SAME_AS: Record<string, string> = { World: 'createWorld', SceneFog: 'Fog' }

/** The module scripts of each ready example, in the gallery's order, their comments left out; what
 *  they import from the engine — each name and the local name it is read by (`controls as
 *  family`) — and every `name.member` they read. */
const pages = themedEntries
  .flatMap(({ ready }) => ready)
  .map(({ id, file }) => {
    const html = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
    const code = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
      .map((match) => match[1])
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '$1')
    const imported = new Map(
      [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/runtime\/engine\.js'/g)]
        .flatMap((match) => match[1].split(','))
        .map((name) => name.trim().split(/\s+as\s+/))
        .filter(([name]) => name)
        .map(([name, local = name]) => [name, local]),
    )
    // A lookahead, so that `a.b.c` gives both `a.b` and `b.c`.
    const members = new Set(
      [...code.matchAll(/\b([\w$]+)(?=\.([\w$]+))/g)].map(
        ([, name, member]) => `${name}.${member}`,
      ),
    )
    return { id, code, imported, members }
  })

/** Whether a page uses the entry `id`: a member as `family.member`, a value it imports from the
 *  engine, or a type as writing it looks like. */
function uses(id: string, page: (typeof pages)[number]): boolean {
  const { code, imported, members } = page
  if (SAME_AS[id]) return uses(SAME_AS[id], page)
  const [family, member] = id.split('.')
  if (member) return members.has(`${imported.get(family) ?? family}.${member}`)
  return imported.has(id) || Boolean(WRITTEN_AS[id]?.test(code))
}

/** The ready examples that use each API entry, by entry id, in the gallery's order. Read from the
 *  example pages when the portal is built. */
export const EXAMPLE_USES: Record<string, string[]> = Object.fromEntries(
  (reference as { id: string }[])
    .map(({ id }) => [
      id,
      pages
        .filter((page) => uses(id, page))
        .slice(0, SHOWN)
        .map((page) => page.id),
    ])
    .filter(([, ids]) => ids.length > 0),
)
