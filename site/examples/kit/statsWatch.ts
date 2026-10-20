import { cadenceOf } from './cadence.ts'
import { spread } from './profile.ts'
import {
  rate,
  sceneTriangles,
  type FrameCounters,
  type StatsSample,
  type StatsWorld,
} from './statsLines.ts'

/** Where the corner reads the CPU: whether it does now (not while the panel is hidden or the
 *  page profiles), and the frame's CPU stages since the last read, `null` when none is measured. */
export interface CpuSource {
  open(): boolean
  stages(): [string, number][] | null
}

/**
 * Watches `world`: counts the frames it draws and keeps the engine's counters of the last one,
 * and every `periodMs` hands `show` the sample they were read from. A held image costs the corner
 * nothing: a period with no new frame after the rate has read none builds no sample and calls
 * nothing, and while `active()` is false (the panel is hidden) the ticks only drop the times older
 * than the rate's second, which the frames go on filing. The scene's triangles are counted again
 * only after a frame was drawn (the engine breaks the hold when the scene changes). While `cpu` is
 * open, it keeps each frame's CPU time for the period's median, and reads the CPU stages `cpu`
 * gives (`engineStages`); closed, it keeps and reads nothing of the CPU. Returns what stops it.
 */
export function watchStats(
  world: StatsWorld,
  show: (sample: StatsSample) => void,
  cpu: CpuSource = { open: () => true, stages: () => null },
  periodMs = 500,
  active: () => boolean = () => true,
) {
  const drawn: number[] = [],
    cpuFrameMs: number[] = [],
    /** Each drawn frame's interval since the last, `NaN` when not measured (`cadence.ts`). */
    intervals: number[] = [],
    /** Each image of a view beside the main one: when it was drawn and its GPU time; and each
     *  view's last GPU time, by index. */
    viewTimes: number[] = [],
    viewMs: number[] = [],
    viewLast: (number | null)[] = []
  let last: FrameCounters = {},
    rated = false,
    gpuFrameMs: number | null = null,
    gpuIdleMs: number | null = null,
    refreshMs: number | null = null,
    cpuWasOpen = false,
    /** Frames drawn so far, and the count at the last sample and at the last triangle count. */
    frames = 0,
    sampledAt = -1,
    countedAt = -1,
    /** The rate of the last sample, `undefined` before the first; and whether a tick passed unread. */
    sampledFps: number | null | undefined,
    unread = false,
    triangles: number | null = null
  const unhook = world.onFrame(({ metrics }) => {
    frames++
    const at = performance.now()
    drawn.push(at)
    for (const view of metrics.views ?? []) {
      viewTimes.push(at)
      viewMs.push(view.gpuFrameMs ?? 0)
      viewLast[view.index] = view.gpuFrameMs
    }
    intervals.push(metrics.rafIntervalMs ?? Number.NaN)
    last = metrics
    if (metrics.displayRefreshMs != null) refreshMs = metrics.displayRefreshMs
    // The engine hands the same metrics every frame: the corner keeps the number, not the object.
    if (metrics.cpuFrameMs != null && cpu.open()) cpuFrameMs.push(metrics.cpuFrameMs)
    // A held image times nothing: the corner keeps the GPU time last measured.
    if (metrics.gpuFrameMs != null) gpuFrameMs = metrics.gpuFrameMs
    if (metrics.gpuIdleMs != null) gpuIdleMs = metrics.gpuIdleMs
  })
  const timer = setInterval(() => {
    // Hidden or not, the frames file their times: only the rate's last second is kept.
    const now = performance.now()
    while (drawn.length && drawn[0] < now - 1000) {
      drawn.shift()
      intervals.shift()
    }
    while (viewTimes.length && viewTimes[0] < now - 1000) {
      viewTimes.shift()
      viewMs.shift()
    }
    if (!active()) {
      unread = true
      return
    }
    // The rate is read from the intervals between the frames of the last second; with fewer
    // than two, the image stands still: it reads no rate (an earlier image's), and says held.
    const fps = rate(drawn)
    // A held image, already read as such: the same sample as the last one, so nothing to build.
    if (fps === null && sampledFps === null && frames === sampledAt && !unread) return
    unread = false
    sampledAt = frames
    sampledFps = fps
    rated ||= fps !== null
    const sample: StatsSample = {
      ...last,
      fps,
      held: fps === null && rated,
      sceneTriangles: null,
      gpuFrameMs,
      gpuFrameLast: last.gpuFrameMs == null,
      gpuIdleMs,
      cadence: cadenceOf(intervals, refreshMs),
    }
    if (viewLast.length) {
      sample.viewsGpuMs = viewMs.reduce((sum, value) => sum + value, 0)
      sample.viewGpuMs = viewLast.slice()
    }
    const cpuOpen = cpu.open()
    if (cpuOpen) {
      // The engine's window ran on while the corner was closed: its first read after opening
      // spans that time, so it only opens the window again and is not shown.
      const stages = cpu.stages()
      sample.cpu = {
        frameMs: spread(cpuFrameMs.splice(0))?.p50 ?? null,
        stages: (cpuWasOpen && stages) || [],
      }
    } else cpuFrameMs.length = 0
    cpuWasOpen = cpuOpen
    if (last.selectedTriangles == null) {
      if (countedAt !== frames) triangles = sceneTriangles(world.scene)
      countedAt = frames
      sample.sceneTriangles = triangles
    }
    show(sample)
  }, periodMs)
  return () => {
    clearInterval(timer)
    if (typeof unhook === 'function') unhook()
  }
}

/**
 * The page's other worlds than `main`, each watched as the panel watches its own (`watchStats`),
 * but only while `open()`: each `read` (the panel's, four times a second) brings the watches in
 * line with `worlds()` — a world made since is watched, one disposed is let go, and all of them
 * while closed, so a folded or hidden panel samples no other world — and hands back each one's
 * last sample. Their CPU is read while `cpu` is, without stages. Returns `read` and what stops it.
 */
export function watchWorlds(
  main: StatsWorld,
  worlds: () => readonly StatsWorld[],
  cpu: CpuSource | undefined,
  periodMs: number,
  open: () => boolean,
) {
  const watched = new Map<StatsWorld, { stop: () => void; sample?: StatsSample }>()
  const frameCpu: CpuSource = { open: () => cpu?.open() ?? true, stages: () => null }
  const stop = (world: StatsWorld) => {
    watched.get(world)?.stop()
    watched.delete(world)
  }
  const read = (): StatsSample[] => {
    const shown = open(),
      live = worlds()
    for (const world of watched.keys()) if (!shown || !live.includes(world)) stop(world)
    if (!shown) return []
    for (const world of live)
      if (world !== main && !watched.has(world)) {
        const watch: { stop: () => void; sample?: StatsSample } = { stop: () => {} }
        watch.stop = watchStats(
          world,
          (sample) => (watch.sample = sample),
          frameCpu,
          periodMs,
          open,
        )
        watched.set(world, watch)
      }
    return [...watched.values()].flatMap(({ sample }) => (sample ? [sample] : []))
  }
  return {
    read,
    stop: () => {
      for (const world of watched.keys()) stop(world)
    },
  }
}
