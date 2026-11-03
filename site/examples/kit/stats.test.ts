import assert from 'node:assert/strict'
import { test } from 'node:test'
import { announceWorld, type PageWorld } from './pageWorld.ts'
import { oneOverlay, workbenchOnPageWorlds } from './stats.ts'

/** A turn of the microtask queue: the page's own code has run to its first wait. */
const pageCodeRan = () => new Promise<void>((resolve) => queueMicrotask(resolve))

/** A page's one overlay, opened as a log says: worlds named `a`, `b`, `c`. */
function anOverlay() {
  const worlds = ['a', 'b', 'c'].map(() => ({}) as PageWorld)
  const name = new Map<unknown, string>(worlds.map((world, k) => [world, 'abc'[k]]))
  const told: string[] = []
  const overlay = oneOverlay((world, corner) => {
    told.push(`open ${name.get(world)} ${corner}`)
    return () => told.push(`close ${name.get(world)}`)
  })
  return { ...overlay, worlds, told }
}

test("an overlay the page starts is the page's: another world's disposal leaves it", async () => {
  const {
    start,
    follow,
    worlds: [a, b, c],
    told,
  } = anOverlay()
  follow()
  announceWorld(a, true)
  announceWorld(b, true)
  // The page's own code, before its first wait.
  start(b, 'top-left')
  await pageCodeRan()
  announceWorld(a, false)
  await pageCodeRan()
  assert.deepEqual(told, ['open b top-left'])
  // Its own world gone, it goes with it; the next world the page makes takes the overlay.
  announceWorld(b, false)
  announceWorld(c, true)
  await pageCodeRan()
  assert.deepEqual(told, ['open b top-left', 'close b', 'open c bottom-left'])
  announceWorld(c, false)
})

test('an overlay the page stops comes back on the next world it makes', async () => {
  const {
    start,
    follow,
    worlds: [a, b],
    told,
  } = anOverlay()
  follow()
  announceWorld(a, true)
  await pageCodeRan()
  // After its first wait, the page asks for the overlay: it gets the one running, and stops it.
  start(a)()
  announceWorld(b, true)
  await pageCodeRan()
  assert.deepEqual(told, ['open a bottom-left', 'close a', 'open b bottom-left'])
  announceWorld(a, false)
  announceWorld(b, false)
})

test('a stale stop leaves the overlay that runs', () => {
  const {
    start,
    worlds: [a, b, c],
    told,
  } = anOverlay()
  const stopA = start(a)
  stopA()
  const stopB = start(b)
  stopA()
  // One overlay still runs: a later call returns its stop and opens none.
  assert.equal(start(c), stopB)
  assert.deepEqual(told, ['open a bottom-left', 'close a', 'open b bottom-left'])
  stopB()
})

test('?workbench publishes the instruments, which read nothing while no panel is mounted', () => {
  workbenchOnPageWorlds('?lang=fr')
  assert.equal('__workbench' in globalThis, false)
  workbenchOnPageWorlds('?workbench&lang=fr')
  const { __workbench } = globalThis as unknown as {
    __workbench: { read(): unknown; report: unknown }
  }
  assert.deepEqual([__workbench.read(), __workbench.report], [null, null])
})
