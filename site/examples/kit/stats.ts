import {
  startStats,
  type StatsCorner,
  type StatsHandle,
  type StatsSource,
} from '#engine/packages/sdk-browser/src/modules/stats/index.ts'
import { statsParts } from '#engine/packages/sdk-core/src/modules/stats/descriptor.ts'
import { hideable, overlay } from './overlay.ts'
import { followPageWorld, onWorld, pageWorlds } from './pageWorld.ts'
import { statsWords } from './words.ts'

/** The panel shown, while one runs: its layer, the module's handle, and its mount settled
 *  (`opened`, never rejected). */
interface Shown {
  container: HTMLElement
  handle: StatsHandle
  opened: Promise<void>
}

let shown: Shown | undefined
/** The instruments asked (`workbench`, `?workbench`): a panel opens on its `why` tab, for this
 *  page alone (`StatsOptions.tab`: never kept as the viewer's tab). */
let whyAsked = false

/** The engine's stats module over the example (`startStats`) at `corner`, every part on, opening
 *  in a layer of the kit's overlay under the page's show/hide; on its `why` tab
 *  when the instruments were asked. What it returns takes it off. */
function openPanel(world: StatsSource, corner: StatsCorner) {
  const container = document.createElement('div')
  container.className = 'pointer-events-none absolute inset-0'
  overlay().append(container)
  hideable(container)
  const handle = startStats(world, {
    parent: container,
    parts: statsParts(undefined),
    corner,
    tab: whyAsked ? 'why' : undefined,
    words: statsWords(),
    worlds: pageWorlds,
  })
  const opened = handle.ready.catch((error: unknown) =>
    console.error('The stats panel did not start', error),
  )
  const panel: Shown = { container, handle, opened }
  shown = panel
  return () => {
    if (shown === panel) shown = undefined
    handle.stop()
    container.remove()
  }
}

/**
 * One overlay a page, opened by `open`: `start` opens it over a world unless one runs, whose stop
 * it then returns; a stop of an overlay that runs no more does nothing. `follow` puts it on the
 * page's worlds (`followPageWorld`), each world made offered while none runs: one the page
 * started itself is the page's, neither stopped nor started again for another world, and once
 * the page stops one, the next world made takes it. Whoever started it, it goes with its world.
 */
export function oneOverlay(open: (world: StatsSource, corner: StatsCorner) => () => void) {
  let running: { world: StatsSource; stop: () => void } | undefined
  const start = (world: StatsSource, corner: StatsCorner = 'bottom-left') => {
    if (running) return running.stop
    const close = open(world, corner)
    const stop = () => {
      if (running?.stop !== stop) return
      running = undefined
      close()
    }
    running = { world, stop }
    return stop
  }
  const stopOn = (world: StatsSource) => {
    if (running?.world === world) running.stop()
  }
  const follow = () => {
    onWorld((world, made) => {
      if (!made) stopOn(world)
    })
    followPageWorld(
      (world) => {
        start(world)
        return () => stopOn(world)
      },
      { running: () => running !== undefined },
    )
  }
  return { start, follow }
}

const pageOverlay = oneOverlay(openPanel)

/**
 * The engine's stats module over the example (`startStats`), at the bottom left unless `corner`
 * says otherwise, every part on. One overlay a page, over its whole frame: once it runs, a later
 * call returns what stops it. What it returns stops the module.
 */
export function stats(world: StatsSource, corner: StatsCorner = 'bottom-left') {
  return pageOverlay.start(world, corner)
}

/**
 * Starts the overlay on the first world the page makes, once the page's own code has run to its
 * end or its first wait, unless that code started it at a corner of its own (`followPageWorld`).
 * A page of several views or worlds makes its main one first: the overlay reads that one's frame.
 * When that world is disposed, the overlay goes with it and the next world the page makes takes
 * it.
 */
export function statsOnPageWorlds() {
  pageOverlay.follow()
}

/** Asks for the instruments: every panel from now on opens on its `why` tab, and the page
 *  publishes `window.__workbench`, as `window.__verdict` is, for a script that drives it: the
 *  shown panel's instruments (`StatsInstruments`), `read()` their last windows and `report` the
 *  last minute's; null while no panel is mounted. */
function askInstruments() {
  whyAsked = true
  const instruments = () => shown?.handle.instruments ?? null
  Object.assign(globalThis, {
    __workbench: {
      read: () => instruments()?.read() ?? null,
      get report() {
        return instruments()?.report ?? null
      },
    },
  })
}

/**
 * The engine's instruments over the page, reading `world`: the stats panel on its `why` tab (why
 * each image was drawn or held, what each frame cost: `world.diagnostic.why`,
 * `world.diagnostic.time`), and `window.__workbench`. The page's one panel: one already running
 * stays on the world it reads and turns to that tab. Settles once the panel is mounted.
 */
export async function workbench(world: StatsSource) {
  askInstruments()
  // A panel already running turns to the tab, for this page alone; one opened here opens on it.
  shown?.handle.show('why')
  stats(world)
  await shown?.opened
}

/** With `?workbench` on the page's address (`search`), the panel opens on its `why` tab and the
 *  instruments are published (`workbench`); without it, nothing changes. */
export function workbenchOnPageWorlds(search = globalThis.location?.search ?? '') {
  if (new URLSearchParams(search).has('workbench')) askInstruments()
}
