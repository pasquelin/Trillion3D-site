import assert from 'node:assert/strict'
import { test } from 'node:test'
import { irradianceAt, luminance, projectBands, srgbByte, turnBands } from './irradiance.ts'

const close = (actual: readonly number[], expected: readonly number[], tolerance: number) =>
  actual.forEach((value, k) =>
    assert.ok(Math.abs(value - expected[k]) <= tolerance, `${k}: ${value} ≠ ${expected[k]}`),
  )

test('a constant sky of radiance L lights every facing with π L', () => {
  const sh = projectBands(() => [1, 0.5, 0.25])
  for (const n of [
    [0, 1, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 0.6, 0.8],
  ])
    close(irradianceAt(sh, n), [Math.PI, Math.PI / 2, Math.PI / 4], 2e-3)
})

test('a sky bright above lights a face turned up more than one turned down', () => {
  const sh = projectBands((d) => [Math.max(0, d[1]), 0, 0])
  // The cosine squared over the upper half: 2π/3 for the face up, nothing for the face down.
  close(irradianceAt(sh, [0, 1, 0]).slice(0, 1), [Math.PI * (2 / 3)], 0.1)
  assert.ok(irradianceAt(sh, [0, -1, 0])[0] < 0.2)
})

test('turning the bands is projecting the turned environment', () => {
  const lobe = (d: readonly number[], at: readonly number[]) =>
    Math.max(0, d[0] * at[0] + d[1] * at[1] + d[2] * at[2]) ** 2
  const turn = 1.1
  const before = projectBands((d) => [lobe(d, [1, 0.3, 0]), 0.2, lobe(d, [0, 0.5, 1])])
  const after = projectBands((d) => {
    // The light from φ moves to φ + turn: read the unturned environment at φ − turn.
    const c = Math.cos(-turn),
      s = Math.sin(-turn),
      back = [c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]]
    return [lobe(back, [1, 0.3, 0]), 0.2, lobe(back, [0, 0.5, 1])]
  })
  close(turnBands(before, turn), after, 5e-3)
})

test('luminance and the sRGB byte follow the usual weights and curve', () => {
  assert.equal(luminance([1, 1, 1]), 1)
  assert.equal(luminance([0, 0, 0, 0, 1, 0], 3), 0.7152)
  assert.deepEqual([0, 0.5, 1, 4, -1].map(srgbByte), [0, 188, 255, 255, 0])
})
