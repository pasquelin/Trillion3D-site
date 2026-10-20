import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TAU } from '#engine/packages/math/src/constants.ts'
import { length2 } from '#engine/packages/math/src/vector/vector.ts'
import { randomStream, snap } from './random.ts'
import { fillPolygon, fillRect, normalMap, png, raster, shrink, type Raster } from './raster.ts'

/**
 * The district's images, each a case a baked distant level must prefilter: an atlas of signs at
 * every frequency — checkers, stripes, a zone plate, colour bars, lettering — whose tiles meet at
 * seams of opposite colours; three cutouts whose coverage must survive the mips — a perforated
 * sheet, a chain-link fence, a railing — and a card of leaves; and the relief of a ribbed metal
 * panel, whose normals turn to roughness far away. Drawn at twice their size, then brought down.
 */

/** The atlas is `SIGN_TILES` tiles a side; `signTile(k)` is the (u, v) rectangle of tile `k`. */
const SIGN_TILES = 4
export const signTile = (k: number) => {
  const [column, row] = [k % SIGN_TILES, Math.floor(k / SIGN_TILES) % SIGN_TILES]
  return [column / SIGN_TILES, row / SIGN_TILES, 1 / SIGN_TILES] as const
}
/** Tiles by content: what a sign, a billboard or a flag shows. */
export const TILES = {
  checkers: [0, 1, 2, 3],
  stripes: [4, 5, 6, 7],
  zonePlate: 8,
  colourBars: 9,
  lettering: [10, 11, 12, 13],
  target: 14,
  grid: 15,
}

/** Paints each pixel of the square `size` at `(x0, y0)` with `colour(u, v)`, u and v in 0–1. */
function field(
  image: Raster,
  [x0, y0, size]: readonly number[],
  colour: (u: number, v: number) => readonly number[],
) {
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const value = colour((x + 0.5) / size, (y + 0.5) / size),
        at = ((y0 + y) * image.size + x0 + x) * image.channels
      for (let k = 0; k < image.channels; k++) image.data[at + k] = value[k]
    }
}

const WHITE = [240, 240, 236],
  BLACK = [12, 12, 14],
  BARS = [
    [235, 235, 235],
    [235, 225, 30],
    [30, 220, 230],
    [30, 200, 40],
    [220, 40, 220],
    [225, 30, 30],
    [30, 40, 220],
  ],
  SIGNS = [
    [180, 24, 30],
    [20, 70, 160],
    [20, 120, 60],
    [230, 150, 20],
  ]

/** The sign atlas: sixteen tiles, each framed in a border of its own colour. */
function signs() {
  const drawn = 1024,
    tile = drawn / SIGN_TILES,
    image = raster(drawn, BLACK),
    random = randomStream(81)
  const square = (k: number) => [(k % SIGN_TILES) * tile, Math.floor(k / SIGN_TILES) * tile, tile]
  // Checkers of 4, 8, 16 and 32 squares a side.
  TILES.checkers.forEach((k, n) =>
    field(image, square(k), (u, v) =>
      (Math.floor(u * 4 * 2 ** n) + Math.floor(v * 4 * 2 ** n)) % 2 ? WHITE : BLACK,
    ),
  )
  // Stripes: vertical, horizontal, diagonal, then fine vertical ones.
  const stripes = [
    (u: number) => u * 8,
    (_: number, v: number) => v * 8,
    (u: number, v: number) => (u + v) * 8,
    (u: number) => u * 32,
  ]
  TILES.stripes.forEach((k, n) =>
    field(image, square(k), (u, v) => (Math.floor(stripes[n](u, v)) % 2 ? SIGNS[n] : WHITE)),
  )
  // A zone plate: rings whose frequency grows with the radius, every frequency in one tile.
  field(image, square(TILES.zonePlate), (u, v) => {
    const r2 = (u - 0.5) ** 2 + (v - 0.5) ** 2,
      level = 0.5 + 0.5 * Math.cos(snap(TAU * 64 * r2))
    return WHITE.map((c, i) => BLACK[i] + (c - BLACK[i]) * snap(level))
  })
  field(image, square(TILES.colourBars), (u) => BARS[Math.floor(u * BARS.length)])
  // Lettering: rows of blocky glyphs, white on a sign's colour.
  TILES.lettering.forEach((k, n) => {
    const [x0, y0] = square(k)
    fillRect(image, [x0, y0, x0 + tile - 1, y0 + tile - 1], SIGNS[n])
    for (let row = 0; row < 3; row++)
      for (let glyph = 0; glyph < 6; glyph++)
        for (let cell = 0; cell < 15; cell++)
          if (random.next() < 0.55) {
            const [gx, gy] = [x0 + 20 + glyph * 37 + (cell % 3) * 10, y0 + 30 + row * 70]
            const cy = gy + Math.floor(cell / 3) * 10
            fillRect(image, [gx, cy, gx + 8, cy + 8], WHITE)
          }
  })
  // A target: rings of constant width round a cross, for the eye to centre on.
  field(image, square(TILES.target), (u, v) => {
    const r = length2(u - 0.5, v - 0.5)
    if (Math.abs(u - 0.5) < 0.01 || Math.abs(v - 0.5) < 0.01) return SIGNS[0]
    return Math.floor(snap(r) * 16) % 2 ? WHITE : BLACK
  })
  // A grid of one-pixel lines (two drawn, one after the shrink) every eighth of the tile.
  field(image, square(TILES.grid), (u, v) =>
    (u * 8) % 1 < 0.02 || (v * 8) % 1 < 0.02 ? BLACK : WHITE,
  )
  // Each tile's border in a colour of its own: a seam bleeds it into its neighbour.
  for (let k = 0; k < SIGN_TILES ** 2; k++) {
    const [x0, y0] = square(k),
      colour = BARS[k % BARS.length]
    for (const rect of [
      [x0, y0, x0 + tile - 1, y0 + 7],
      [x0, y0 + tile - 8, x0 + tile - 1, y0 + tile - 1],
      [x0, y0, x0 + 7, y0 + tile - 1],
      [x0 + tile - 8, y0, x0 + tile - 1, y0 + tile - 1],
    ])
      fillRect(image, rect, colour)
  }
  return shrink(image, 2)
}

/** A cutout tile: `opaque(u, v)` says where the material is; the colour is grey metal. */
function cutout(
  drawn: number,
  opaque: (u: number, v: number) => boolean,
  colour = [190, 192, 196],
) {
  const image = raster(drawn, [...colour, 0])
  field(image, [0, 0, drawn], (u, v) => [...colour, opaque(u, v) ? 255 : 0])
  return shrink(image, 2)
}

/** Eight by eight round holes, half the sheet open. */
const perforated = () =>
  cutout(256, (u, v) => length2(((u * 8) % 1) - 0.5, ((v * 8) % 1) - 0.5) > 0.38)

/** Chain link: wires along both diagonals, eight of each a tile. */
const fence = () =>
  cutout(256, (u, v) => {
    const a = (u + v) * 8,
      b = (u - v + 1) * 8
    return Math.abs((a % 1) - 0.5) > 0.42 || Math.abs((b % 1) - 0.5) > 0.42
  })

/** A railing: a rail along the top and the bottom, a bar every eighth of the tile. */
const railing = () =>
  cutout(256, (u, v) => v < 0.08 || v > 0.9 || Math.abs(((u * 8) % 1) - 0.5) < 0.09, [40, 40, 44])

/** A card of leaves: a branch and two hundred leaves, ellipses in five greens, the rest clear. */
function leaves() {
  const drawn = 512,
    image = raster(drawn, [60, 80, 30, 0]),
    random = randomStream(83),
    greens = [
      [52, 92, 34],
      [70, 118, 40],
      [40, 74, 30],
      [96, 132, 52],
      [62, 100, 28],
    ]
  fillPolygon(
    image,
    [
      [250, 512],
      [262, 512],
      [262, 120],
      [250, 120],
    ],
    [76, 56, 38, 255],
  )
  for (let k = 0; k < 200; k++) {
    const angle = random.uniform(0, TAU),
      radius = Math.sqrt(random.next()) * 210,
      [cx, cy] = [256 + Math.cos(angle) * radius, 236 + Math.sin(angle) * radius * 0.9],
      turn = random.uniform(0, TAU),
      colour = [...greens[random.integer(greens.length)], 255]
    const points = Array.from({ length: 10 }, (_, i): [number, number] => {
      const t = (i / 10) * TAU,
        [x, y] = [Math.cos(t) * 26, Math.sin(t) * 11]
      return [
        snap(cx + x * Math.cos(turn) - y * Math.sin(turn)),
        snap(cy + x * Math.sin(turn) + y * Math.cos(turn)),
      ]
    })
    fillPolygon(image, points, colour)
  }
  return shrink(image, 2)
}

/** Ribs: eight rounded ridges across the tile, as a relief map. */
function ribs() {
  const height = raster(128, [0])
  field(height, [0, 0, 128], (u) => [snap(Math.abs(Math.sin(u * 4 * TAU)))])
  return normalMap(height, 3)
}

/** Writes the district's images under `directory/textures/`; returns their paths from it. */
export async function writeDistrictTextures(directory: string) {
  await mkdir(resolve(directory, 'textures'), { recursive: true })
  const images = {
    signs: signs(),
    perforated: perforated(),
    fence: fence(),
    railing: railing(),
    leaves: leaves(),
    ribs: ribs(),
  }
  for (const [name, image] of Object.entries(images))
    await writeFile(resolve(directory, `textures/${name}.png`), png(image))
  return Object.fromEntries(
    Object.keys(images).map((name) => [name, `textures/${name}.png`]),
  ) as Record<keyof typeof images, string>
}
