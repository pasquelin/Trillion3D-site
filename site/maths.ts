// The few maths forms the site uses that the engine's maths core does not publish: the site's own,
// written once here.
import { quantileFloor } from '#engine/packages/math/src/scalar/quantile.ts'

/** The smoothstep polynomial `t * t * (3 - 2 * t)` of `t` in `[0, 1]`: 0 and 1 at the ends, flat at
 *  both. Not clamped: `smoothstep(saturate(t))` holds a `t` out of the interval. */
export const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** Brings the vector at `at` to unit length by division, in place and returned: each component is
 *  divided by `length`, which the caller measures (the documents whose published bits hold the
 *  quotient). */
export function divideVector3<T extends { [index: number]: number }>(
  v: T,
  at: number,
  length: number,
) {
  v[at] /= length
  v[at + 1] /= length
  v[at + 2] /= length
  return v
}

/** `quantileFloor` of an unsorted list: a copy is sorted ascending first. */
export function quantileFloorOf(values: ArrayLike<number>, q: number): number | undefined {
  return quantileFloor(Float64Array.from(values).sort(), q)
}
