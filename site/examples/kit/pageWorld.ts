import type { StatsWorld } from './statsLines.ts'

/**
 * Each world the page makes or disposes, told by the examples' engine entry (`../engine.ts`) to
 * the kit: a module both runtime files import, so one shared chunk, one list of the live worlds
 * and one listener. Without the kit on the page, no one listens.
 */
let listener: ((world: StatsWorld, live: boolean) => void) | undefined
const live: StatsWorld[] = []

/** Tells the kit `createWorld` just made `world` (`made`), or that `world` was disposed. */
export function announceWorld(world: StatsWorld, made: boolean) {
  const at = live.indexOf(world)
  if (made && at < 0) live.push(world)
  else if (!made && at >= 0) live.splice(at, 1)
  listener?.(world, made)
}

/** The page's live worlds, in the order it made them. */
export const pageWorlds = (): readonly StatsWorld[] => live

/** Hears every world the page makes or disposes from now on. */
export function onWorld(listen: (world: StatsWorld, live: boolean) => void) {
  listener = listen
}
