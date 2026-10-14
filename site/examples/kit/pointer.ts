/** A point or a direction as the engine's vectors carry it. */
type Xyz = { x: number; y: number; z: number }

/** The world as far as pointing goes: its canvas and its camera. */
interface PointerWorld {
  canvas: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }
  camera: { rayThrough(x: number, y: number, aspect: number): { origin: Xyz; direction: Xyz } }
}

/**
 * Where the pointer of `event` meets the level plane `y = height`: the camera's own ray through
 * the pointer (`camera.rayThrough`, perspective or orthographic), stopped by the plane. `[x, z]`
 * of the point met, or `null` when the ray runs parallel to the plane or away from it.
 */
export function pointerOnPlane(
  world: PointerWorld,
  event: { clientX: number; clientY: number },
  height = 0,
): [number, number] | null {
  const box = world.canvas.getBoundingClientRect()
  const x = ((event.clientX - box.left) / box.width) * 2 - 1,
    y = 1 - ((event.clientY - box.top) / box.height) * 2
  const { origin, direction } = world.camera.rayThrough(x, y, box.width / box.height)
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
