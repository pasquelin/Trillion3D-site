import { TAU } from '#engine/packages/math/src/constants.ts'
import { SceneGltf, yaw } from './gltf-scene.ts'
import { disc, lathe, merge, moved, pairs } from './mesh.ts'
import { randomStream, sineNoise, snap, type Vec3 } from './random.ts'
import { icosphere } from './solids.ts'
import { heightGrid } from './terrain.ts'

/**
 * `instanced-gltf`: a valley of four thousand trees around a lake. Four tree shapes and a rock,
 * each written once; each is drawn by one node of `EXT_mesh_gpu_instancing`, its poses three
 * accessors of the binary. The file holds seven nodes; the compiler expands every pose into one.
 */
const TREES = 4000,
  ROCKS = 250,
  /** Samples along each side of the valley, and the metres between two: 200 m square. */
  SIDE = 101,
  STEP = 2
const LAKE = [-18, 12] as const

/** Rolling hills rising towards the rim, and a basin where the lake lies. */
const ground = (x: number, z: number) => {
  const [dx, dz] = [x - LAKE[0], z - LAKE[1]]
  return (
    3.5 * Math.cos(x / 29) * Math.cos(z / 23) +
    1.8 * Math.sin((x - 2 * z) / 19) +
    0.0009 * (x * x + z * z) -
    9 * Math.exp(-(dx * dx + dz * dz) / 1300)
  )
}
const WATER = Math.round(snap(ground(...LAKE) + 3.6) * 256) / 256

/** Rounds a pose value to a millimetre: shorter, and the same bytes on every machine. */
const round = (value: number) => Math.round(snap(value) * 1000) / 1000

/** A crown of lumpy spheres, `[x, y, z, radius]` each, its relief seeded by `seed`. */
function crown(seed: number, blobs: readonly (readonly number[])[]) {
  const lumps = sineNoise(seed, 3)
  return merge(
    blobs.map(([x, y, z, r], i) =>
      moved(
        icosphere(2, (p) => 1 + 0.18 * lumps([p[0] + i, p[1], p[2]])),
        [x, y, z],
        [r, r * 0.9, r],
      ),
    ),
  )
}

/** A spruce: a tapering trunk and six tiers of drooping branches, each a closed spinning top. */
const spruceTiers = () =>
  merge(
    Array.from({ length: 6 }, (_, i) => {
      const y = 1.6 + i * 1.2,
        r = 2.3 - i * 0.34
      return lathe(pairs([0, y, r, y + 0.35, 0, y + 2.1]), 14, { caps: false })
    }),
  )

/** Writes `forest.gltf` and `forest.bin` into `directory`. */
export async function writeForest(directory: string) {
  const gltf = new SceneGltf()
  // Base colours are linear, as glTF stores them: warm and dark, for a low evening sun.
  const bark = gltf.material('bark', [0.05, 0.032, 0.02], { roughness: 0.95 }),
    birchBark = gltf.material('birch bark', [0.62, 0.6, 0.55], { roughness: 0.7 }),
    needles = gltf.material('needles', [0.03, 0.075, 0.035], { roughness: 0.85 }),
    gold = gltf.material('birch leaves', [0.72, 0.38, 0.05], { roughness: 0.7 }),
    red = gltf.material('maple leaves', [0.55, 0.07, 0.02], { roughness: 0.7 }),
    olive = gltf.material('oak leaves', [0.13, 0.2, 0.04], { roughness: 0.8 }),
    grass = gltf.material('grass', [0.11, 0.15, 0.05], { roughness: 0.95 }),
    stone = gltf.material('stone', [0.25, 0.24, 0.22], { roughness: 0.8 }),
    water = gltf.material('water', [0.02, 0.035, 0.05], { roughness: 0.06 })

  const corner = (-(SIDE - 1) / 2) * STEP,
    relief = sineNoise(7, 3)
  gltf.node(
    {
      name: 'valley',
      // Untextured: the grid's (u, v) are left out of the file.
      mesh: gltf.mesh('valley', [
        [{ ...heightGrid(SIDE, STEP, [corner, corner], ground, 8), uvs: [] }, grass],
      ]),
    },
    true,
  )
  gltf.node(
    {
      name: 'lake',
      mesh: gltf.mesh('lake', [
        [moved(disc(1, 0, 96), [LAKE[0], WATER, LAKE[1]], [45, 1, 45]), water],
      ]),
    },
    true,
  )

  // The broadleaf crown is written once, worn by the oak in olive and the maple in red.
  const broadTrunk = gltf.primitive(
    lathe(pairs([0.35, 0, 0.28, 2.5, 0.12, 5]), 10, { caps: false }),
    bark,
  )
  const broadCrown = gltf.primitive(
    crown(3, [
      [0, 5.2, 0, 2.4],
      [1.6, 6, 0.8, 2],
      [-1.4, 6.2, -0.6, 2.1],
      [0.3, 7.3, -0.2, 1.9],
      [-0.4, 5.6, 1.6, 1.8],
    ]),
    olive,
  )
  const kinds = {
    spruce: gltf.mesh('spruce', [
      [lathe(pairs([0.22, 0, 0.16, 2, 0.05, 8.5]), 8, { caps: false }), bark],
      [spruceTiers(), needles],
    ]),
    birch: gltf.mesh('birch', [
      [lathe(pairs([0.13, 0, 0.1, 4, 0.03, 8]), 8, { caps: false }), birchBark],
      [
        crown(2, [
          [0, 4.8, 0, 1.3],
          [0.6, 6, 0.3, 1.2],
          [-0.5, 6.7, -0.2, 1.1],
          [0.1, 7.6, 0.1, 0.9],
        ]),
        gold,
      ],
    ]),
    oak: gltf.mesh('oak', [broadTrunk, broadCrown]),
    maple: gltf.mesh('maple', [broadTrunk, { ...broadCrown, material: red }]),
    rock: gltf.mesh('rock', [[icosphere(2, (p) => 1 + 0.2 * relief(p)), stone]]),
  }

  // Each kind's poses: on dry ground, in clumps; spruces climb the slopes, the broadleaves keep
  // to the lower ground; rocks line the shore. Every tree turned and sized on its own.
  const poses = Object.fromEntries(
    Object.keys(kinds).map((kind) => [
      kind,
      { t: [] as number[], r: [] as number[], s: [] as number[] },
    ]),
  )
  const random = randomStream(17),
    clumps = sineNoise(23, 2)
  const place = (kind: string, [x, y, z]: Vec3, size: Vec3) => {
    poses[kind].t.push(round(x), round(y - 0.15), round(z))
    poses[kind].r.push(...yaw(random.uniform(0, TAU)))
    poses[kind].s.push(...size.map(round))
  }
  for (let trees = 0, rocks = 0; trees < TREES || rocks < ROCKS;) {
    const x = random.uniform(-96, 96),
      z = random.uniform(-96, 96),
      at: Vec3 = [x, ground(x, z), z],
      above = at[1] - WATER
    if (above < 0.8) continue
    if (rocks < ROCKS && above < 4 && random.next() < 0.15) {
      const size = random.uniform(0.4, 1.6)
      place('rock', at, [size, size * 0.6, size * 0.9])
      rocks++
    } else if (trees < TREES && random.next() < 0.55 + 0.6 * clumps([x / 25, 0, z / 25])) {
      const kind =
          random.next() < Math.min(0.85, 0.2 + above / 16)
            ? 'spruce'
            : ['birch', 'oak', 'maple'][random.integer(3)],
        size = random.uniform(0.65, 1.3)
      place(kind, at, [size, size * random.uniform(0.85, 1.2), size])
      trees++
    }
  }
  for (const [kind, mesh] of Object.entries(kinds)) {
    const { t, r, s } = poses[kind]
    gltf.instances(kind, mesh, t, r, s, true)
  }
  await gltf.write(directory, 'forest')
}
