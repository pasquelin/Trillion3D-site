/**
 * The soft light of a whole environment as the 27 numbers a `light.probe` holds: nine
 * spherical-harmonic bands, red, green and blue each. It follows the engine's own convention,
 * so what a page projects here is what the probe reads: the bands in the order and with the
 * normalisations of `IRRADIANCE_TERMS` (`.engine/packages/sdk-core/src/scene/core/irradianceTerms.ts`),
 * the cosine-lobe factors of `IRRADIANCE_BAND` (`environment.ts` beside it). Directions are
 * unit vectors, y up; a panorama is laid as the engine's sphere lays it: across, the turn from +x
 * toward +z, down, the angle from straight up. And the two small sums the pages that paint such
 * light make on it: its luminance, and its sRGB byte.
 */

import { IRRADIANCE_TERMS } from '#engine/packages/sdk-core/src/scene/core/irradianceTerms.ts'
import { linearToSrgb8 } from '#engine/packages/math/src/color/color.ts'
import { PI, TAU } from '#engine/packages/math/src/constants.ts'

type Direction = readonly number[]

/** The nine polynomials of the bands at `d`, without their normalisation. */
const polynomials = ([x, y, z]: Direction) => [
  1,
  y,
  z,
  x,
  x * y,
  y * z,
  3 * z * z - 1,
  x * z,
  x * x - y * y,
]

/** The value of each of the nine bands in the direction `d`. */
const bands = (d: Direction): number[] =>
  polynomials(d).map((value, k) => IRRADIANCE_TERMS[k].basis * value)

/** The unit direction at a place of a panorama, `u` across and `v` down, both in [0, 1]. */
export function panoramaDirection(u: number, v: number): number[] {
  const theta = v * PI,
    phi = u * TAU
  return [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)]
}

/** Visits the centre of each cell of a `rows` × `columns` panorama grid: its direction, its row
 *  and column, and the solid angle the cell covers. */
function eachCell(
  rows: number,
  columns: number,
  visit: (d: number[], row: number, column: number, area: number) => void,
) {
  for (let row = 0; row < rows; row++) {
    const v = (row + 0.5) / rows,
      area = (Math.sin(v * PI) * PI * TAU) / (rows * columns)
    for (let column = 0; column < columns; column++)
      visit(panoramaDirection((column + 0.5) / columns, v), row, column, area)
  }
}

/**
 * Projects an environment onto the bands: its radiance is read at the centre of each cell of a
 * `rows` × `columns` panorama grid, weighed by the solid angle the cell covers, and summed into
 * each band. `radiance(d, row, column)` gives the red, green and blue light arriving from `d`;
 * a panorama read cell by cell uses the row and column, a function of the direction uses `d`.
 */
export function projectBands(
  radiance: (d: number[], row: number, column: number) => ArrayLike<number>,
  rows = 64,
  columns = 128,
): number[] {
  const sh: number[] = new Array(27).fill(0)
  eachCell(rows, columns, (d, row, column, area) => {
    const light = radiance(d, row, column),
      y = bands(d)
    for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) sh[k * 3 + c] += light[c] * y[k] * area
  })
  return sh
}

/** Adds the light of one far, small source, `rgb` its irradiance on a surface facing it, coming
 *  from `d`: the bands of its direction times its light. */
export function addSource(sh: number[], d: Direction, rgb: readonly number[]): number[] {
  const y = bands(d)
  for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) sh[k * 3 + c] += rgb[c] * y[k]
  return sh
}

/** The light the bands hold arriving from the direction whose band values are `y`: the radiance
 *  they keep of the environment there. */
function radianceOf(sh: readonly number[], y: readonly number[], out: number[]) {
  for (let c = 0; c < 3; c++) {
    out[c] = 0
    for (let k = 0; k < 9; k++) out[c] += sh[k * 3 + c] * y[k]
  }
  return out
}

/** The grid a turn is summed on, 32 × 64 cells, its bands worked out once. */
const TURN_GRID: { d: number[]; y: number[]; area: number }[] = []
eachCell(32, 64, (d, _row, _column, area) => TURN_GRID.push({ d, y: bands(d), area }))

/**
 * The bands of the same environment turned by `turn` radians about the vertical, the light
 * that came from the turn φ now coming from φ + `turn` (as a mesh's `rotation.y = −turn`
 * turns its picture). Without going back to the environment: the light the bands hold is read
 * along each direction of a 32 × 64 grid and projected again onto the bands of the turned
 * direction. A turn never mixes one band order with another, and these smooth products are
 * summed nearly exactly on such a grid.
 */
export function turnBands(sh: readonly number[], turn: number): number[] {
  const out: number[] = new Array(27).fill(0),
    c = Math.cos(turn),
    s = Math.sin(turn),
    light = [0, 0, 0]
  for (const { d, y, area } of TURN_GRID) {
    radianceOf(sh, y, light)
    const forward = bands([c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]])
    for (let k = 0; k < 9; k++)
      for (let ch = 0; ch < 3; ch++) out[k * 3 + ch] += light[ch] * forward[k] * area
  }
  return out
}

/** The irradiance the bands give a surface facing `n`, red, green and blue: each band times its
 *  cosine-lobe factor times its polynomial, as the engine's probe sums it. */
export function irradianceAt(sh: readonly number[], n: Direction): number[] {
  const p = polynomials(n)
  return [0, 1, 2].map((c) =>
    p.reduce((sum, value, k) => sum + IRRADIANCE_TERMS[k].band * sh[k * 3 + c] * value, 0),
  )
}

/** The luminance of a linear RGB light read at `at` of `rgb`: 0.2126 r + 0.7152 g + 0.0722 b. */
export const luminance = (rgb: ArrayLike<number>, at = 0) =>
  0.2126 * rgb[at] + 0.7152 * rgb[at + 1] + 0.0722 * rgb[at + 2]

/** A linear value as the byte an 8-bit sRGB picture stores, 0 to 255, anything past 1 kept at
 *  255: the engine's transfer curve (`linearToSrgb8`). */
export const srgbByte: (linear: number) => number = linearToSrgb8
