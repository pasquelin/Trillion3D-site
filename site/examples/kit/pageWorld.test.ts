import assert from 'node:assert/strict'
import { test } from 'node:test'
import { announceWorld, followPageWorld, onWorld, pageWorlds, type PageWorld } from './pageWorld.ts'

/** A world as the kit's listeners see it: none of them is called on it here. */
const aWorld = () => ({}) as PageWorld

/** A turn of the microtask queue: the page's own code has run to its first wait. */
const pageCodeRan = () => new Promise<void>((resolve) => queueMicrotask(resolve))

test('every listener hears every world, made and disposed, till it stops hearing', () => {
  const stats: [PageWorld, boolean][] = [],
    bench: [PageWorld, boolean][] = []
  const stopStats = onWorld((world, live) => stats.push([world, live]))
  const stopBench = onWorld((world, live) => bench.push([world, live]))
  const [first, second] = [aWorld(), aWorld()]
  announceWorld(first, true)
  announceWorld(second, true)
  assert.deepEqual(pageWorlds(), [first, second])
  stopStats()
  announceWorld(first, false)
  assert.deepEqual(pageWorlds(), [second])
  assert.deepEqual(stats, [
    [first, true],
    [second, true],
  ])
  assert.deepEqual(bench, [
    [first, true],
    [second, true],
    [first, false],
  ])
  stopBench()
  announceWorld(second, false)
})

/** Worlds named for what a follower tells of them, and that follower's log. */
function named(...names: string[]) {
  const worlds = names.map(aWorld)
  const name = new Map(worlds.map((world, k) => [world, names[k]]))
  const told: string[] = []
  const log = (what: string, world: PageWorld) => told.push(`${what} ${name.get(world)}`)
  return { worlds, told, log }
}

/** A follower whose consumer says from its own state whether it runs: `on`, the world it runs
 *  on, which the page sets too when it starts or stops it itself. */
function aFollower(log: (what: string, world: PageWorld) => void) {
  const state = { on: null as PageWorld | null }
  const follow = followPageWorld(
    (world) => {
      state.on = world
      log('start', world)
      return () => {
        state.on = null
        log('stop', world)
      }
    },
    { running: () => state.on !== null },
  )
  return { follow, state }
}

test('a follower takes the first world after the page code; once it is gone, the next made', async () => {
  const {
    worlds: [first, second, third],
    told,
    log,
  } = named('first', 'second', 'third')
  const { follow } = aFollower(log)
  announceWorld(first, true)
  announceWorld(second, true)
  assert.deepEqual(told, [])
  await pageCodeRan()
  // One at a time: the second world made is left to the page.
  assert.deepEqual(told, ['start first'])
  announceWorld(first, false)
  await pageCodeRan()
  // The world made before is never taken: the next one the page makes is.
  assert.deepEqual(told, ['start first', 'stop first'])
  announceWorld(third, true)
  await pageCodeRan()
  assert.deepEqual(told.slice(2), ['start third'])
  follow(second)
  assert.deepEqual(told.slice(3), ['stop third', 'start second'])
  announceWorld(second, false)
  announceWorld(third, false)
  await pageCodeRan()
  assert.deepEqual(told.slice(5), ['stop second'])
})

test('what the page runs itself is never taken over; once it stops it, the next world is', async () => {
  const {
    worlds: [own, next],
    told,
    log,
  } = named('own', 'next')
  const { follow, state } = aFollower(log)
  announceWorld(own, true)
  // The page starts it on its own world, before its first wait.
  state.on = own
  await pageCodeRan()
  assert.deepEqual(told, [])
  // The page stops it: the next world it makes is offered.
  state.on = null
  announceWorld(next, true)
  await pageCodeRan()
  assert.deepEqual(told, ['start next'])
  announceWorld(own, false)
  // Its own world again, then a world gone: nothing is stopped or started.
  follow(next)
  follow(own)
  assert.deepEqual(told, ['start next'])
  announceWorld(next, false)
  assert.deepEqual(told, ['start next', 'stop next'])
})
