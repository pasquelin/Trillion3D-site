import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StatsSample } from './statsLines.ts'
import { pageRows, worldTag } from './statsRows.ts'

/** A world's sample: its rate, its last GPU frame time and its median CPU frame time. */
const world = (fps: number | null, gpuFrameMs: number | null, cpuMs?: number): StatsSample => ({
  fps,
  held: fps === null,
  sceneTriangles: null,
  gpuFrameMs,
  ...(cpuMs == null ? {} : { cpu: { frameMs: cpuMs, stages: [] } }),
})

test('a page of one world shows no world tag and no page rows', () => {
  assert.equal(worldTag(0, 1), '')
  assert.deepEqual(pageRows(world(60, 8, 1), []), [])
})

test('the tag names the world read among the page’s live ones', () => {
  assert.equal(worldTag(0, 6), 'main view · 1/6')
  assert.equal(worldTag(2, 6), 'world · 3/6')
})

test('each world counts at its own rate as a share of the second, never summing rates', () => {
  // The lead at 25 fps, five others at 12.5 fps.
  const lead = world(25, 10, 1)
  const others = Array.from({ length: 5 }, () => world(12.5, 4, 0.5))
  const [gpu, cpu] = pageRows(lead, others)
  // (10·25 + 5·4·12.5) ms a second = 500 ms: half the second.
  assert.deepEqual(gpu, ['GPU busy', '50', '%', 0.5])
  // (1·25 + 5·0.5·12.5) ms a second = 56.25 ms.
  assert.deepEqual(cpu, ['CPU busy', '6', '%', 0.05625])
})

test('a held world costs nothing and an unmeasured time is left out', () => {
  const rows = pageRows(world(50, 6), [world(null, 9, 3), world(50, null, 2)])
  assert.deepEqual(
    rows.map(([label, value]) => [label, value]),
    [
      ['GPU busy', '30'],
      ['CPU busy', '10'],
    ],
  )
})

test('worlds whose GPU work overlaps pass the whole second, the bar capped', () => {
  const [gpu] = pageRows(world(30, 20), [world(30, 20)])
  assert.equal(gpu[1], '120')
  assert.equal(gpu[3], 1)
})

test('a world’s views count their GPU time in the second, and each shows its last image’s', () => {
  const sample = { ...world(50, 4, 1), viewsGpuMs: 100, viewGpuMs: [2, null, 4] }
  const rows = pageRows(sample, [])
  // 4·50 + 100 ms a second: 30 % of it.
  assert.deepEqual(rows[0], ['GPU busy', '30', '%', 0.3])
  assert.deepEqual(rows.slice(2), [
    ['view 2', '2.00', 'ms', 0.2],
    ['view 4', '4.00', 'ms', 0.4],
  ])
})
