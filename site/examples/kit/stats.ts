import { hideable, overlay, panelsShown } from './overlay.ts'
import { onWorld, pageWorlds } from './pageWorld.ts'
import { profileLines, profiling, startProfile } from './profile.ts'
import { STATS_CARD, STATS_TERM, STATS_VALUE, statsCorners, type StatsWorld } from './statsLines.ts'
import type { StatsCorner } from './statsLayout.ts'
import { statsPanel } from './statsPanel.ts'
import { engineStages } from './statUnit.ts'

/**
 * A card of label and value lines in a corner of the example, at the bottom left unless `corner`
 * says otherwise; what it returns replaces its lines, a value given a class (a colour) by the
 * third item of its line.
 */
export function statsCard(corner: StatsCorner = 'bottom-left') {
  const card = document.createElement('dl')
  card.className = `${STATS_CARD} ${statsCorners[corner]}`
  overlay().append(card)
  hideable(card)
  return (lines: readonly (readonly [string, string, string?])[]) =>
    card.replaceChildren(
      ...lines.flatMap(([label, value, tone = '']) => {
        const term = document.createElement('dt'),
          text = document.createElement('dd')
        term.className = STATS_TERM
        term.textContent = label
        text.className = `${STATS_VALUE} ${tone}`
        text.textContent = value
        return [term, text]
      }),
    )
}

/** The world the page's overlay watches and what stops it, while it runs. */
let running: { world: StatsWorld; stop: () => void } | undefined

/**
 * The example's profiler overlay (`statsPanel.ts`), at the bottom left unless `corner` says
 * otherwise: the frames the world drew per second and the frame's time against the 120 Hz budget,
 * where its time went, CPU and GPU, the virtual shadow
 * maps and the engine's counters, refreshed four times a second; hidden, it reads no CPU, while
 * the debug mode it turns on keeps filing the engine's CPU steps. On a page of several worlds
 * (`pageWorlds`), it says which one it reads and what all of them cost the GPU and the CPU. With `?profile` in the page's
 * address, it adds each second's CPU profile (`profile.ts`).
 * One overlay a page, over its whole frame: once it runs, a later call returns what stops it.
 * What it returns stops the overlay's timers.
 */
export function stats(world: StatsWorld, corner: StatsCorner = 'bottom-left') {
  if (running) return running.stop
  // The overlay reads the engine's CPU steps, which only its debug mode files, as a development
  // build's tools: a page without the overlay pays for none of it.
  if (world.diagnostic) world.diagnostic.debug = true
  let profiled: [string, string][] = []
  const stopProfile = profiling()
    ? startProfile(world, (latest) => {
        profiled = profileLines(latest)
      })
    : () => {}
  // `?profile` times the page's own frame and reads the engine's step window itself: its CPU
  // lines replace the overlay's.
  const unit = !profiling()
  const { panel, stop } = statsPanel(world, overlay(), {
    corner,
    extra: () => profiled,
    worlds: pageWorlds,
    cpu: { open: () => unit && panelsShown(), stages: () => engineStages(world) },
  })
  hideable(panel)
  const stopAll = () => {
    stop()
    stopProfile()
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
