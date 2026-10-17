/** A point or a direction as the engine's vectors carry it. */
type Xyz = { x: number; y: number; z: number }

/** The world as far as pointing goes: its canvas and its camera. */
interface PointerWorld {
  canvas: {
    width: number
    height: number
    getBoundingClientRect(): { left: number; top: number; width: number; height: number }
  }
  camera: { rayThrough(x: number, y: number, aspect: number): { origin: Xyz; direction: Xyz } }
}

/** A canvas and a camera, as far as aiming a ray goes. */
type RayWorld<Ray> = {
  canvas: PointerWorld['canvas']
  camera: { rayThrough(x: number, y: number, aspect: number): Ray }
}

/**
 * The camera's world ray through the canvas point `(x, y)`, in CSS pixels from its top-left
 * corner (`camera.rayThrough`, perspective or orthographic), as `world.raycast` aims it: the
 * picture's shape is the drawing buffer's, the one the frame is drawn at. `null` while the canvas
 * has no size, as the engine refuses to aim then. `box` spares a caller aiming several rays a
 * second read of the canvas's layout.
 */
export function canvasRay<Ray>(
  world: RayWorld<Ray>,
  x: number,
  y: number,
  box: { width: number; height: number } = world.canvas.getBoundingClientRect(),
): Ray | null {
  if (!(box.width > 0 && box.height > 0)) return null
  return world.camera.rayThrough(
    (x / box.width) * 2 - 1,
    1 - (y / box.height) * 2,
    world.canvas.width / Math.max(1, world.canvas.height),
  )
}

/** The camera's world ray through the pointer of `event` (`canvasRay`), or `null` while the
 *  canvas has no size. */
export function pointerRay<Ray>(
  world: RayWorld<Ray>,
  event: { clientX: number; clientY: number },
): Ray | null {
  const box = world.canvas.getBoundingClientRect()
  return canvasRay(world, event.clientX - box.left, event.clientY - box.top, box)
}

/**
 * Where the pointer of `event` meets the level plane `y = height`: the camera's ray through the
 * pointer (`pointerRay`), stopped by the plane. `[x, z]` of the point met, or `null` when the ray
 * runs parallel to the plane or away from it.
 */
export function pointerOnPlane(
  world: PointerWorld,
  event: { clientX: number; clientY: number },
  height = 0,
): [number, number] | null {
  const ray = pointerRay(world, event)
  if (!ray) return null
  const { origin, direction } = ray
  const reach = (height - origin.y) / direction.y
  if (!(reach > 0) || !Number.isFinite(reach)) return null
  return [origin.x + direction.x * reach, origin.z + direction.z * reach]
}

/** What a click reads of a pointer event: where on the canvas, and whether it is the first finger. */
export type Press = { offsetX: number; offsetY: number; isPrimary: boolean; button: number }

/**
 * Calls `click(event)` on the release of a press that did not drag: the same first pointer went
 * down and up within `slop` pixels, with the main button (a still right or middle press pans or
 * opens a menu, and is no click). Releasing an orbit drag clicks nothing, nor does a pinch: a
 * second finger's press forgets the first one, and no release but the first finger's counts.
 */
export function onClick(
  canvas: {
    addEventListener(type: 'pointerdown' | 'pointerup', listener: (event: Press) => void): void
  },
  click: (event: Press) => void,
  slop = 3,
) {
  let down: [number, number] | null = null
  canvas.addEventListener(
    'pointerdown',
    (event) =>
      (down = event.isPrimary && event.button === 0 ? [event.offsetX, event.offsetY] : null),
  )
  canvas.addEventListener('pointerup', (event) => {
    const start = down
    down = null
    if (!start || !event.isPrimary) return
    const [dx, dy] = [event.offsetX - start[0], event.offsetY - start[1]]
    if (dx * dx + dy * dy <= slop * slop) click(event)
  })
}
