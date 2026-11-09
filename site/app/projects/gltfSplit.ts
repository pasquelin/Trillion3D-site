/** A written glTF cut into models of their own: the nodes a model takes, with only the meshes,
 *  materials, textures, accessors and clips they read, as one binary glTF (`.glb`) each. Bytes
 *  only, no host API: the page cuts an example's source as a script does. */
import { concat, encodeText, littleEndian } from './bytes.ts'

/** The two chunks of the binary glTF `bytes`: its document, and its buffer (empty when none). */
export function readGlb(bytes: Uint8Array): { gltf: Gltf; bin: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a binary glTF')
  const jsonLength = view.getUint32(12, true),
    gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as Gltf,
    at = 20 + jsonLength
  const bin =
    at + 8 <= bytes.length
      ? bytes.subarray(at + 8, at + 8 + view.getUint32(at, true))
      : new Uint8Array(0)
  return { gltf, bin }
}

type Json = Record<string, unknown>

/** The parts of a glTF document the cut reads, each table optional as the format has it. */
export interface Gltf {
  asset: Json
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: Node[]
  meshes?: Json[]
  materials?: Json[]
  textures?: { sampler?: number; source?: number }[]
  images?: { uri?: string; mimeType?: string; bufferView?: number; name?: string }[]
  samplers?: Json[]
  accessors?: (Json & { bufferView?: number })[]
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; target?: number }[]
  buffers?: { uri?: string; byteLength: number }[]
  animations?: Animation[]
  extensionsUsed?: string[]
  extensionsRequired?: string[]
  extensions?: Json
}

export interface Node {
  name?: string
  mesh?: number
  children?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
  matrix?: number[]
  weights?: number[]
  extras?: unknown
  extensions?: Json
}

interface Animation {
  name?: string
  channels: { sampler: number; target: { node?: number; path: string } }[]
  samplers: { input: number; output: number; interpolation?: string }[]
}

/** A glTF and the bytes it names: each buffer's, each image's. */
export interface Source {
  gltf: Gltf
  buffers: Uint8Array[]
  images: { bytes: Uint8Array; mimeType: string }[]
}

/** Reads the bytes of a file of the glTF's folder, by its path there. */
export type ReadFile = (path: string) => Promise<Uint8Array>

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

/** Reads the `.gltf` `name` and the buffers and images it names beside it, through `read`. */
export async function readGltf(name: string, read: ReadFile): Promise<Source> {
  const gltf = JSON.parse(new TextDecoder().decode(await read(name))) as Gltf,
    at = (uri: string) => read(decodeURIComponent(uri))
  const buffers = await Promise.all(
    (gltf.buffers ?? []).map(({ uri }) => {
      if (!uri) throw new Error(`${name}: a buffer with no file`)
      return at(uri)
    }),
  )
  const images = await Promise.all(
    (gltf.images ?? []).map(async (image) => {
      if (image.uri) {
        const kind = image.uri.slice(image.uri.lastIndexOf('.') + 1).toLowerCase()
        return { bytes: await at(image.uri), mimeType: image.mimeType ?? MIME[kind] ?? 'image/png' }
      }
      if (image.bufferView === undefined) throw new Error(`${name}: an image with no bytes`)
      return { bytes: viewBytes(gltf, buffers, image.bufferView), mimeType: image.mimeType! }
    }),
  )
  return { gltf, buffers, images }
}

function viewBytes(gltf: Gltf, buffers: Uint8Array[], view: number) {
  const { buffer, byteOffset = 0, byteLength } = gltf.bufferViews![view]
  return buffers[buffer].subarray(byteOffset, byteOffset + byteLength)
}

/** The nodes under `roots`, them included, depth first. */
export function subtree(gltf: Gltf, roots: readonly number[]): number[] {
  const out: number[] = []
  const visit = (node: number) => {
    out.push(node)
    for (const child of gltf.nodes[node].children ?? []) visit(child)
  }
  for (const root of roots) visit(root)
  return out
}

/** The node every channel of every clip of `gltf` moves. */
export const animatedNodes = (gltf: Gltf) =>
  new Set(
    (gltf.animations ?? []).flatMap(({ channels }) =>
      channels.flatMap(({ target }) => (target.node === undefined ? [] : [target.node])),
    ),
  )

/** What a model holds: its scene's root nodes, as they are or each with its own placement
 *  replaced (`placed`), and the clips of `source` that move them. */
export interface Cut {
  roots: { node: number; placed?: Node }[]
  animations?: boolean
}

/** The binary glTF of `cut` out of `source`: only what its nodes read, renumbered, its images
 *  and data in its one buffer. */
export function glbOf(source: Source, cut: Cut): Uint8Array {
  const { gltf } = source,
    chunks: Uint8Array[] = []
  let length = 0
  const out: Required<Pick<Gltf, 'nodes' | 'accessors' | 'bufferViews'>> & Gltf = {
    asset: { ...gltf.asset },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    accessors: [],
    bufferViews: [],
  }
  /** Appends `bytes` to the buffer, four-byte aligned, as a view of its own. */
  const view = (bytes: Uint8Array, target?: number) => {
    const padding = (4 - (length % 4)) % 4
    if (padding) chunks.push(new Uint8Array(padding))
    length += padding
    out.bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: bytes.length,
      ...(target === undefined ? {} : { target }),
    })
    chunks.push(bytes)
    length += bytes.length
    return out.bufferViews.length - 1
  }
  const once = <T>(table: Map<number, number>, index: number, add: () => T, list: T[]) => {
    const known = table.get(index)
    if (known !== undefined) return known
    list.push(add())
    table.set(index, list.length - 1)
    return list.length - 1
  }
  const [views, accessors, images, samplers, textures, materials, meshes] = Array.from(
    { length: 7 },
    () => new Map<number, number>(),
  )
  const outImages: NonNullable<Gltf['images']> = [],
    outSamplers: Json[] = [],
    outTextures: NonNullable<Gltf['textures']> = [],
    outMaterials: Json[] = [],
    outMeshes: Json[] = []
  const bufferView = (index: number) => {
    const known = views.get(index)
    if (known !== undefined) return known
    const added = view(viewBytes(gltf, source.buffers, index), gltf.bufferViews![index].target)
    views.set(index, added)
    return added
  }
  const accessor = (index: number) =>
    once(
      accessors,
      index,
      () => {
        const { bufferView: from, ...rest } = gltf.accessors![index]
        return from === undefined ? rest : { ...rest, bufferView: bufferView(from) }
      },
      out.accessors,
    )
  const image = (index: number) =>
    once(
      images,
      index,
      () => {
        const { bytes, mimeType } = source.images[index],
          name = gltf.images![index].name ?? gltf.images![index].uri?.replace(/^.*\/|\.[^.]*$/g, '')
        const image: NonNullable<Gltf['images']>[number] = { bufferView: view(bytes), mimeType }
        return name ? { name, ...image } : image
      },
      outImages,
    )
  const sampler = (index: number) =>
    once(samplers, index, () => ({ ...gltf.samplers![index] }), outSamplers)
  const texture = (index: number) =>
    once(
      textures,
      index,
      () => {
        const { sampler: s, source: i, ...rest } = gltf.textures![index]
        return {
          ...rest,
          ...(s === undefined ? {} : { sampler: sampler(s) }),
          ...(i === undefined ? {} : { source: image(i) }),
        }
      },
      outTextures,
    )
  /** `value` with every texture reference (`{ index }` under a key ending in `Texture`) renumbered. */
  const retexture = (value: unknown, key = ''): unknown => {
    if (Array.isArray(value)) return value.map((item) => retexture(item))
    if (value === null || typeof value !== 'object') return value
    const object = value as Json
    const copy = Object.fromEntries(Object.entries(object).map(([k, v]) => [k, retexture(v, k)]))
    if (key.endsWith('Texture') && typeof object.index === 'number')
      copy.index = texture(object.index)
    return copy
  }
  const material = (index: number) =>
    once(materials, index, () => retexture(gltf.materials![index]) as Json, outMaterials)
  const renumber = (attributes: Record<string, number>) =>
    Object.fromEntries(Object.entries(attributes).map(([k, v]) => [k, accessor(v)]))
  const mesh = (index: number) =>
    once(
      meshes,
      index,
      () => {
        const { primitives, ...rest } = gltf.meshes![index] as Json & { primitives: Json[] }
        return {
          ...rest,
          primitives: primitives.map(({ attributes, indices, material: m, targets, ...p }) => ({
            ...p,
            attributes: renumber(attributes as Record<string, number>),
            ...(indices === undefined ? {} : { indices: accessor(indices as number) }),
            ...(m === undefined ? {} : { material: material(m as number) }),
            ...(targets === undefined
              ? {}
              : { targets: (targets as Record<string, number>[]).map(renumber) }),
          })),
        }
      },
      outMeshes,
    )
  // The nodes: every one under the roots, numbered in that order, children after their parent.
  const roots = cut.roots.map(({ node }) => node),
    kept = subtree(gltf, roots),
    number = new Map(kept.map((node, k) => [node, k])),
    placed = new Map(cut.roots.map(({ node, placed }) => [node, placed]))
  for (const index of kept) {
    const { mesh: m, children, translation, rotation, scale, matrix, ...rest } = gltf.nodes[index]
    const pose = placed.get(index) ?? { translation, rotation, scale, matrix }
    out.nodes.push({
      ...rest,
      ...(m === undefined ? {} : { mesh: mesh(m) }),
      ...(children?.length ? { children: children.map((child) => number.get(child)!) } : {}),
      ...Object.fromEntries(Object.entries(pose).filter(([, v]) => v !== undefined)),
    })
  }
  out.scenes[0].nodes = roots.map((node) => number.get(node)!)
  if (cut.animations) {
    const animations = (gltf.animations ?? []).flatMap(({ channels, samplers: from, ...rest }) => {
      const moving = channels.filter(({ target }) => number.has(target.node!))
      if (!moving.length) return []
      const used = [...new Set(moving.map(({ sampler: s }) => s))]
      return [
        {
          ...rest,
          channels: moving.map(({ sampler: s, target }) => ({
            sampler: used.indexOf(s),
            target: { ...target, node: number.get(target.node!)! },
          })),
          samplers: used.map((s) => ({
            ...from[s],
            input: accessor(from[s].input),
            output: accessor(from[s].output),
          })),
        },
      ]
    })
    if (animations.length) out.animations = animations
  }
  if (outMeshes.length) out.meshes = outMeshes
  if (outMaterials.length) out.materials = outMaterials
  if (outTextures.length) out.textures = outTextures
  if (outImages.length) out.images = outImages
  if (outSamplers.length) out.samplers = outSamplers
  // The extensions the kept materials and meshes name, required as the source required them.
  const named = new Set<string>()
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(collect)
    if (value === null || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value)) {
      if (key === 'extensions' && v && typeof v === 'object')
        Object.keys(v).forEach((name) => named.add(name))
      collect(v)
    }
  }
  collect([outMaterials, outMeshes, out.nodes])
  const used = (gltf.extensionsUsed ?? []).filter((name) => named.has(name)),
    required = (gltf.extensionsRequired ?? []).filter((name) => named.has(name))
  if (used.length) out.extensionsUsed = used
  if (required.length) out.extensionsRequired = required
  const bin = concat(chunks)
  out.buffers = [{ byteLength: bin.length }]
  return glb(out, bin)
}

/** The binary glTF of `json` and `bin`: its header, its JSON chunk padded with spaces, its
 *  binary chunk with zeros, none when `bin` is empty. */
export function glb(json: object, bin: Uint8Array): Uint8Array {
  const pad = (bytes: Uint8Array, fill: number) =>
    concat([bytes, new Uint8Array((4 - (bytes.length % 4)) % 4).fill(fill)])
  const text = pad(encodeText(JSON.stringify(json)), 0x20),
    data = pad(bin, 0),
    binary = data.length ? [littleEndian([data.length, 4], [0x004e4942, 4]), data] : []
  const length = 12 + 8 + text.length + (data.length ? 8 + data.length : 0)
  return concat([
    littleEndian([0x46546c67, 4], [2, 4], [length, 4]),
    littleEndian([text.length, 4], [0x4e4f534a, 4]),
    text,
    ...binary,
  ])
}
