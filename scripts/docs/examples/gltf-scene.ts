import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { bufferPacker } from './gltf.ts'
import type {
  GltfAnimation,
  GltfDocument,
  GltfMaterial,
  GltfNode,
  Primitive,
} from './gltf-types.ts'
import { snapped, type Mesh } from './mesh.ts'
import { snap } from './random.ts'
import { axisAngleQuaternion } from '#engine/packages/math/src/quaternion/quaternion.ts'

type Colour = readonly [number, number, number]

/** One animated property of a node: its keys' `times` and flat `values` (`SceneGltf.animation`). */
export interface Channel {
  node: number
  path: 'translation' | 'rotation' | 'scale' | 'weights'
  times: readonly number[]
  values: readonly number[]
}

/**
 * A glTF scene written from nothing, for the scenes modelled in code: materials, meshes and
 * nodes are added in order and numbered as they come, every buffer in one `.bin` beside the
 * `.gltf`. The file names no machine and no date, so the same scene writes the same bytes.
 */
export class SceneGltf {
  readonly document: GltfDocument
  private readonly pack = bufferPacker(0)

  constructor() {
    this.document = {
      asset: { version: '2.0', generator: 'Trillion3D example writer', copyright: 'CC0 1.0' },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      materials: [],
      buffers: [],
      bufferViews: this.pack.views,
      accessors: this.pack.accessors,
    }
  }

  /** A metal–roughness material; `texture` and `normalTexture` are image paths beside the file.
   *  `emissive` glows by itself; `transmission` lets that share of the background through
   *  (`KHR_materials_transmission`), a glass; `cutout` keeps only the texels whose alpha reaches
   *  it (`alphaMode: MASK`), seen from both sides: a leaf, a mesh fence, a perforated sheet. */
  material(
    name: string,
    colour: Colour,
    {
      roughness = 0.6,
      metallic = 0,
      texture,
      normalTexture,
      emissive,
      transmission,
      cutout,
    }: {
      roughness?: number
      metallic?: number
      texture?: string
      normalTexture?: string
      emissive?: Colour
      transmission?: number
      cutout?: number
    } = {},
  ) {
    const material: GltfMaterial = {
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...colour, 1],
        metallicFactor: metallic,
        roughnessFactor: roughness,
        ...(texture ? { baseColorTexture: { index: this.texture(texture) } } : {}),
      },
      ...(normalTexture ? { normalTexture: { index: this.texture(normalTexture), scale: 1 } } : {}),
      ...(emissive ? { emissiveFactor: emissive } : {}),
      ...(cutout ? { alphaMode: 'MASK', alphaCutoff: cutout, doubleSided: true } : {}),
    }
    if (transmission) {
      const used = (this.document.extensionsUsed ??= [])
      if (!used.includes('KHR_materials_transmission')) used.push('KHR_materials_transmission')
      material.extensions = { KHR_materials_transmission: { transmissionFactor: transmission } }
    }
    return this.document.materials.push(material) - 1
  }

  /** The texture of image `uri`, added once with the one repeating, mip-mapped sampler. */
  private texture(uri: string) {
    const images = (this.document.images ??= []),
      textures = (this.document.textures ??= [])
    this.document.samplers ??= [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]
    const known = images.findIndex((image) => image.uri === uri)
    if (known >= 0) return textures.findIndex(({ source }) => source === known)
    images.push({ uri })
    return textures.push({ sampler: 0, source: images.length - 1 }) - 1
  }

  /** The accessors of `mesh`, snapped to the grid, as one primitive drawn with `material`. */
  primitive(mesh: Mesh, material: number): Primitive {
    return this.pack.primitive(snapped(mesh), material)
  }

  /** A mesh of one primitive per part: a `Mesh` with its material, or a packed primitive. */
  mesh(name: string, parts: readonly (readonly [Mesh, number] | Primitive)[]) {
    const primitives = parts.map((part) =>
      'attributes' in part ? part : this.primitive(part[0], part[1]),
    )
    return this.document.meshes.push({ name, primitives }) - 1
  }

  /** A mesh of one primitive that bends: `mesh` drawn with `material`, displaced by each of
   *  `targets` (flat position offsets, one list a target) as far as the node's weights say. */
  morph(name: string, mesh: Mesh, material: number, targets: readonly (readonly number[])[]) {
    const primitive = this.primitive(mesh, material)
    primitive.targets = targets.map((offsets) => ({ POSITION: this.pack.accessor(offsets, 3) }))
    return (
      this.document.meshes.push({ name, primitives: [primitive], weights: targets.map(() => 0) }) -
      1
    )
  }

  /**
   * An animation of `channels`, each keying one node's translation, rotation, scale or morph
   * weights at `times` (seconds), `values` flat, one key after the other, linear between keys.
   * Channels keyed at the same times share one accessor of them.
   */
  animation(name: string, channels: readonly Channel[]) {
    const times = new Map<string, number>(),
      samplers: GltfAnimation['samplers'] = []
    const input = (keys: readonly number[]) => {
      const known = times.get(keys.join())
      if (known !== undefined) return known
      const index = this.pack.accessor(keys, 1, 'key')
      times.set(keys.join(), index)
      return index
    }
    const keyed = channels.map(({ node, path, times: keys, values }) => {
      const size = path === 'rotation' ? 4 : path === 'weights' ? 1 : 3
      samplers.push({
        input: input(keys),
        output: this.pack.accessor(values, size, 'key'),
        interpolation: 'LINEAR',
      })
      return { sampler: samplers.length - 1, target: { node, path } }
    })
    ;(this.document.animations ??= []).push({ name, channels: keyed, samplers })
  }

  /** A node; a root one is listed in the scene, a child only in its parent's `children`. */
  node(node: GltfNode, root = false) {
    const index = this.document.nodes.push(node) - 1
    if (root) this.document.scenes[0].nodes.push(index)
    return index
  }

  /**
   * A node drawing `mesh` once per pose (`EXT_mesh_gpu_instancing`): flat translations, rotation
   * quaternions and scales, three, four and three values a pose. The file holds the mesh once and
   * the poses as three accessors; the compiler expands each pose into a node of its own.
   */
  instances(
    name: string,
    mesh: number,
    translations: number[],
    rotations: number[],
    scales: number[],
    root = false,
  ) {
    const used = (this.document.extensionsUsed ??= [])
    if (!used.includes('EXT_mesh_gpu_instancing')) used.push('EXT_mesh_gpu_instancing')
    const attributes = {
      TRANSLATION: this.pack.accessor(translations, 3, 'instance'),
      ROTATION: this.pack.accessor(rotations, 4, 'instance'),
      SCALE: this.pack.accessor(scales, 3, 'instance'),
    }
    return this.node({ name, mesh, extensions: { EXT_mesh_gpu_instancing: { attributes } } }, root)
  }

  /** Writes `<name>.gltf` and `<name>.bin` into `directory`. */
  async write(directory: string, name: string) {
    await mkdir(directory, { recursive: true })
    this.document.buffers = [{ uri: `${name}.bin`, byteLength: this.pack.byteLength() }]
    await writeFile(resolve(directory, `${name}.bin`), Buffer.concat(this.pack.chunks))
    await writeFile(resolve(directory, `${name}.gltf`), JSON.stringify(this.document))
  }
}

/** A turn of `angle` radians about the unit `axis`, as the quaternion a node's `rotation` takes,
 *  rounded. */
export const turn = (axis: readonly [number, number, number], angle: number) =>
  Array.from(
    axisAngleQuaternion(new Float64Array(4), axis, angle),
    (value) => Math.round(snap(value) * 1e6) / 1e6,
  )

/** A turn of `angle` radians about +Y. */
export const yaw = (angle: number) => turn([0, 1, 0], angle)
