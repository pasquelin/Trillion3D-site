import type { EntryNote } from '../model.ts'

/** Batch math: `n` elements per call on flat buffers. */

export const BATCHES: EntryNote[] = [
  {
    id: 'frustumKeepsBoxBatch',
    replaces: 'a loop of Frustum.intersectsBox, of Box3.getBoundingSphere',
  },
  {
    id: 'boxUnionBatch',
    replaces: 'a loop of Box3.union, Box3.setFromObject',
  },
  {
    id: 'transformPointsBatch',
    replaces: 'a loop of Vector3.applyMatrix4, of Vector3.transformDirection',
  },
]
