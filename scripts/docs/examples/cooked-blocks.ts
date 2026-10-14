import { TAU } from '#engine/packages/math/src/constants.ts'
import { geometry } from '#engine/packages/sdk-core/src/world/geometry/index.ts'
import { SceneGltf, turn } from './gltf-scene.ts'
import { fromGeometry, merge, moved } from './mesh.ts'
import { randomStream } from './random.ts'
import { box, icosphere } from './solids.ts'

/** The painted colours the blocks come in. */
const PAINTS = [
  [0.75, 0.16, 0.12],
  [0.9, 0.62, 0.12],
  [0.12, 0.38, 0.68],
  [0.14, 0.5, 0.32],
  [0.86, 0.82, 0.74],
] as const
/** A ball's radius: its declared sphere and its drawn mesh are the same size. */
const BALL = 0.27

/**
 * `cooked-blocks`: forty-eight painted blocks — cubes, planks, drums and balls — held in the air
 * over a stepped stone plinth. Each block's node declares a dynamic rigid body
 * (`KHR_physics_rigid_bodies`): a ball's collider is a declared sphere (`KHR_implicit_shapes`) of
 * bouncing rubber, every other block's the hull the compiler cooks from its mesh and weighs. The
 * plinth and the floor declare nothing, and stay static ground. The page restores the bodies, and
 * the blocks fall from the first step.
 */
export async function writeCookedBlocks(directory: string) {
  const gltf = new SceneGltf(),
    random = randomStream(7)
  gltf.document.extensionsUsed = ['KHR_physics_rigid_bodies', 'KHR_implicit_shapes']
  gltf.document.extensions = {
    KHR_physics_rigid_bodies: {
      physicsMaterials: [
        { dynamicFriction: 0.6, restitution: 0.15 },
        { dynamicFriction: 0.8, restitution: 0.7 },
      ],
    },
    KHR_implicit_shapes: { shapes: [{ type: 'sphere', sphere: { radius: BALL } }] },
  }
  const stone = gltf.material('stone', [0.55, 0.53, 0.5], { roughness: 0.85 }),
    sand = gltf.material('sandstone', [0.78, 0.66, 0.5], { roughness: 0.8 })
  // Three tiers, 0.6 m each, on a floor whose top is at zero.
  const tiers = [7, 4.6, 2.2].map((side, tier) =>
    moved(box(side, 0.6, side), [0, 0.3 + tier * 0.6, 0]),
  )
  const children = [
    gltf.node({
      name: 'floor',
      mesh: gltf.mesh('floor', [[moved(box(18, 0.4, 18), [0, -0.2, 0]), stone]]),
    }),
    gltf.node({ name: 'plinth', mesh: gltf.mesh('plinth', [[merge(tiers), sand]]) }),
  ]
  // Each kind drawn once per paint; the nodes share those meshes.
  const shapes = {
    cube: box(0.5, 0.5, 0.5),
    plank: box(0.9, 0.2, 0.3),
    drum: fromGeometry(geometry.cylinder(0.25, 0.25, 0.4, 24)),
    ball: icosphere(3, () => BALL),
  }
  const paints = PAINTS.map((paint, i) => gltf.material(`paint ${i}`, paint, { roughness: 0.45 }))
  const meshes = new Map<string, number>()
  const meshOf = (kind: keyof typeof shapes, paint: number) => {
    const key = `${kind} ${paint}`
    if (!meshes.has(key)) meshes.set(key, gltf.mesh(key, [[shapes[kind], paints[paint]]]))
    return meshes.get(key)!
  }
  const kinds = Object.keys(shapes) as (keyof typeof shapes)[]
  // Four by four, three layers high, every block turned at random: a plank, the longest,
  // reaches 0.49 m from its centre, so blocks 1 m apart at the least touch nothing at the start.
  for (let layer = 0; layer < 3; layer++)
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 4; column++) {
        const n = layer * 16 + row * 4 + column,
          kind = kinds[n % kinds.length]
        const collider =
          kind === 'ball'
            ? { geometry: { shape: 0 }, physicsMaterial: 1 }
            : { geometry: { convexHull: true }, physicsMaterial: 0 }
        // Drawn for every block, so the seeded draws after it stay where they were.
        const rotation = turn(random.direction(), random.uniform(0, TAU))
        children.push(
          gltf.node({
            name: `${kind} ${n}`,
            mesh: meshOf(kind, random.integer(PAINTS.length)),
            translation: [
              -1.65 + column * 1.1 + random.uniform(-0.05, 0.05),
              4.2 + layer * 1.2,
              -1.65 + row * 1.1 + random.uniform(-0.05, 0.05),
            ],
            // A ball stands unturned: a sphere looks the same either way, and a rounded turn is
            // a quaternion a hair off unit length, a scale the engine refuses for a sphere body.
            ...(kind === 'ball' ? {} : { rotation }),
            extensions: { KHR_physics_rigid_bodies: { motion: {}, collider } },
          }),
        )
      }
  gltf.node({ name: 'a rain of blocks', children }, true)
  await gltf.write(directory, 'blocks')
}
