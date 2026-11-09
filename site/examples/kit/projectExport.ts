/**
 * The page's scene handed to the hosting page for an editor project (`site/app/projects`): asked
 * by a `trillion3d:export` message, each object at the top of the scene of the page's last world
 * is written as a binary glTF by the engine (`scene.exportGlb`), and sent back in a
 * `trillion3d:exported` message with where the camera looks from, the sky and the background.
 * Listened for from the kit's import, as the panel's message is (`overlay.ts`).
 */
import { loadsSettled, onWorld, pageWorlds, type PageWorld } from './pageWorld.ts'

/** What the hosting page asks: the scene, answered under the same `id`. */
export interface ExportRequest {
  type: 'trillion3d:export'
  id: number
}

/** A lamp at the top of the scene as the page set it: its kind, its colours as `#rrggbb`, its
 *  intensity in the page's own number and whether it casts shadows. The glTF of a point, a spot or
 *  a directional light holds its intensity in photometric units and its aim. */
export interface ExportedLight {
  kind: string
  color: string
  groundColor: string
  intensity: number
  castShadow: boolean
}

/** One object at the top of the scene: its binary glTF, what the engine left out of it, the name
 *  it goes by (its own, else its shape's or its kind's), and its lamp when it is one. */
export interface ExportedObject {
  glb: Uint8Array
  skipped: { reason: string; field?: string; name: string }[]
  name: string
  light?: ExportedLight
}

/** What the kit reads of an object, by duck typing: the kit bundles nothing of the engine. */
interface Seen {
  name?: string
  type?: string
  isLight?: boolean
  kind?: string
  color?: { getHexString(): string }
  groundColor?: { getHexString(): string }
  intensity?: number
  castShadow?: boolean
  geometry?: { recipe?: { type: string } | null }
}

/** The name `object` goes by: its own, else its shape's family, its lamp's kind or its type. */
const nameOf = (object: Seen) =>
  object.name ||
  object.geometry?.recipe?.type ||
  (object.isLight ? `${object.kind} light` : '') ||
  object.type ||
  ''

/** `object`'s lamp, when it is one. */
const lightOf = (object: Seen): ExportedLight | undefined =>
  object.isLight
    ? {
        kind: object.kind ?? '',
        color: `#${object.color?.getHexString() ?? 'ffffff'}`,
        groundColor: `#${object.groundColor?.getHexString() ?? '000000'}`,
        intensity: object.intensity ?? 1,
        castShadow: Boolean(object.castShadow),
      }
    : undefined

/** The page's answer: its objects, its camera's pose, its sky and background; or why it has none. */
export type ExportAnswer = { type: 'trillion3d:exported'; id: number } & (
  | {
      objects: ExportedObject[]
      camera: { position: number[]; target: number[] }
      sky: unknown
      background: string | null
    }
  | { error: string }
)

/** How long a page still starting may take to make its world, in milliseconds. */
const WORLD_WAIT = 15_000
/** How long the page's compiled models may take to load before the export goes without them. */
const LOAD_WAIT = 90_000

/** The next world the page makes, or none within `WORLD_WAIT`. */
function nextWorld() {
  return new Promise<PageWorld | undefined>((resolve) => {
    const timer = setTimeout(() => done(undefined), WORLD_WAIT)
    const stop = onWorld((world, made) => {
      if (made) done(world)
    })
    const done = (world: PageWorld | undefined) => {
      clearTimeout(timer)
      stop()
      resolve(world)
    }
  })
}

/** The scene of the page's last live world, as `ExportAnswer` holds it: one the page is still
 *  making is waited for. */
async function exportScene() {
  const world = pageWorlds().at(-1) ?? (await nextWorld())
  if (!world) throw new Error('the page has no world')
  // A compiled model still loading is not in the scene yet: the export waits for it.
  await Promise.race([loadsSettled(world), new Promise((done) => setTimeout(done, LOAD_WAIT))])
  const objects: ExportedObject[] = []
  for (const child of [...world.scene.children]) {
    const { glb, skipped } = await world.scene.exportGlb(child),
      light = lightOf(child as Seen)
    objects.push({
      glb,
      skipped: skipped.map(({ reason, field, item }) => ({
        reason,
        ...(field === undefined ? {} : { field }),
        name: (item as { name?: string }).name ?? '',
      })),
      name: nameOf(child as Seen),
      ...(light ? { light } : {}),
    })
  }
  const { camera } = world,
    ahead = camera.getWorldDirection(camera.position.clone())
  const [x, y, z] = [camera.position.x, camera.position.y, camera.position.z]
  return {
    objects,
    camera: { position: [x, y, z], target: [x + 10 * ahead.x, y + 10 * ahead.y, z + 10 * ahead.z] },
    sky: world.scene.sky ?? null,
    background: world.scene.background ? `#${world.scene.background.getHexString()}` : null,
  }
}

// A page, not a test importing the kit in Node, has messages to hear.
globalThis.addEventListener?.('message', (event) => {
  const data = event.data as Partial<ExportRequest> | null
  if (event.source !== parent || data?.type !== 'trillion3d:export' || data.id === undefined) return
  const id = data.id
  exportScene().then(
    (scene) => {
      const answer: ExportAnswer = { type: 'trillion3d:exported', id, ...scene }
      parent.postMessage(
        answer,
        location.origin,
        scene.objects.map(({ glb }) => glb.buffer),
      )
    },
    (error: unknown) => {
      const answer: ExportAnswer = {
        type: 'trillion3d:exported',
        id,
        error: error instanceof Error ? error.message : String(error),
      }
      parent.postMessage(answer, location.origin)
    },
  )
})
