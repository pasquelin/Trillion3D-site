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

/**
 * `ask` — a query answered later, such as `world.raycast` — asked one at a time, the latest
 * only: a call while one is in flight takes the place of any still waiting and is asked once
 * that one lands, and `found` gets each answer with what it was asked about. A hover asks at
 * every pointer move; the GPU answers a frame later, and no stale answer queues behind it.
 */
export function latestOnly<At, Answer>(
  ask: (at: At) => Promise<Answer>,
  found: (answer: Answer, at: At) => void,
) {
  let flying = false,
    waiting: { at: At } | null = null
  const run = (at: At): void => {
    if (flying) return void (waiting = { at })
    flying = true
    void ask(at)
      .then((answer) => found(answer, at))
      .finally(() => {
        flying = false
        const next = waiting
        waiting = null
        if (next) run(next.at)
      })
  }
  return run
}
