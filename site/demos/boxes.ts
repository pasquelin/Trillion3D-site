/** Box and sphere demos: the arithmetic every cluster bound goes through. */
import {
  BOX_VALUES,
  axisAngleQuaternion,
  boxTransform,
  boxUnion,
  composeMatrix4,
  sphereFromBounds,
} from './engine.ts'
import { formatNumber, slider, valueView } from './kit.ts'
import type { DemoDef } from './kit.ts'

export const BOX_DEMOS: Record<string, DemoDef> = {
  boxUnion: {
    controls: [
      slider('x', 'second box, x', -3, 3, 1.5, 0.1),
      slider('z', 'second box, z', -3, 3, 1, 0.1),
    ],
    run(state) {
      const out = new Float64Array(BOX_VALUES)
      out.set([-1, -1, -1, 1, 1, 1])
      boxUnion(out, 0, state.x - 0.6, -0.6, state.z - 0.6, state.x + 0.6, 0.6, state.z + 0.6)
      const sphere = new Float64Array(4)
      sphereFromBounds(sphere, 0, out[0], out[1], out[2], out[3], out[4], out[5])
      return [
        valueView('boxUnion of the unit box and the one you move', [
          ['lower bounds', Array.from(out.subarray(0, 3), formatNumber).join(', ')],
          ['upper bounds', Array.from(out.subarray(3, 6), formatNumber).join(', ')],
        ]),
        valueView('sphereFromBounds of that union', [
          ['centre', Array.from(sphere.subarray(0, 3), formatNumber).join(', ')],
          ['radius', formatNumber(sphere[3])],
        ]),
      ]
    },
  },
  boxTransform: {
    controls: [
      slider('turn', 'rotation of the matrix (rad)', 0, 6.28, 0.6, 0.01),
      slider('scale', 'scale', 0.2, 3, 1, 0.05),
    ],
    run(state) {
      const m = new Float64Array(16)
      composeMatrix4(
        m,
        [1, 0, 0],
        axisAngleQuaternion(new Float64Array(4), [0, 1, 0], state.turn),
        [state.scale, state.scale, state.scale],
      )
      const box = new Float64Array([-1, -1, -1, 1, 1, 1])
      const out = new Float64Array(BOX_VALUES)
      boxTransform(out, 0, box, 0, m)
      return [
        valueView('the unit box carried by that matrix', [
          ['lower bounds', Array.from(out.subarray(0, 3), formatNumber).join(', ')],
          ['upper bounds', Array.from(out.subarray(3, 6), formatNumber).join(', ')],
          ['note', 'the union of the eight transformed corners, never the eight of the result'],
        ]),
      ]
    },
  },
}
