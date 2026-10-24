import { TAU } from '#engine/packages/math/src/constants.ts'
import type {
  MaterialsOption,
  ResponsiveOption,
} from '#engine/packages/sdk-core/src/contracts/materialOptions.ts'
import { SceneGltf, type Channel } from './gltf-scene.ts'
import { randomStream, snap } from './random.ts'
import { box } from './solids.ts'

/**
 * `particles-responsive`: three swarms of small glowing sparks whirling over a dark floor, side by
 * side, the same motion in each, so the trail each leaves behind it can be compared. The sparks are
 * blended (`SPARK_OPACITY`), as sparks are drawn: each material's temporal responsiveness (its
 * `responsive` level) says how far the temporal anti-aliasing trusts the history on its pixels,
 * left to right `'off'`, `'medium'` and `'full'`, each in three colours that name it three ways:
 * - `'off'`, `still …`: `still pattern` no option names; `still listed` set `responsive: false` by
 *   `materials`; `still extras` asking `responsive` in its extras, which `materials` sets false;
 * - `'medium'`, `soft …`: `soft named` `materials` sets `responsive: 'medium'`; `soft extras` its
 *   own glTF `extras` ask for (`"responsive": "medium"`); `soft over extras` asking `true` in its
 *   extras, which `materials` sets `'medium'`;
 * - `'full'`, `spark …`: `spark pattern` the compile option `responsive` matches
 *   (`SPARKS_RESPONSIVE`); `spark listed` `materials` sets `responsive: true`; `spark extras` its
 *   own glTF `extras` ask for (`"responsive": true`).
 */
const PER_COLOUR = 30,
  /** Seconds of one turn, the clip's length: fast, so the sparks cross many pixels an image. */
  PERIOD = 2,
  /** Keys over one turn. */
  KEYS = 24,
  /** Where each swarm turns, left to right. */
  CENTRES = [-8, 0, 8] as const,
  /** The side of a spark, metres. */
  SPARK = 0.08,
  /** A spark's coverage: blended over what lies behind it, not opaque. */
  SPARK_OPACITY = 0.85

/** The responsive swarm's pattern option: the materials named `spark pattern`, on whatever node
 *  wears them. */
export const SPARKS_RESPONSIVE: ResponsiveOption = { material: /^spark pattern$/ }

/** The settings by name: `responsive` a level or on and off — a level or off against a
 *  material's own extras. */
export const SPARKS_MATERIALS: MaterialsOption = {
  'still listed': { responsive: false },
  'still extras': { responsive: false },
  'spark listed': { responsive: true },
  'soft named': { responsive: 'medium' },
  'soft over extras': { responsive: 'medium' },
}

/** Each swarm's name, left to right, and its three materials: its name, and its extras if any. */
const SWARMS: readonly (readonly [string, readonly (readonly [string, object?])[]])[] = [
  ['still', [['still pattern'], ['still listed'], ['still extras', { responsive: true }]]],
  [
    'soft',
    [
      ['soft named'],
      ['soft extras', { responsive: 'medium' }],
      ['soft over extras', { responsive: true }],
    ],
  ],
  ['spark', [['spark pattern'], ['spark listed'], ['spark extras', { responsive: true }]]],
]

/** The three colours, linear, and how bright each glows. */
const COLOURS = [
  [1, 0.42, 0.08],
  [0.1, 0.75, 1],
  [1, 0.15, 0.6],
] as const
const GLOW = 8

/** Rounds a key value to a tenth of a millimetre: shorter, and the same bytes on every machine. */
const round = (value: number) => Math.round(snap(value) * 1e4) / 1e4

/** Writes `sparks.gltf` and `sparks.bin` into `directory`. */
export async function writeSparks(directory: string) {
  const gltf = new SceneGltf()
  const floor = gltf.material('floor', [0.04, 0.04, 0.05], { roughness: 0.7 })
  gltf.node({ name: 'floor', mesh: gltf.mesh('floor', [[box(32, 0.2, 12), floor]]) }, true)

  // A glowing material: black, its colour given off `GLOW` times over
  // (`KHR_materials_emissive_strength`), blended at `SPARK_OPACITY`, `extras` beside it when asked.
  const used = (gltf.document.extensionsUsed ??= [])
  used.push('KHR_materials_emissive_strength')
  const glowing = (name: string, colour: (typeof COLOURS)[number], extras?: object) => {
    const index = gltf.material(name, [0, 0, 0], { roughness: 1, emissive: colour })
    const material = gltf.document.materials[index]
    material.extensions = { KHR_materials_emissive_strength: { emissiveStrength: GLOW } }
    material.alphaMode = 'BLEND'
    material.pbrMetallicRoughness = {
      ...material.pbrMetallicRoughness,
      baseColorFactor: [0, 0, 0, SPARK_OPACITY],
    }
    if (extras) material.extras = { ...extras }
    return gltf.mesh(name, [[box(SPARK, SPARK, SPARK), index]])
  }
  const swarms = SWARMS.map(([, materials]) =>
    materials.map(([name, extras], colour) => glowing(name, COLOURS[colour], extras)),
  )

  // Each spark turns about its swarm's centre at one speed, on a circle of its own radius and
  // height, from an angle of its own; every swarm draws the same sparks, the same seed.
  const times = Array.from({ length: KEYS + 1 }, (_, k) => round((k * PERIOD) / KEYS))
  const motion: Channel[] = []
  swarms.forEach((meshes, side) => {
    const random = randomStream(17)
    for (let k = 0; k < PER_COLOUR * meshes.length; k++) {
      const mesh = meshes[k % meshes.length]
      const radius = random.uniform(1, 3),
        height = random.uniform(0.4, 2.4),
        phase = random.uniform(0, TAU),
        wobble = random.uniform(0.2, 0.6)
      const at = (t: number) => {
        const angle = phase + (TAU * t) / PERIOD
        return [
          round(CENTRES[side] + radius * Math.cos(angle)),
          round(height + wobble * Math.sin(3 * angle)),
          round(radius * Math.sin(angle)),
        ]
      }
      const node = gltf.node({ name: `${SWARMS[side][0]} ${k}`, mesh }, true)
      motion.push({ node, path: 'translation', times, values: times.flatMap(at) })
    }
  })
  gltf.animation('sparks', motion)
  await gltf.write(directory, 'sparks')
}
