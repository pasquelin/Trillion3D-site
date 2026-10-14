import assert from 'node:assert/strict'
import test from 'node:test'
import { readyEntries } from './list.ts'
import { EXAMPLE_USES, SHOWN } from './usage.inline.ts'

/** The families a reader looks for first, each by the entry that names it. */
const FAMILIES = [
  'createWorld',
  'geometry',
  'material',
  'light',
  'object',
  'effect',
  'Fog',
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

test('an entry names a bounded number of examples', () => {
  for (const examples of Object.values(EXAMPLE_USES)) assert.ok(examples.length <= SHOWN)
})
