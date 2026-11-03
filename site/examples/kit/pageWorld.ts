import type { World } from '#engine/packages/sdk-browser/src/index.ts'

/** A world the page made: the engine's own; each piece of the kit narrows it to what it reads. */
export type PageWorld = World

/** What hears each world the page makes (`live`) or disposes. */
type WorldListener = (world: PageWorld, live: boolean) => void

/**
 * Each world the page makes or disposes, told by the examples' engine entry (`../engine.ts`) to
 * the kit: a module both runtime files import, so one shared chunk, one list of the live worlds
 * and one set of listeners, each hearing every world. Without the kit on the page, no one
 * listens.
 */
const listeners = new Set<WorldListener>()
const live: PageWorld[] = []

/** Tells the kit `createWorld` just made `world` (`made`), or that `world` was disposed. */
export function announceWorld(world: PageWorld, made: boolean) {
  const at = live.indexOf(world)
  if (made && at < 0) live.push(world)
  else if (!made && at >= 0) live.splice(at, 1)
  for (const listen of listeners) listen(world, made)
}

/** The page's live worlds, in the order it made them. */
export const pageWorlds = (): readonly PageWorld[] => live

/** Hears every world the page makes or disposes from now on, beside every other listener; what
 *  it returns stops hearing. */
export function onWorld(listen: WorldListener) {
  listeners.add(listen)
  return () => void listeners.delete(listen)
}

/**
 * Runs `start` on one world of the page at a time, what it returns stopping it. Each world the
 * page makes is offered to it once the page's own code has run to its end or its first wait
 * (what that code set up on it comes first), unless `running()` says what it starts runs already:
 * the consumer answers from its own state — started here or by the page itself, or stopped since
 * by the page —, never this helper. When the world it was last started on is disposed, that run
 * is stopped, and the next world the page makes is offered: never one made before. What it
 * returns moves it to `world`, a live world of the page: nothing done for a world gone, or for
 * the one it runs on already.
 */
export function followPageWorld(
  start: (world: PageWorld) => () => void,
  { running }: { running: () => boolean },
) {
  // The world it was last started on and what stops that run: its disposal moves it on.
  let followed: { world: PageWorld; stop: () => void } | undefined
  const take = (world: PageWorld) => {
    followed = { world, stop: start(world) }
  }
  const halt = () => {
    const stop = followed?.stop
    followed = undefined
    stop?.()
  }
  onWorld((world, made) => {
    if (made)
      queueMicrotask(() => {
        if (!running() && live.includes(world)) take(world)
      })
    else if (followed?.world === world) halt()
  })
  return (world: PageWorld) => {
    if (!live.includes(world) || (followed?.world === world && running())) return
    halt()
    take(world)
  }
}
