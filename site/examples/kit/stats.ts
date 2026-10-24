import {
  startStats,
  type StatsCorner,
  type StatsSource,
} from '#engine/packages/sdk-browser/src/modules/stats/index.ts'
import { statsParts } from '#engine/packages/sdk-core/src/modules/stats/descriptor.ts'
import { hideable, overlay } from './overlay.ts'
import { onWorld, pageWorlds } from './pageWorld.ts'
import { statsWords } from './words.ts'

/** The world the page's overlay watches and what stops it, while it runs. */
let running: { world: StatsSource; stop: () => void } | undefined

/**
 * The engine's stats module over the example (`startStats`), at the bottom left unless `corner`
 * says otherwise, every part on. One overlay a page, over its whole frame: once it runs, a later
 * call returns what stops it. What it returns stops the module.
 */
export function stats(world: StatsSource, corner: StatsCorner = 'bottom-left') {
  if (running) return running.stop
  const container = document.createElement('div')
  container.className = 'pointer-events-none absolute inset-0'
  overlay().append(container)
  hideable(container)
  const handle = startStats(world, {
    parent: container,
    parts: statsParts(undefined),
    corner,
    words: statsWords(),
    worlds: pageWorlds,
  })
  handle.ready.catch((error: unknown) => console.error('The stats panel did not start', error))
  const stopAll = () => {
    handle.stop()
    container.remove()
    running = undefined
  }
  running = { world, stop: stopAll }
  return stopAll
}

/**
 * Starts the overlay on the first world the page makes, once the page's own code has run to its
 * end or its first wait, unless that code started it at a corner of its own. A page of several
 * views or worlds makes its main one first: the overlay reads that one's frame. When that world
 * is disposed, the overlay goes with it and the next world the page makes takes it.
 */
export function statsOnPageWorlds() {
  onWorld((world, live) => {
    if (live) queueMicrotask(() => stats(world))
    else if (running?.world === world) running.stop()
  })
}
