/** Batch demos: n elements in one call. */
import {
  BOX_VALUES,
  IDENTITY_MATRIX4,
  POSITION_VALUES,
  SPHERE_VALUES,
  createCameraFrame,
  frustumKeepsBoxBatch,
  perspectiveProjection,
  sphereFromBoundsBatch,
  transformPointsBatch,
  updateCameraFrame,
} from './engine.ts'
import { formatNumber, slider, valueView } from './kit.ts'
import type { DemoDef } from './kit.ts'

/** The example of the SDK guide: a grid of unit boxes, half of it behind the camera. */
function gridBoxes(count: number) {
  const boxes = new Float64Array(count * BOX_VALUES),
    side = Math.ceil(Math.sqrt(count))
  for (let i = 0; i < count; i++) {
    const at = i * BOX_VALUES,
      x = (i % side) - side / 2,
      y = Math.floor(i / side) - side / 2,
      z = i % 2 === 0 ? -20 : 20
    boxes[at] = x
    boxes[at + 1] = y
    boxes[at + 2] = z
    boxes[at + 3] = x + 1
    boxes[at + 4] = y + 1
    boxes[at + 5] = z + 1
  }
  return boxes
}

export const BATCH_DEMOS: Record<string, DemoDef> = {
  frustumKeepsBoxBatch: {
    controls: [
      slider('count', 'boxes in the batch', 100, 40000, 10000, 100),
      slider('fov', 'field of view (°)', 20, 110, 60, 1),
    ],
    run(state) {
      const count = Math.round(state.count)
      const boxes = gridBoxes(count),
        kept = new Uint8Array(count),
        spheres = new Float64Array(count * SPHERE_VALUES),
        centres = new Float64Array(count * POSITION_VALUES),
        viewCentres = new Float64Array(count * POSITION_VALUES),
        frame = createCameraFrame(),
        projection = new Float64Array(16)
      perspectiveProjection(projection, state.fov, 16 / 9, 0.1, 1)
      updateCameraFrame(frame, projection, IDENTITY_MATRIX4, 100)
      const visible = frustumKeepsBoxBatch(kept, frame.planes, boxes, count)
      sphereFromBoundsBatch(spheres, boxes, count)
      let m = 0
      for (let i = 0; i < count; i++) {
        if (!kept[i]) continue
        const at = i * SPHERE_VALUES
        centres.set(spheres.subarray(at, at + POSITION_VALUES), m++ * POSITION_VALUES)
      }
      transformPointsBatch(viewCentres, frame.view, centres, m)
      return [
        valueView('cull, then transform the survivors: two calls, no allocation between them', [
          ['boxes tested', String(count)],
          ['kept by the frustum', String(visible)],
          ['rejected by the frustum', String(count - visible)],
          ['behind the camera, by construction', String(Math.floor(count / 2))],
          ['first survivor, view-space z', m ? formatNumber(viewCentres[2]) : '—'],
        ]),
      ]
    },
  },
}
