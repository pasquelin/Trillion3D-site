import { HALF_PI, QUARTER_PI, TAU } from '#engine/packages/math/src/constants.ts'
import { clamp } from '#engine/packages/math/src/scalar/reals.ts'
import { length2, length3 } from '#engine/packages/math/src/vector/vector.ts'
import { geometry } from '#engine/packages/sdk-core/src/world/geometry/index.ts'
import {
  resolveHlod,
  type HlodOptions,
} from '#engine/packages/sdk-core/src/contracts/hlodOptions.ts'
import { SceneGltf, turn, yaw, type Channel } from './gltf-scene.ts'
import { icosphere, box, sleeve } from './solids.ts'
import { fromGeometry, lathe, merge, moved, solid, type Mesh } from './mesh.ts'
import { randomStream, snap, type RandomStream, type Vec3 } from './random.ts'
import { signTile, TILES, writeDistrictTextures } from './district-textures.ts'

/**
 * `long-district`: a city street two kilometres long, in metres, seen from one end — a game's
 * district, detailed but never crowded, built to watch the cut through the cluster tree from the
 * first metre to the last. Near the camera, a bus shelter of glass, shop windows, puddles, lamps,
 * benches and parked cars; along the street, blocks of flats with every window framed and glazed,
 * trees and traffic; past a kilometre, towers in glass curtain walls; at the end, a lake that
 * mirrors a far shore of towers. The buildings and the cars are a few models placed many times;
 * the street, its paint and its lake are one piece each.
 *
 * It is also the bench of the baked distant levels, each case a bake must handle placed at
 * several distances: a test chart facing the street from the far shore — fins and louvres of
 * known widths, window grids of known periods, signs at every frequency; glossy relief —
 * corrugated cladding, louvres, ribbed panels; cutouts — railings, perforated screens, a fence,
 * cards of leaves; concave spaces — courtyards, loggias, arcades; thin parts — antennas, cables,
 * masts, flagpoles; repeated models and unique landmarks, up to a skyline that fills the far
 * field. And what moves, in one clip of `PERIOD` seconds: cars in the inner lanes, a tram across
 * the lakefront, a Ferris wheel and its cabins, wind turbines, a lift up the chart — rigid nodes
 * whose placement moves — and flags that bend by morph targets, which no bake may freeze.
 */

const ROAD = 8, // half the carriageway, metres
  KERB = 14, // where the pavement ends and the plots begin
  END = -1800, // where the street meets the lake
  PERIOD = 120, // seconds of the district's one clip, which loops
  CHART_Z = -2400, // the test chart's foot on the far shore, facing the street
  CHART_WIDTH = 40,
  CHART_FLOORS = 30

/** An axis box of size `size` centred on `centre`. */
const cuboid = (
  centre: readonly [number, number, number],
  size: readonly [number, number, number],
) => moved(box(size[0], size[1], size[2]), [...centre])

const X: Vec3 = [1, 0, 0],
  Y: Vec3 = [0, 1, 0],
  Z: Vec3 = [0, 0, 1]

/** `mesh` turned `angle` radians about the unit `axis` through the origin (Rodrigues). */
function rotated(mesh: Mesh, [kx, ky, kz]: Vec3, angle: number): Mesh {
  const [c, s] = [snap(Math.cos(angle)), snap(Math.sin(angle))]
  const turned = (values: readonly number[]) => {
    const out = values.slice()
    for (let i = 0; i < values.length; i += 3) {
      const [x, y, z] = [values[i], values[i + 1], values[i + 2]],
        along = (kx * x + ky * y + kz * z) * (1 - c)
      out[i] = x * c + (ky * z - kz * y) * s + kx * along
      out[i + 1] = y * c + (kz * x - kx * z) * s + ky * along
      out[i + 2] = z * c + (kx * y - ky * x) * s + kz * along
    }
    return out
  }
  return { ...mesh, positions: turned(mesh.positions), normals: turned(mesh.normals) }
}

/** A rod of `radius` from `a` to `b`, `sides` faces round, open at its ends: a cable, a spoke. */
function rod(a: Vec3, b: Vec3, radius: number, sides = 4): Mesh {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    length = length3(d[0], d[1], d[2])
  const along = lathe(
    [
      [radius, 0],
      [radius, length],
    ],
    sides,
    { caps: false },
  )
  // From +Y to the rod's direction: about the axis Y × d, by the angle between them.
  const sine = length2(d[0], d[2])
  const turned =
    sine < 1e-9
      ? d[1] < 0
        ? rotated(along, X, Math.PI)
        : along
      : rotated(along, [d[2] / sine, 0, -d[0] / sine], Math.atan2(sine, d[1]))
  return moved(turned, a)
}

/** A cable from `a` to `b` hanging `sag` metres at its middle, in `segments` straight rods. */
function cable(a: Vec3, b: Vec3, sag: number, radius = 0.015, segments = 8): Mesh {
  const at = (t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t),
    a[2] + (b[2] - a[2]) * t,
  ]
  return merge(
    Array.from({ length: segments }, (_, k) =>
      rod(at(k / segments), at((k + 1) / segments), radius),
    ),
  )
}

/** A corrugated sheet `width` by `height` in the xy plane, facing +z: a sine of `period` and
 *  `depth`, six facets a period, smooth-shaded. */
function corrugated(width: number, height: number, period: number, depth: number): Mesh {
  const facets = Math.round(width / period) * 6,
    positions: number[] = [],
    indices: number[] = []
  for (let k = 0; k <= facets; k++) {
    const x = -width / 2 + (width * k) / facets,
      z = snap((depth / 2) * Math.sin((TAU * k) / 6))
    positions.push(x, 0, z, x, height, z)
    if (k) indices.push(2 * k - 2, 2 * k, 2 * k - 1, 2 * k - 1, 2 * k, 2 * k + 1)
  }
  return solid(positions, indices)
}

/** `mesh`'s (u, v), from 0 to 1, brought into tile `tile` of the sign atlas. */
function onTile(mesh: Mesh, tile: number): Mesh {
  const [u0, v0, side] = signTile(tile)
  return { ...mesh, uvs: mesh.uvs.map((value, i) => (i % 2 ? v0 : u0) + value * side) }
}

/** A box `size` at `centre` whose every face shows tile `tile` of the sign atlas. */
const sign = (tile: number, size: Vec3, centre: Vec3) =>
  moved(onTile(fromGeometry(geometry.box(size[0], size[1], size[2])), tile), centre)

/** The parts of a model, one mesh per material. */
type Parts = Map<number, Mesh[]>
const add = (parts: Parts, material: number, ...meshes: Mesh[]) =>
  parts.set(material, [...(parts.get(material) ?? []), ...meshes])
const partsOf = (parts: Parts) =>
  [...parts].map(([material, meshes]) => [merge(meshes), material] as const)

/** The district's materials. */
function materials(gltf: SceneGltf, textures: Record<string, string>) {
  const m = gltf.material.bind(gltf)
  return {
    asphalt: m('asphalt', [0.11, 0.11, 0.12], { roughness: 0.92 }),
    paint: m('road paint', [0.85, 0.85, 0.8], { roughness: 0.7 }),
    pavement: m('pavement', [0.55, 0.53, 0.5], { roughness: 0.85 }),
    kerb: m('kerb stone', [0.68, 0.66, 0.62], { roughness: 0.75 }),
    grass: m('grass', [0.27, 0.38, 0.17], { roughness: 0.95 }),
    puddle: m('puddle', [0.05, 0.06, 0.07], { roughness: 0.03 }),
    facades: [
      m('red brick', [0.48, 0.22, 0.16], { roughness: 0.85 }),
      m('cream render', [0.82, 0.76, 0.62], { roughness: 0.8 }),
      m('grey concrete', [0.5, 0.5, 0.49], { roughness: 0.9 }),
      m('ochre render', [0.72, 0.52, 0.3], { roughness: 0.8 }),
      m('slate blue', [0.32, 0.38, 0.45], { roughness: 0.7 }),
    ],
    frame: m('window frame', [0.12, 0.12, 0.13], { roughness: 0.4, metallic: 0.6 }),
    glass: m('window glass', [0.7, 0.8, 0.85], { roughness: 0.05, transmission: 0.85 }),
    shop: m('shop window', [0.85, 0.9, 0.9], { roughness: 0.02, transmission: 0.92 }),
    display: m('lit display', [0.9, 0.8, 0.6], { emissive: [1, 0.78, 0.45] }),
    roof: m('roof felt', [0.2, 0.2, 0.21], { roughness: 0.95 }),
    metal: m('street metal', [0.18, 0.2, 0.2], { roughness: 0.35, metallic: 0.8 }),
    lamp: m('lamp globe', [1, 0.95, 0.85], { emissive: [1, 0.85, 0.6], transmission: 0.5 }),
    bark: m('bark', [0.3, 0.22, 0.16], { roughness: 0.95 }),
    leaves: [
      m('leaves', [0.2, 0.36, 0.14], { roughness: 0.9 }),
      m('autumn leaves', [0.55, 0.36, 0.12], { roughness: 0.9 }),
    ],
    paints: [
      m('red paint', [0.6, 0.06, 0.05], { roughness: 0.25, metallic: 0.5 }),
      m('white paint', [0.85, 0.85, 0.85], { roughness: 0.25, metallic: 0.4 }),
      m('black paint', [0.03, 0.03, 0.035], { roughness: 0.2, metallic: 0.6 }),
      m('taxi yellow', [0.85, 0.62, 0.05], { roughness: 0.3, metallic: 0.4 }),
    ],
    tyre: m('tyre', [0.04, 0.04, 0.04], { roughness: 0.9 }),
    windscreen: m('windscreen', [0.15, 0.18, 0.2], { roughness: 0.03, transmission: 0.6 }),
    headlight: m('headlight', [1, 1, 0.95], { emissive: [1, 1, 0.9] }),
    curtain: m('curtain wall', [0.35, 0.45, 0.55], {
      roughness: 0.06,
      metallic: 0.3,
      transmission: 0.4,
    }),
    core: m('tower core', [0.08, 0.09, 0.1], { roughness: 0.6 }),
    water: m('lake water', [0.04, 0.08, 0.1], { roughness: 0.02 }),
    // The bench's: the chart's two extremes of contrast, and the colour coding each of its bands
    // by rank (the resistor code: black, brown, red, orange, … white for the tenth).
    chartWhite: m('chart white', [0.9, 0.9, 0.88], { roughness: 0.6 }),
    chartBlack: m('chart black', [0.02, 0.02, 0.025], { roughness: 0.8 }),
    codes: (
      [
        [0.02, 0.02, 0.02],
        [0.35, 0.18, 0.08],
        [0.8, 0.05, 0.04],
        [0.95, 0.4, 0.02],
        [0.95, 0.85, 0.05],
        [0.1, 0.6, 0.1],
        [0.05, 0.2, 0.8],
        [0.5, 0.1, 0.7],
        [0.45, 0.45, 0.45],
        [0.95, 0.95, 0.95],
      ] as const
    ).map((colour, k) => m(`chart code ${k}`, colour, { roughness: 0.6 })),
    // Glossy relief, in geometry and in a normal map: highlights a far level must not sparkle.
    corrugated: m('corrugated steel', [0.62, 0.64, 0.66], { roughness: 0.22, metallic: 1 }),
    louvre: m('louvre aluminium', [0.76, 0.77, 0.79], { roughness: 0.3, metallic: 0.9 }),
    ribbed: m('ribbed panel', [0.55, 0.57, 0.6], {
      roughness: 0.18,
      metallic: 1,
      normalTexture: textures.ribs,
    }),
    signs: m('signs', [1, 1, 1], { roughness: 0.5, texture: textures.signs }),
    // Cutouts, whose coverage the mips must keep.
    perforated: m('perforated screen', [0.72, 0.72, 0.74], {
      roughness: 0.35,
      metallic: 0.8,
      texture: textures.perforated,
      cutout: 0.5,
    }),
    fence: m('mesh fence', [0.6, 0.62, 0.6], {
      roughness: 0.4,
      metallic: 0.7,
      texture: textures.fence,
      cutout: 0.5,
    }),
    railing: m('railing', [1, 1, 1], { roughness: 0.4, texture: textures.railing, cutout: 0.5 }),
    leafCards: m('leaf cards', [1, 1, 1], {
      roughness: 0.85,
      texture: textures.leaves,
      cutout: 0.5,
    }),
    cable: m('cable', [0.02, 0.02, 0.02], { roughness: 0.5 }),
  }
}
type Materials = ReturnType<typeof materials>

/** The windows of one face of a block: `along` the face's axis, its normal `out` (+1 or -1) on
 *  `axis`, the face at `plane` on that axis; panes in frames on every floor above the shop
 *  floor and, with `shop`, one shop window below, its face at `shopPlane`. */
function faceWindows(
  parts: Parts,
  look: Materials,
  {
    axis,
    out,
    span,
    plane,
    shopPlane = plane,
    floors,
    shop = true,
  }: {
    axis: 'x' | 'z'
    out: number
    span: number
    plane: number
    shopPlane?: number
    floors: number
    shop?: boolean
  },
) {
  const at = (u: number, y: number, depth: number, face = plane): [number, number, number] =>
    axis === 'z' ? [u, y, face + out * depth] : [face + out * depth, y, u]
  const size = (u: number, v: number, w: number): [number, number, number] =>
    axis === 'z' ? [u, v, w] : [w, v, u]
  const columns = Math.max(1, Math.floor(span / 3))
  for (let floor = 0; floor < floors; floor++)
    for (let c = 0; c < columns; c++) {
      const u = -span / 2 + (span / columns) * (c + 0.5),
        y = 4.2 + floor * 3.2 + 1.7
      add(parts, look.frame, cuboid(at(u, y, 0.03), size(1.55, 1.95, 0.06)))
      add(parts, look.glass, cuboid(at(u, y, 0.07), size(1.3, 1.7, 0.03)))
    }
  if (!shop) return
  add(parts, look.shop, cuboid(at(0, 1.9, 0.05, shopPlane), size(span * 0.8, 2.8, 0.04)))
  add(parts, look.display, cuboid(at(0, 1.2, -0.6, shopPlane), size(span * 0.7, 1.4, 0.4)))
}

/** What a block may add to its plain mass, each a case for the bake: a `court` open to the sky
 *  (concave), `loggias` recessed behind railings (concave, cutout), an `arcade` along its shop
 *  floor (concave), a `glossy` skin of corrugated steel, louvres and ribbed panels, `signs` of
 *  every frequency with a billboard on the roof, a perforated `screen` before its windows
 *  (cutout). */
interface BlockFeatures {
  court?: boolean
  loggias?: boolean
  arcade?: boolean
  glossy?: boolean
  signs?: boolean
  screen?: boolean
}

/** A block of flats `width` by `depth` with `floors` storeys over a shop floor: framed and glazed
 *  windows on all four faces, a ledge at every floor, a parapet, plant and a tank on the roof;
 *  and the `features` asked. Its faces along z are the street's, whichever side it stands. */
function block(
  look: Materials,
  random: RandomStream,
  width: number,
  depth: number,
  floors: number,
  facade: number,
  features: BlockFeatures = {},
) {
  const parts: Parts = new Map(),
    height = 4.2 + floors * 3.2,
    court = features.court ? Math.min(width, depth) * 0.45 : 0,
    arcade = features.arcade ? 3 : 0,
    recess = features.loggias ? 1.6 : 0,
    columns = Math.max(1, Math.floor(width / 3))
  // The mass from `y0` to `y1`: four wings round the court, or one box; its faces along z set
  // back by `inset`, and every face pushed out by `grow`.
  const mass = (y0: number, y1: number, inset = 0, grow = 0) => {
    const [hx, hz, c] = [width / 2 + grow, depth / 2 - inset + grow, court / 2 - grow],
      [y, h] = [(y0 + y1) / 2, y1 - y0]
    if (!court) return add(parts, facade, cuboid([0, y, 0], [2 * hx, h, 2 * hz]))
    add(
      parts,
      facade,
      cuboid([0, y, (hz + c) / 2], [2 * hx, h, hz - c]),
      cuboid([0, y, -(hz + c) / 2], [2 * hx, h, hz - c]),
      cuboid([(hx + c) / 2, y, 0], [hx - c, h, 2 * c]),
      cuboid([-(hx + c) / 2, y, 0], [hx - c, h, 2 * c]),
    )
  }
  if (arcade || recess) {
    mass(0, 4.2, arcade)
    mass(4.2, height, recess)
  } else mass(0, height)
  for (let floor = 0; floor <= floors; floor++)
    mass(4.2 + floor * 3.2 - 0.2, 4.2 + floor * 3.2, 0, 0.15)
  for (const out of [-1, 1]) {
    faceWindows(parts, look, {
      axis: 'z',
      out,
      span: width,
      plane: out * (depth / 2 - recess),
      shopPlane: out * (depth / 2 - arcade),
      floors,
    })
    if (!features.glossy)
      faceWindows(parts, look, { axis: 'x', out, span: depth, plane: (out * width) / 2, floors })
    if (court)
      for (const axis of ['x', 'z'] as const)
        faceWindows(parts, look, {
          axis,
          out: -out,
          span: court,
          plane: (out * court) / 2,
          floors,
          shop: false,
        })
    // Loggias: a pier between every two bays, a railing along every floor.
    if (recess) {
      for (let c = 0; c <= columns; c++)
        add(
          parts,
          facade,
          cuboid(
            [
              -width / 2 + (width / columns) * c,
              (4.2 + height) / 2,
              out * (depth / 2 - recess / 2),
            ],
            [0.3, height - 4.2, recess],
          ),
        )
      for (let floor = 0; floor < floors; floor++)
        add(
          parts,
          look.railing,
          moved(box(width, 1, 0.02, 1), [0, 4.2 + floor * 3.2 + 0.5, out * (depth / 2 - 0.05)]),
        )
    }
    if (arcade)
      for (let c = 0; c <= columns; c++)
        add(
          parts,
          facade,
          cuboid(
            [-width / 2 + 0.3 + ((width - 0.6) / columns) * c, 2.1, out * (depth / 2 - 0.3)],
            [0.6, 4.2, 0.6],
          ),
        )
    if (features.glossy) {
      // The end walls clad in corrugated steel, louvres before the windows, a ribbed fascia.
      const cladding = rotated(corrugated(depth, height, 0.15, 0.05), Y, out * HALF_PI)
      add(parts, look.corrugated, moved(cladding, [out * (width / 2 + 0.03), 0, 0]))
      const slat = rotated(box(width, 0.02, 0.35), X, 0.5)
      for (let y = 4.6; y < height - 0.3; y += 0.3)
        add(parts, look.louvre, moved(slat, [0, y, out * (depth / 2 + 0.45)]))
      add(
        parts,
        look.ribbed,
        moved(box(width, 0.8, 0.06, 2.5), [0, 3.75, out * (depth / 2 + 0.04)]),
      )
    }
    if (features.screen)
      add(
        parts,
        look.perforated,
        moved(box(width, height - 4.6, 0.02, 2.5), [
          0,
          (height + 4.6) / 2,
          out * (depth / 2 + 0.8),
        ]),
      )
    if (features.signs) {
      const face = out * (depth / 2 - arcade + 0.12)
      for (let k = 0; k < 3; k++) {
        const tile = TILES.lettering[(k + (out > 0 ? 0 : 2)) % 4]
        add(
          parts,
          look.signs,
          sign(tile, [width * 0.28, 0.7, 0.1], [(width / 3) * (k - 1), 3.75, face]),
        )
      }
      const end: Vec3 = [out * (width / 2 + 0.12), 3.75, 0]
      add(parts, look.signs, sign(TILES.stripes[out > 0 ? 0 : 2], [0.1, 0.7, depth * 0.8], end))
    }
  }
  if (features.signs) {
    // A billboard on two legs on the roof: a zone plate towards one end of the street, a target
    // towards the other.
    for (const [out, tile] of [
      [1, TILES.zonePlate],
      [-1, TILES.target],
    ])
      add(parts, look.signs, sign(tile, [12, 12, 0.1], [0, height + 9.5, out * 0.06]))
    for (const x of [-4, 4])
      add(parts, look.metal, rod([x, height, 0], [x, height + 3.5, 0], 0.15, 6))
  }
  for (const [x, z, sx, sz] of [
    [0, depth / 2, width, 0.3],
    [0, -depth / 2, width, 0.3],
    [width / 2, 0, 0.3, depth],
    [-width / 2, 0, 0.3, depth],
    ...(court
      ? [
          [0, court / 2, court, 0.3],
          [0, -court / 2, court, 0.3],
          [court / 2, 0, 0.3, court],
          [-court / 2, 0, 0.3, court],
        ]
      : []),
  ])
    add(parts, look.roof, cuboid([x, height + 0.5, z], [sx, 1, sz]))
  // Plant on the roof: anywhere on a plain block, on the long wings round a court.
  const wing = (court + depth) / 4
  for (let k = 0; k < 3; k++) {
    const [x, z] = [random.uniform(-width / 3, width / 3), random.uniform(-depth / 3, depth / 3)]
    add(
      parts,
      look.metal,
      cuboid([x, height + 0.6, court ? (z < 0 ? -wing : wing) : z], [2.2, 1.2, 1.6]),
    )
  }
  add(
    parts,
    look.metal,
    moved(
      lathe(
        [
          [1.4, 0],
          [1.4, 3],
          [1.1, 3.4],
          [0, 3.6],
        ],
        20,
      ),
      [width / 4, height, court ? -wing : -depth / 4],
    ),
  )
  return partsOf(parts)
}

/** The fin widths of the test chart, metres, one band each from the bottom up; the periods of
 *  its window grids above them; the height of a band. */
const FIN_WIDTHS = [0.03, 0.05, 0.08, 0.12, 0.2, 0.3, 0.5, 0.8, 1.2, 2],
  GRID_PERIODS = [0.6, 1.2, 2.4, 4.8],
  BAND = 6

/**
 * The test chart on the +z face of a tower `width` wide, at `face`: a band `BAND` metres high
 * per fin width — white fins of that width, a period of three widths apart, on black, upright on
 * the left half and lying on the right —, then a band per window grid period, then a row of
 * signs. Each band is coded at both ends by the colour of its rank; the middle strip is the
 * lift's. Returns the height it reaches.
 */
function chartFacade(parts: Parts, look: Materials, width: number, face: number) {
  const half = width / 2,
    reach = half - 3, // each half's span, from the lift's strip to the code plates
    top = 4 + (FIN_WIDTHS.length + GRID_PERIODS.length) * BAND
  add(parts, look.chartBlack, cuboid([0, top / 2 + 2, face], [width, top - 4, 0.1]))
  const band = (k: number, code: number) => {
    const y = 4 + (k + 0.5) * BAND
    for (const side of [-1, 1])
      add(
        parts,
        look.codes[code],
        cuboid([side * (half - 0.75), y, face + 0.15], [1.2, BAND - 0.4, 0.2]),
      )
    return [y, y - BAND / 2 + 0.2]
  }
  FIN_WIDTHS.forEach((fin, k) => {
    const [y, bottom] = band(k, k),
      period = fin * 3,
      deep = clamp(fin, 0.1, 0.3),
      z = face + 0.05 + deep / 2
    for (let u = 1.5 + fin / 2; u < 1.5 + reach - fin / 2; u += period)
      add(parts, look.chartWhite, cuboid([-u, y, z], [fin, BAND - 0.4, deep]))
    for (let v = fin / 2; v < BAND - 0.4 - fin / 2; v += period)
      add(parts, look.chartWhite, cuboid([1.5 + reach / 2, bottom + v, z], [reach, fin, deep]))
  })
  GRID_PERIODS.forEach((period, k) => {
    const [y, bottom] = band(FIN_WIDTHS.length + k, k)
    for (const side of [-1, 1]) {
      const centre = side * (1.5 + reach / 2)
      add(parts, look.glass, cuboid([centre, y, face + 0.08], [reach, BAND - 0.4, 0.04]))
      for (let u = 0; u <= reach + 1e-6; u += period)
        add(
          parts,
          look.chartWhite,
          cuboid([centre - reach / 2 + u, y, face + 0.14], [0.1, BAND - 0.4, 0.08]),
        )
      for (let v = 0; v <= BAND - 0.4 + 1e-6; v += period)
        add(parts, look.chartWhite, cuboid([centre, bottom + v, face + 0.14], [reach, 0.1, 0.08]))
    }
  })
  // Signs across the top: a zone plate, the finest checker and stripes, a grid of lines.
  const side = width / 4
  ;[TILES.zonePlate, TILES.checkers[3], TILES.stripes[3], TILES.grid].forEach((tile, k) =>
    add(
      parts,
      look.signs,
      sign(
        tile,
        [side - 0.4, side - 0.4, 0.1],
        [-half + side * (k + 0.5), top + side / 2 + 0.5, face],
      ),
    ),
  )
  return top + side + 1
}

/** What a tower may carry: an `antenna` mast on its roof (thin), glossy `fins` on its curtain
 *  wall, the test `chart` on its +z face, with a lift's shaft and three flagpoles. */
interface TowerFeatures {
  antenna?: boolean
  fins?: boolean
  chart?: boolean
}

/** A tower `width` square and `floors` storeys high: a dark core in a curtain wall of glass, its
 *  mullions every three metres and a transom band at every floor; and the `features` asked. */
function tower(look: Materials, width: number, floors: number, features: TowerFeatures = {}) {
  const parts: Parts = new Map(),
    height = floors * 3.6,
    half = width / 2
  add(parts, look.core, cuboid([0, height / 2, 0], [width - 1, height, width - 1]))
  add(parts, look.curtain, moved(sleeve(width, height, width), [0, height / 2, 0]))
  const mullions = Math.floor(width / 3)
  for (let k = 0; k <= mullions; k++) {
    const u = -half + (width / mullions) * k
    for (const [x, z, sx, sz] of [
      [u, half + 0.1, 0.15, 0.3],
      [u, -half - 0.1, 0.15, 0.3],
      [half + 0.1, u, 0.3, 0.15],
      [-half - 0.1, u, 0.3, 0.15],
    ])
      add(parts, look.frame, cuboid([x, height / 2, z], [sx, height, sz]))
  }
  for (let floor = 1; floor < floors; floor++)
    add(parts, look.frame, cuboid([0, floor * 3.6, 0], [width + 0.5, 0.25, width + 0.5]))
  add(parts, look.roof, cuboid([0, height + 2, 0], [width * 0.5, 4, width * 0.5]))
  if (features.fins)
    for (let u = -half + 0.5; u < half; u += 1)
      for (const [x, z, sx, sz] of [
        [u, half + 0.4, 0.08, 0.6],
        [u, -half - 0.4, 0.08, 0.6],
        [half + 0.4, u, 0.6, 0.08],
        [-half - 0.4, u, 0.6, 0.08],
      ])
        add(parts, look.louvre, cuboid([x, height / 2, z], [sx, height, sz]))
  if (features.antenna) {
    add(
      parts,
      look.metal,
      lathe(
        [
          [0.3, height + 4],
          [0.12, height + 30],
          [0.04, height + 34],
        ],
        6,
      ),
    )
    for (const y of [height + 12, height + 20])
      add(parts, look.metal, rod([-2, y, 0], [2, y, 0], 0.04), rod([0, y, -2], [0, y, 2], 0.04))
  }
  if (features.chart) {
    const face = half + 0.6,
      top = chartFacade(parts, look, width, face)
    // The lift's shaft up the middle strip, two rails behind a glass front; its cabin is a node
    // of its own (`liftCabin`), which the clip moves.
    add(parts, look.shop, cuboid([0, top / 2, face + 2.2], [2.6, top, 0.05]))
    for (const x of [-1.35, 1.35])
      add(parts, look.metal, cuboid([x, top / 2, face + 1.1], [0.1, top, 2.2]))
    for (const x of FLAG_POLES) add(parts, look.metal, moved(flagpole(), [x, height, half - 1]))
  }
  return partsOf(parts)
}

/** The flags on the chart's roof stand at these x. */
const FLAG_POLES = [-12, 0, 12]

/** A flagpole twelve metres high, its truck at the top. */
const flagpole = () =>
  lathe(
    [
      [0.09, 0],
      [0.05, 12],
      [0.12, 12.1],
      [0, 12.3],
    ],
    8,
  )

/** The cabin of the chart's lift, its lit front towards the street. */
const liftCabin = (look: Materials) =>
  partsOf(
    new Map([
      [look.metal, [cuboid([0, 1.3, 0], [2.3, 2.6, 1.6])]],
      [look.display, [cuboid([0, 1.4, 0.81], [1.9, 1.8, 0.02])]],
    ]),
  )

/** A vehicle painted `paint`, `length` long and `width` wide, every height times `tall`: its
 *  body, a glass cabin `cabin` long under its roof, four wheels, two headlights. The defaults
 *  make a car; a tram's carriage is a long, wide and tall one. */
function car(
  look: Materials,
  paint: number,
  { length = 4.4, width = 1.85, cabin = 2.3, tall = 1 } = {},
) {
  const parts: Parts = new Map()
  add(
    parts,
    paint,
    cuboid([0, 0.6 * tall, 0], [width, 0.7 * tall, length]),
    cuboid([0, 1.53 * tall, -0.2], [width - 0.25, 0.06, cabin - 0.2]),
  )
  add(parts, look.windscreen, cuboid([0, 1.22 * tall, -0.2], [width - 0.15, 0.6 * tall, cabin]))
  const wheel = rotated(
    lathe(
      [
        [0.36 * tall, -0.13],
        [0.36 * tall, 0.13],
      ],
      24,
    ),
    Z,
    HALF_PI,
  )
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      add(
        parts,
        look.tyre,
        moved(wheel, [x * (width / 2 - 0.075), 0.36 * tall, z * (length / 2 - 0.8)]),
      )
  for (const x of [-0.6, 0.6])
    add(parts, look.headlight, cuboid([x, 0.75 * tall, -length / 2 - 0.01], [0.35, 0.15, 0.04]))
  return partsOf(parts)
}

/** A street lamp: a tapered post, its arm over the road (-X) and a glowing globe. */
function lamp(look: Materials) {
  const parts: Parts = new Map()
  add(
    parts,
    look.metal,
    lathe(
      [
        [0.13, 0],
        [0.09, 0.4],
        [0.07, 6.5],
        [0.05, 7],
      ],
      12,
    ),
  )
  add(parts, look.metal, cuboid([-0.9, 6.9, 0], [1.8, 0.1, 0.1]))
  add(parts, look.lamp, moved(icosphere(2), [-1.7, 6.55, 0], [0.28, 0.28, 0.28]))
  return partsOf(parts)
}

/** A tree: a trunk, and a lumpy crown of `leaves` — or, with `cards`, a crown of crossed cards
 *  that the `leaves` cutout draws. */
function tree(look: Materials, leaves: number, seed: number, cards = false) {
  const parts: Parts = new Map(),
    lumps = randomStream(seed)
  const phase = [lumps.uniform(0, TAU), lumps.uniform(0, TAU), lumps.uniform(0, TAU)]
  add(
    parts,
    look.bark,
    lathe(
      [
        [0.25, 0],
        [0.18, 2.5],
        [0.12, 4],
      ],
      10,
    ),
  )
  if (cards) {
    const card = fromGeometry(geometry.plane(4.8, 4.2))
    for (let k = 0; k < 4; k++)
      add(parts, leaves, moved(rotated(card, Y, k * QUARTER_PI + phase[0]), [0, 5.4, 0]))
    add(parts, leaves, moved(rotated(card, X, -HALF_PI), [0, 6.2, 0], [0.8, 1, 0.8]))
    return partsOf(parts)
  }
  const crown = icosphere(
    3,
    ([x, y, z]) =>
      1 +
      0.12 * Math.sin(5 * x + phase[0]) * Math.cos(4 * y + phase[1]) +
      0.08 * Math.sin(6 * z + phase[2]),
  )
  add(parts, leaves, moved(crown, [0, 5.2, 0], [2.4, 2.1, 2.4]))
  return partsOf(parts)
}

/** A bus shelter of glass on its frame, a bench inside. */
function shelter(look: Materials) {
  const parts: Parts = new Map()
  for (const z of [-2, 2])
    add(
      parts,
      look.metal,
      cuboid([0.7, 1.3, z], [0.08, 2.6, 0.08]),
      cuboid([-0.7, 1.3, z], [0.08, 2.6, 0.08]),
    )
  add(
    parts,
    look.metal,
    cuboid([0, 2.65, 0], [1.8, 0.08, 4.4]),
    cuboid([0.3, 0.45, 0], [0.5, 0.06, 3.6]),
  )
  add(
    parts,
    look.shop,
    cuboid([0.7, 1.4, 0], [0.03, 2.3, 3.9]),
    cuboid([0, 1.4, -2], [1.4, 2.3, 0.03]),
    cuboid([0, 1.4, 2], [1.4, 2.3, 0.03]),
  )
  return partsOf(parts)
}

/** The street from +30 to the lake: carriageway, kerbs, pavements, paint, grass beyond. */
function street(look: Materials) {
  const length = 30 - END,
    middle = (30 + END) / 2
  const parts: Parts = new Map()
  add(parts, look.asphalt, cuboid([0, -0.1, middle], [2 * ROAD, 0.2, length]))
  for (const side of [-1, 1]) {
    add(parts, look.kerb, cuboid([side * (ROAD + 0.15), 0.07, middle], [0.3, 0.14, length]))
    add(
      parts,
      look.pavement,
      cuboid(
        [side * (ROAD + 0.3 + (KERB - ROAD - 0.3) / 2), 0.06, middle],
        [KERB - ROAD - 0.3, 0.12, length],
      ),
    )
    add(parts, look.grass, cuboid([side * (KERB + 193), -0.05, middle], [386, 0.1, length]))
    add(parts, look.paint, cuboid([side * (ROAD - 0.6), 0.005, middle], [0.15, 0.01, length]))
  }
  for (let z = 25; z > END; z -= 12) add(parts, look.paint, cuboid([0, 0.005, z], [0.15, 0.01, 3]))
  for (let z = -150; z > END; z -= 300)
    for (let x = -ROAD + 1; x < ROAD; x += 1.2)
      add(parts, look.paint, cuboid([x, 0.006, z], [0.6, 0.01, 4]))
  // Puddles on the carriageway near the camera: mirrors of the sky and the lamps.
  const random = randomStream(17)
  for (let k = 0; k < 9; k++)
    add(
      parts,
      look.puddle,
      cuboid(
        [random.uniform(-ROAD + 1, ROAD - 1), 0.004, random.uniform(-60, 10)],
        [random.uniform(0.8, 2.4), 0.008, random.uniform(0.6, 1.8)],
      ),
    )
  return partsOf(parts)
}

/** A chain-link fence two metres high from `x0` to `x1` along z = `z`: one cutout sheet of
 *  half-metre tiles, a post every 2.5 metres. */
function fence(look: Materials, x0: number, x1: number, z: number) {
  const parts: Parts = new Map()
  add(parts, look.fence, moved(box(x1 - x0, 2, 0.01, 2), [(x0 + x1) / 2, 1, z]))
  for (let x = x0; x <= x1 + 1e-6; x += 2.5)
    add(parts, look.metal, rod([x, 0, z], [x, 2.1, z], 0.03))
  return partsOf(parts)
}

/** The tram's viaduct from `-reach` to `reach` on x, its deck at `deck`: a pier every thirty
 *  metres, railings (cutout), a catenary mast every forty-five metres and two contact wires
 *  sagging between them (thin), and a tunnel portal at each end where the tram waits unseen. */
function viaduct(look: Materials, reach: number, deck: number) {
  const parts: Parts = new Map(),
    concrete = look.facades[2]
  add(parts, concrete, cuboid([0, deck - 0.5, 0], [2 * reach, 1, 7]))
  for (let x = -reach + 15; x < reach; x += 30)
    add(parts, concrete, cuboid([x, deck / 2 - 0.9, 0], [2.4, deck - 0.2, 4]))
  for (const z of [-3.45, 3.45])
    add(parts, look.railing, moved(box(2 * reach, 1, 0.02, 1), [0, deck + 0.5, z]))
  for (const side of [-1, 1])
    add(parts, concrete, cuboid([side * (reach + 70), deck + 3, 0], [140, 8, 9]))
  const masts: number[] = []
  for (let x = -reach + 10; x < reach; x += 45) masts.push(x)
  for (const x of masts)
    add(
      parts,
      look.metal,
      rod([x, deck, -3.2], [x, deck + 6.5, -3.2], 0.1, 6),
      rod([x, deck + 6.2, -3.2], [x, deck + 6.2, 1.2], 0.05),
    )
  for (let k = 1; k < masts.length; k++)
    for (const z of [-0.8, 0.8])
      add(
        parts,
        look.cable,
        cable([masts[k - 1], deck + 5.9, z], [masts[k], deck + 5.9, z], 0.35, 0.012),
      )
  return partsOf(parts)
}

/** A Ferris wheel of `radius`, its hub `hub` high, on a pier: the stand; the wheel that turns
 *  about its hub, two rims of rods and their spokes; the cabin that hangs from each of its
 *  `cabins` pivots (`pivot(k)`, in the wheel's frame). */
function ferrisWheel(look: Materials, radius: number, hub: number, cabins: number) {
  const stand: Parts = new Map(),
    wheel: Parts = new Map(),
    cabin: Parts = new Map(),
    white = look.paints[1]
  add(stand, look.facades[2], cuboid([0, -0.5, 0], [40, 1.2, 20]))
  for (const z of [-3, 3])
    for (const x of [-1, 1]) add(stand, white, rod([x * hub * 0.45, 0, z * 2], [0, hub, z], 0.4, 6))
  add(stand, look.metal, rod([0, hub, -3.5], [0, hub, 3.5], 0.6, 8))
  const rim = (k: number, z: number): Vec3 => [
    snap(radius * Math.cos((TAU * k) / 48)),
    snap(radius * Math.sin((TAU * k) / 48)),
    z,
  ]
  for (const z of [-1.5, 1.5])
    for (let k = 0; k < 48; k++) {
      add(wheel, white, rod(rim(k, z), rim(k + 1, z), 0.2))
      if (k % 3 === 0) add(wheel, white, rod([0, 0, z * 0.4], rim(k, z), 0.08))
    }
  const pivot = (k: number) => rim((k * 48) / cabins, 0)
  for (let k = 0; k < cabins; k++) {
    const [x, y] = pivot(k)
    add(wheel, look.metal, rod([x, y, -1.6], [x, y, 1.6], 0.1))
  }
  add(cabin, look.paints[0], cuboid([0, -2.2, 0], [2.4, 2.2, 2.2]))
  add(cabin, look.windscreen, cuboid([0, -2, 0], [2.5, 1, 2.3]))
  add(cabin, look.metal, rod([0, 0, 0], [0, -1.1, 0], 0.05))
  return { stand: partsOf(stand), wheel: partsOf(wheel), cabin: partsOf(cabin), pivot }
}

/** A wind turbine `height` high: its tapered mast and nacelle, and its rotor of three blades
 *  `blade` long, which turns about +z. */
function turbine(look: Materials, height: number, blade: number) {
  const mast: Parts = new Map(),
    rotor: Parts = new Map(),
    white = look.paints[1]
  add(
    mast,
    white,
    lathe(
      [
        [2.2, 0],
        [1.2, height],
      ],
      12,
    ),
    cuboid([0, height + 1.5, -1.5], [3, 3, 9]),
  )
  const spar = cuboid([0, blade / 2 + 1, 0], [1.6, blade, 0.3])
  for (let k = 0; k < 3; k++) add(rotor, white, rotated(spar, Z, (k * TAU) / 3))
  add(rotor, white, moved(icosphere(1), [0, 0, 0.6], [1.6, 1.6, 2]))
  return { mast: partsOf(mast), rotor: partsOf(rotor) }
}

/** A flag three metres by two, hoisted along x = 0, its cloth showing the colour bars; and its
 *  two morph targets, the cloth waved by a sine and by a cosine along it, which weights of
 *  (cos ωt, -sin ωt) blend into a wave running to the fly. */
function flag() {
  const cloth = onTile(
    moved(fromGeometry(geometry.plane(3, 2, 15, 10)), [1.5, 0, 0]),
    TILES.colourBars,
  )
  const wave = (shift: number) =>
    cloth.positions.map((value, i) =>
      i % 3 === 2
        ? snap(0.12 * cloth.positions[i - 2] * Math.sin(Math.PI * cloth.positions[i - 2] + shift))
        : 0,
    )
  return { cloth, targets: [wave(0), wave(HALF_PI)] }
}

/** Keys every `step` seconds over the clip, `value(t)` flat at each. */
function keyed(step: number, value: (t: number) => readonly number[]) {
  const times = Array.from({ length: Math.round(PERIOD / step) + 1 }, (_, k) => k * step)
  return { times, values: times.flatMap(value) }
}

/** `turns` whole turns about `axis` over the clip from angle `phase`, a key every `step`
 *  seconds: a sixth of a turn apart at most, so each key goes the short way round. */
const spin = (axis: Vec3, phase: number, turns: number, step: number) =>
  keyed(step, (t) => turn(axis, phase + (TAU * turns * t) / PERIOD))

/** The district's HLOD, through the compiler's `hlod` option (`resolveHlod`): the four levels of
 *  the simple form — HLOD 0 the objects themselves, three merged levels above it, each baking the
 *  normal, roughness, metallic, specular and emissive images beside the base colour — in the expert
 *  form, so that each merged level also gets a distance field (`allowDistanceField`, off by default
 *  on a merged layer, as the reference's builder has it): the sun's distance-field shadow then
 *  reaches the merged levels past the last shadow map. No object carries a mark: every placed
 *  object enters the first layer, `hlod0`. What moves — the driving cars, the tram, the wheel, the
 *  rotors, the flags, the lift — is never placed in a cell, so it enters no HLOD. The last level is
 *  always loaded (`spatiallyLoaded: false`, on by choice here, streamed by default): the district is
 *  seen whole to the horizon, never cut at a loading range. */
type Layer = Record<string, unknown> & { builder?: string }
const { layers, default: fallback } = resolveHlod({ levels: 4 }) as {
  layers?: Layer[]
  default?: string
}
// An engine whose compiler writes the simple form out as its chain (`hlod/options/simple.rs`)
// gives it back as it is, without layers: the district keeps it, its merged levels without their
// distance field and its last level streamed, until its chain is written in the expert form.
export const DISTRICT_HLOD: HlodOptions = !layers
  ? { levels: 4 }
  : ({
      layers: layers.map((layer, i) => {
        const merged: Layer = {
          ...layer,
          ...(layer.builder === 'merge' ? { allowDistanceField: true } : {}),
        }
        if (i !== layers.length - 1) return merged
        // An always-loaded layer has no cells and no loading range: the compiler refuses them on it.
        const { cellSize: _cell, loadingRange: _range, ...always } = merged
        return { ...always, spatiallyLoaded: false }
      }),
      ...(fallback === undefined ? {} : { default: fallback }),
    } as HlodOptions)

/** Writes `district.gltf`, `district.bin` and the textures into `directory`. */
export async function writeDistrict(directory: string) {
  const gltf = new SceneGltf(),
    look = materials(gltf, await writeDistrictTextures(directory)),
    random = randomStream(2026),
    // What the bench adds draws from a stream of its own: the district's layout stays the one
    // its first stream gives.
    bench = randomStream(1527),
    motion: Channel[] = []
  const place = (mesh: number, x: number, y: number, z: number, angle = 0, name?: string) => {
    return gltf.node(
      {
        ...(name ? { name } : {}),
        mesh,
        translation: [x, y, z],
        ...(angle ? { rotation: yaw(angle) } : {}),
      },
      true,
    )
  }
  gltf.node({ name: 'street', mesh: gltf.mesh('street', street(look)) }, true)
  // Eight blocks of flats, placed again and again: low near the camera, taller down the street.
  const blocks = Array.from({ length: 8 }, (_, k) => {
    const width = 18 + (k % 4) * 4,
      depth = 16 + (k % 3) * 3
    const floors = 4 + k * 2,
      facade = look.facades[k % 5]
    return {
      width,
      depth,
      floors,
      facade,
      mesh: gltf.mesh(`block ${k}`, block(look, random, width, depth, floors, facade)),
    }
  })
  const towers = [30, 36, 42].map((width, k) => ({
    width,
    mesh: gltf.mesh(`tower ${k}`, tower(look, width, 40 + k * 15, { antenna: true })),
  }))
  // The landmarks: a plot of the street, by side and rank, holds a block of its own in place of
  // the model the stream picked, of its size: a unique bake among the repeated ones.
  const landmarks: Record<string, { name: string; features: BlockFeatures }> = {
    '-1 1': { name: 'courtyard block', features: { court: true, loggias: true, arcade: true } },
    '1 2': { name: 'glossy block', features: { glossy: true } },
    '-1 6': { name: 'sign block', features: { signs: true, arcade: true } },
    '1 9': { name: 'screened block', features: { screen: true } },
    '-1 22': { name: 'far courtyard block', features: { court: true, loggias: true } },
    '1 30': { name: 'far glossy block', features: { glossy: true, signs: true } },
  }
  const courtyards: [number, number][] = []
  for (const side of [-1, 1]) {
    for (let z = -10, plot = 0; z > -1250; plot++) {
      const reach = Math.min(7, Math.floor((-z / 1250) * 8 + random.uniform(-1, 1.5))),
        pick = blocks[Math.max(0, reach)],
        landmark = landmarks[`${side} ${plot}`]
      const [x, at] = [side * (KERB + 3 + pick.depth / 2), z - pick.width / 2]
      const { width, depth, floors, facade } = pick
      const mesh = landmark
        ? gltf.mesh(
            landmark.name,
            block(look, bench, width, depth, floors, facade, landmark.features),
          )
        : pick.mesh
      place(mesh, x, 0, at, HALF_PI)
      if (landmark?.features.court) courtyards.push([x, at])
      z -= pick.width + random.uniform(3, 9)
    }
    for (let z = -1270, plot = 0; z > END + 40; plot++) {
      const pick = towers[random.integer(towers.length)]
      // The third tower on the right wears glossy fins: a unique tower among the repeated ones.
      const mesh =
        side > 0 && plot === 2
          ? gltf.mesh('finned tower', tower(look, pick.width, 52, { antenna: true, fins: true }))
          : pick.mesh
      place(mesh, side * (KERB + 6 + pick.width / 2), 0, z - pick.width / 2)
      z -= pick.width + random.uniform(15, 40)
    }
  }
  // The far shore, past the lake: towers that the water mirrors, two kilometres away; the test
  // chart stands among them on the street's axis, facing the whole walk.
  const shore: [number, number, number][] = [[0, CHART_Z, CHART_WIDTH / 2 + 2]]
  for (let x = -350; x < 350; x += random.uniform(60, 110)) {
    const pick = towers[random.integer(towers.length)],
      z = -2300 - random.uniform(0, 120)
    if (Math.abs(x) <= CHART_WIDTH) continue
    place(pick.mesh, x, -0.3, z)
    shore.push([x, z, pick.width / 2])
  }
  const chart = gltf.mesh('test chart', tower(look, CHART_WIDTH, CHART_FLOORS, { chart: true }))
  place(chart, 0, -0.3, CHART_Z, 0, 'test chart')
  // The skyline: rows of the same towers behind the street's, and two more beyond the far shore
  // up to the wind farm, so repeated models fill the far field.
  for (const side of [-1, 1])
    for (const row of [90, 150, 210, 270])
      for (let z = -200 - bench.uniform(0, 60); z > END + 40; z -= bench.uniform(55, 95)) {
        const pick = towers[bench.integer(towers.length)]
        place(pick.mesh, side * (row + bench.uniform(-8, 8)), 0, z, bench.integer(4) * (TAU / 4))
      }
  for (const z of [-2520, -2600])
    for (let x = -430; x < 140; x += bench.uniform(45, 75)) {
      const pick = towers[bench.integer(towers.length)]
      place(pick.mesh, x, -0.3, z + bench.uniform(-15, 15))
    }
  gltf.node(
    {
      name: 'lake',
      mesh: gltf.mesh('lake', [[cuboid([0, -0.4, -2080], [900, 0.2, 560]), look.water]]),
    },
    true,
  )
  gltf.node(
    {
      name: 'far shore',
      mesh: gltf.mesh('far shore', [[cuboid([0, -0.35, -2500], [900, 0.3, 280]), look.grass]]),
    },
    true,
  )
  // The street furniture: lamps every thirty metres, trees between, a shelter near the camera.
  const lamps = gltf.mesh('lamp', lamp(look)),
    trees = [0, 1, 2].map((k) => gltf.mesh(`tree ${k}`, tree(look, look.leaves[k % 2], 40 + k)))
  for (const side of [-1, 1])
    for (let z = 0; z > END; z -= 30) {
      place(lamps, side * (ROAD + 0.8), 0.12, z, side > 0 ? 0 : Math.PI)
      place(trees[random.integer(3)], side * (ROAD + 3), 0.12, z - 15, random.uniform(0, TAU))
    }
  place(gltf.mesh('shelter', shelter(look)), ROAD + 3.2, 0.12, -22)
  // A cable across the street from lamp to lamp every sixty metres: thin, near and far.
  const span = gltf.mesh('cable span', [
    [cable([-ROAD + 0.1, 6.9, 0], [ROAD - 0.1, 6.9, 0], 0.6), look.cable],
  ])
  for (let z = -60; z > END; z -= 60) place(span, 0, 0, z)
  // Trees of leaf cards: in each courtyard, along the lakefront, on the far shore.
  const cardTree = gltf.mesh('card tree', tree(look, look.leafCards, 44, true))
  for (const [x, z] of courtyards) place(cardTree, x, 0, z, bench.uniform(0, TAU))
  for (const side of [-1, 1])
    for (let x = 70; x < 390; x += 12) place(cardTree, side * x, 0, -1790, bench.uniform(0, TAU))
  for (let x = -420; x < 420; x += 15) {
    const angle = bench.uniform(0, TAU),
      inside = shore.some(([sx, sz, half]) => Math.abs(x - sx) < half + 3 && sz + half + 3 > -2375)
    if (!inside) place(cardTree, x, -0.3, -2375, angle)
  }
  const lakeside = gltf.mesh('lakeside fence', [
    ...fence(look, -400, -KERB, -1797),
    ...fence(look, KERB, 400, -1797),
  ])
  place(lakeside, 0, 0, 0)
  // Cars: parked along the kerbs, and in both lanes, nose down the street or back up it. A car
  // in an inner lane drives — down the street, or up it past the camera — at one speed, and
  // comes round again from the other end out of sight.
  const cars = look.paints.map((paint, k) => gltf.mesh(`car ${k}`, car(look, paint)))
  for (let z = 5, k = 0; z > END + 20; z -= random.uniform(8, 40), k++) {
    const lane = [-ROAD + 1.2, -ROAD / 2 + 0.5, ROAD / 2 - 0.5, ROAD - 1.2][random.integer(4)]
    const driving = Math.abs(lane) < ROAD / 2,
      mesh = cars[random.integer(cars.length)],
      node = place(mesh, lane, 0, z, lane > 0 ? 0 : Math.PI, driving ? `driving car ${k}` : '')
    if (!driving) continue
    const [near, far] = [40, END + 20],
      down = lane > 0,
      reach = ((down ? z - far : near - z) / (near - far)) * PERIOD
    motion.push({
      node,
      path: 'translation',
      times: [0, reach, reach + 0.001, PERIOD],
      values: [z, down ? far : near, down ? near : far, z].flatMap((at) => [lane, 0, at]),
    })
  }
  // The tram: six carriages out of the west portal, across the viaduct into the east one, a
  // wait, and back.
  const VIADUCT = 470,
    DECK = 9,
    TRAM_Z = -1830,
    SCHEDULE = [0, 10, 50, 70, 110, PERIOD]
  place(gltf.mesh('viaduct', viaduct(look, VIADUCT, DECK)), 0, 0, TRAM_Z)
  const carriage = gltf.mesh(
    'tram carriage',
    car(look, look.paints[1], { length: 20, width: 2.6, cabin: 18.4, tall: 1.9 }),
  )
  for (let k = 0; k < 6; k++) {
    const [west, east] = [-VIADUCT - 10 - (5 - k) * 21, VIADUCT + 10 + k * 21]
    const node = place(carriage, west, DECK, TRAM_Z, -HALF_PI, `tram ${k}`)
    motion.push({
      node,
      path: 'translation',
      times: SCHEDULE,
      values: [west, west, east, east, west, west].flatMap((x) => [x, DECK, TRAM_Z]),
    })
  }
  // The Ferris wheel on its pier in the lake: a turn a clip, each cabin turned back as much, so
  // it hangs.
  const wheel = ferrisWheel(look, 28, 32, 12),
    [wheelX, wheelZ] = [-200, -1900]
  place(gltf.mesh('wheel stand', wheel.stand), wheelX, 0, wheelZ)
  const cabinMesh = gltf.mesh('wheel cabin', wheel.cabin),
    cabins = Array.from({ length: 12 }, (_, k) =>
      gltf.node({ name: `wheel cabin ${k}`, mesh: cabinMesh, translation: wheel.pivot(k) }),
    )
  const wheelNode = gltf.node(
    {
      name: 'ferris wheel',
      mesh: gltf.mesh('ferris wheel', wheel.wheel),
      translation: [wheelX, 32, wheelZ],
      children: cabins,
    },
    true,
  )
  motion.push({ node: wheelNode, path: 'rotation', ...spin(Z, 0, -1, 10) })
  for (const node of cabins) motion.push({ node, path: 'rotation', ...spin(Z, 0, 1, 10) })
  // Wind turbines on the far shore, twenty turns a clip, each rotor from an angle of its own.
  const turbines = turbine(look, 90, 38),
    mast = gltf.mesh('turbine', turbines.mast),
    rotor = gltf.mesh('turbine rotor', turbines.rotor)
  for (const [k, [x, z]] of [
    [200, -2520],
    [280, -2580],
    [360, -2510],
  ].entries()) {
    place(mast, x, -0.3, z)
    const node = gltf.node(
      { name: `turbine rotor ${k}`, mesh: rotor, translation: [x, 91.2, z + 3.5] },
      true,
    )
    motion.push({ node, path: 'rotation', ...spin(Z, k, 20, 1) })
  }
  // The chart's lift: up in forty seconds, a wait at the top, down, a wait at the foot.
  const liftZ = CHART_Z + CHART_WIDTH / 2 + 1.8,
    lift = place(gltf.mesh('lift cabin', liftCabin(look)), 0, 0.2, liftZ, 0, 'lift cabin')
  motion.push({
    node: lift,
    path: 'translation',
    times: SCHEDULE,
    values: [0.2, 0.2, 86, 86, 0.2, 0.2].flatMap((y) => [0, y, liftZ]),
  })
  // Flags: three on poles by the first plot, three on the chart's roof facing the street, a
  // wave every two seconds — bent by morph weights, the one motion no bake may hold still.
  const { cloth, targets } = flag(),
    flagMesh = gltf.morph('flag', cloth, look.signs, targets),
    pole = gltf.mesh('flagpole', [[flagpole(), look.metal]]),
    roof = CHART_FLOORS * 3.6 - 0.3
  const flags = [
    ...[-4, -8, -12].map((z) => ({ at: [-ROAD - 4.5, 0.12, z], angle: HALF_PI })),
    ...FLAG_POLES.map((x) => ({ at: [x, roof, CHART_Z + CHART_WIDTH / 2 - 1], angle: 0 })),
  ]
  flags.forEach(({ at: [x, y, z], angle }, k) => {
    if (angle) place(pole, x, y, z)
    const node = gltf.node(
      {
        name: `flag ${k}`,
        mesh: flagMesh,
        translation: [x, y + 10.8, z],
        ...(angle ? { rotation: yaw(angle) } : {}),
      },
      true,
    )
    motion.push({
      node,
      path: 'weights',
      ...keyed(0.25, (t) => {
        const phase = Math.PI * t + k
        return [snap(Math.cos(phase)), snap(-Math.sin(phase))]
      }),
    })
  })
  gltf.animation('district motion', motion)
  await gltf.write(directory, 'district')
}
