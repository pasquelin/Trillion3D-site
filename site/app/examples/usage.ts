/**
 * How an example page uses the API, read from its source when the portal is built
 * (`usage.inline.ts`): what its module scripts read of the engine, and the reference's entries
 * looked for in it.
 */

/** The types a page never names, by what writing them looks like. */
const WRITTEN_AS: Record<string, RegExp> = {
  WorldControls: /\bcontrols:\s*'|\.controls\.kind\s*=/,
  Scene: /\bscene\.(?:load|toJSON|fromJSON)\(/,
  SceneFog: /\bheightFog:/,
  ObjectPhysics: /\.physics\s*=/,
  LoadedModel: /\bscene\.load\(/,
}

/** The types used wherever another entry is: what it returns, or the same thing. */
const SAME_AS: Record<string, string> = { World: 'createWorld' }

/** The module scripts of a page (`html`), their comments left out; what they import from the
 *  engine — each name and the local name it is read by (`controls as family`) — and every
 *  `name.member` they read. */
export function pageReads(html: string) {
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
    [...code.matchAll(/\b([\w$]+)(?=\.([\w$]+))/g)].map(([, name, member]) => `${name}.${member}`),
  )
  return { code, imported, members }
}

type PageReads = ReturnType<typeof pageReads>

/**
 * Whether a page uses the entry `id`: a member as `family.member`, a value it imports from the
 * engine, or a type as writing it looks like. A member of a family of the world's
 * (`world.controls.update`) is read in two steps, `world.controls` then `controls.update`: the
 * pages name their world `world`, and a page is credited with it only when it reads both.
 */
export function uses(id: string, page: PageReads): boolean {
  const { code, imported, members } = page
  if (SAME_AS[id]) return uses(SAME_AS[id], page)
  const dot = id.lastIndexOf('.')
  if (dot < 0) return imported.has(id) || Boolean(WRITTEN_AS[id]?.test(code))
  const [family, member] = [id.slice(0, dot), id.slice(dot + 1)]
  const inner = family.lastIndexOf('.')
  if (inner < 0) return members.has(`${imported.get(family) ?? family}.${member}`)
  return uses(family, page) && members.has(`${family.slice(inner + 1)}.${member}`)
}

/** An API entry as the reference lists it: a family (a `Constant` with members) lists its
 *  members, each named with its signature when it is a function (`grid(size?: number)`) and
 *  marked `?` when optional; a table's keys may be no identifier (`screen-error`). */
export interface ReferenceEntry {
  id: string
  kind: string
  members?: { name: string }[]
}

/** An entry's id, and a family's members by their own (`helper.grid`): each member's bare name,
 *  its signature and its optional mark left out, when it is an identifier a page can read. */
export function entryIds({ id, kind, members = [] }: ReferenceEntry): string[] {
  if (kind !== 'Constant') return [id]
  const names = members
    .map(({ name }) => name.replace(/[(?][\s\S]*$/, ''))
    .filter((name) => /^[\w$]+$/.test(name))
  return [id, ...names.map((name) => `${id}.${name}`)]
}
