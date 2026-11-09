/**
 * The engine as an example page imports it (`runtime/engine.js`): the browser SDK whole, its
 * `createWorld` telling the kit of each world it makes and disposes, and of each model its scene
 * is loading (`kit/pageWorld.ts`), so the kit watches the page's frame without the page handing it
 * a world.
 */
import { createWorld as sdkWorld } from '#engine/packages/sdk-browser/src/index.ts'
import { announceLoad, announceWorld } from './kit/pageWorld.ts'

export * from '#engine/packages/sdk-browser/src/index.ts'

export function createWorld(...args: Parameters<typeof sdkWorld>) {
  const world = sdkWorld(...args)
  const dispose = world.dispose
  world.dispose = () => {
    announceWorld(world, false)
    dispose()
  }
  const load = world.scene.load.bind(world.scene)
  world.scene.load = (...args: Parameters<typeof load>) => announceLoad(world, load(...args))
  announceWorld(world, true)
  return world
}
