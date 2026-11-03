import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readyEntries } from './list.ts'
import { EXAMPLE_USES, SHOWN } from './usage.inline.ts'
import { entryIds, pageReads, uses } from './usage.ts'

/** The families a reader looks for first, each by the entry that names it. */
const FAMILIES = [
  'createWorld',
  'geometry',
  'material',
  'light',
  'object',
  'effect',
  'world.physics',
  'joint',
  'animation',
  'world.raycast',
  'loader',
  'LoadedModel',
  'controls',
  // The types found by how a page writes them, or by the entry they come with.
  'World',
  'WorldControls',
  'Scene',
  'SceneFog',
  'ObjectPhysics',
]

test('every main API family and type names a ready example that uses it', () => {
  const ready = new Set(readyEntries.map(({ id }) => id))
  for (const family of FAMILIES) {
    const examples = EXAMPLE_USES[family] ?? []
    assert.ok(examples.length > 0, `${family} names no example`)
    for (const id of examples) assert.ok(ready.has(id), `${family} names ${id}, not ready`)
  }
})

test('a family imported under another name is still found', () => {
  // move-rotate-scale-gizmo reads `controls` as `family`: `family.transform(world)`.
  assert.ok(EXAMPLE_USES['controls.transform']?.includes('move-rotate-scale-gizmo'))
})

test("a family's member written with its signature is found by its bare name", () => {
  // The reference lists `grid(size?: number, …)` under `helper`; a page writes `helper.grid(16)`.
  assert.ok((EXAMPLE_USES['helper.grid'] ?? []).length > 0)
  assert.ok(!Object.keys(EXAMPLE_USES).some((id) => /[(?]/.test(id)))
})

test("a member of a family of the world's names only pages that read it", () => {
  // `world.controls` lists `update(delta?: number)`: a page that reads the controls but never
  // updates them is not named for it.
  const examples = EXAMPLE_USES['world.controls.update'] ?? []
  assert.ok(examples.length > 0)
  for (const id of examples) {
    const { file } = readyEntries.find((entry) => entry.id === id)!
    const html = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
    assert.match(html, /\.controls\.update\(/, `${id} never updates the controls`)
  }
})

test("a member of the world's family is credited to a page that reads the world's", () => {
  const page = (code: string) => pageReads(`<script type="module">${code}</script>`)
  const credited = (code: string) => uses('world.controls.update', page(code))
  assert.equal(credited('world.controls.update()'), true)
  // The controls of another object, or a name of the page's own.
  assert.equal(credited('viewer.controls.update()'), false)
  assert.equal(credited('controls.update()'), false)
})

test("a family's members are looked for by the names a page can read", () => {
  const members = ['grid(size?: number)', 'flat?', 'screen-error'].map((name) => ({ name }))
  assert.deepEqual(entryIds({ id: 'helper', kind: 'Constant', members }), [
    'helper',
    'helper.grid',
    'helper.flat',
  ])
  // A type's members are its values', never a family's.
  assert.deepEqual(entryIds({ id: 'Action', kind: 'Type', members }), ['Action'])
})

test('an entry names a bounded number of examples', () => {
  for (const examples of Object.values(EXAMPLE_USES)) assert.ok(examples.length <= SHOWN)
})
