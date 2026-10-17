# Example assets: provenance and credits

Every scene under this folder is compiled by the repository's native compiler from the sources
beside it (`scripts/docs/examples-assets.ts`). Every example built from primitives alone is now
written in code, with `geometry.*`, directly in its `site/examples/*.html` page: it compiles
nothing here and owns no folder under this directory.

The models under `models/` are kept as imported — mesh, textures and, when the author ships one,
the licence file — and never edited. An OBJ model enters a scene as a copy whose `v` lines alone
are scaled to metres and moved into place (`scripts/docs/examples/obj.ts`, `placeObj`), beside an
original setting written as boxes; a glTF model enters as-is, the setting appended to a copy of
its scene file as one more node (`scripts/docs/examples/gltf.ts`, `appendSurfacesGltf`).

| Model | Folder | Author | Source and licence | Used by |
| --- | --- | --- | --- | --- |
| Marble Bust 01 | `models/marble-bust/` | Rico Cilliers | [Poly Haven](https://polyhaven.com/a/marble_bust_01), CC0, 1k textures | `bust` |
| Street lamp | `models/lantern/` | W. Sitters | [Elements-3D](https://github.com/pasquelin/Elements-3D), CC BY 3.0 or GPL v2+ | `street-corner` (scale 0.033) |
| Crate | `models/crate/` | W. Sitters | [Elements-3D](https://github.com/pasquelin/Elements-3D), CC BY 3.0 or GPL v2+ | `crates` (scale 0.01, three copies) |

Poly Haven publishes its models under [CC0](https://creativecommons.org/publicdomain/zero/1.0/):
no attribution is required, and the example pages credit the author anyway. W. Sitters' models
come from the asset bank Elements-3D, which redistributes them under their authors' own licences;
they are dual-licensed and this repository uses them under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), whose text ships in each folder as
`CC_attribution_licence.txt`, with the author's `Readme.txt`; each example page that shows one of
them credits the author. Nothing else of that bank was taken: the items without a documented
source, and its `imagerie/` sheets, are not redistributable; the `jeep` by Psionic ships only in
formats the compiler does not read (`.3ds`, `.ms3d`).

The streaming and memory examples reuse `site/assets/gallery/signature-architecture/`, an original
scene of the lessons.

## Scenes modelled in code

Eleven scenes are modelled in code for their example and released under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/): nothing in them was taken from another
work. Each has a writer under `scripts/docs/examples/`, seeded so the same code writes the same
bytes on every machine, and is rebuilt, source and cache, by
`node scripts/docs/examples-assets.ts <folder>` with the same compiler arguments as the model
scenes above (`full`, 2 threads, 256 MB, `qem-endpoints`, the default `bc7` texture family).

| Folder | Writer | Source |
| --- | --- | --- |
| `a-model-from-obj/` | `chess-obj.ts` | `chess.obj` and `chess.mtl`: the same board and turned pieces in metres, each piece written where it stands, on a table |
| `a-model-from-usdz/` | `chess-set.ts` | `chess-set.usdz`: one USD text layer in centimetres, six turned shapes instanced thirty-two times |
| `compressed-textures/` | `courtyard.ts` | `courtyard.gltf` and its five drawn images: glazed tiles, brick, marble, the tiles' and brick's relief |
| `detail-by-pixel-error/` | `avenue.ts` | `avenue.gltf`: an avenue of fluted urns and a bronze knot at a tenth of life size |
| `ten-thousand-objects/` | `ring.ts` | `ring.gltf`: a planet and ten thousand moonlets, four rock shapes in three stones placed ten thousand times |
| `terrain/` | `terrain.ts` | `terrain.gltf`: a valley on a regular two-metre grid and three boulders |
| `terrain-tiles/` | `terrain-tiles.ts` | `terrain-tiles.gltf` and `ground.png`: a textured terrain of three by three tiles, each a mesh and a node of its own |
| `flag/` | `flag.ts` | `flag.gltf`: a flag on a pole over a lawn, its node declaring a cloth pinned along the pole |
| `chalet/` | `chalet.ts` | `chalet.gltf`: a chalet of thin closed shapes, a whitewash ground floor, walls of logs, balcony boards, a shingle roof |
| `instanced-gltf/` | `forest.ts` | `forest.gltf`: a valley, its lake, four tree shapes and a rock placed 4,250 times by `EXT_mesh_gpu_instancing` |
| `cooked-blocks/` | `cooked-blocks.ts` | `blocks.gltf`: forty-eight painted blocks over a stepped plinth, each node declaring a dynamic rigid body |

## Public animation samples

- `cesium-man/source/CesiumMan.glb`: [CesiumMan](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan), © 2017 Cesium, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Cesium logo remains subject to its [separate notice](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/LICENSES/LicenseRef-LegalMark-Cesium.txt). The file is redistributed unchanged.
- `animated-morph-cube/source/AnimatedMorphCube.glb`: [AnimatedMorphCube](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AnimatedMorphCube), © 2017 Public, [CC0](https://creativecommons.org/publicdomain/zero/1.0/). The file is redistributed unchanged.

Both are the Khronos glTF Sample Assets `glTF-Binary` downloads. Their compiled caches are generated by `pnpm run compile:caches` and are not tracked.

## NVIDIA ORCA scenes

Too heavy for git, these sources are assets of the release
[`scenes-orca-1`](https://github.com/pasquelin/Trillion3D-site/releases/tag/scenes-orca-1), with
their licence texts. `pnpm run compile:caches` downloads each into `.scenes/` (git-ignored, never
served), refuses it unless its sha256 is the one `scripts/site-caches.ts` declares, and compiles
its cache (`full`, 4 threads, 8 GB, `qem-endpoints`); only the cache is published.

- `emerald-square/`, from `emerald-day.glb` (sha256
  `06866a47db0a96ae53024fbfb0ebfb8309165083f69243e5131d3ba1734bddb5`):
  [NVIDIA Emerald Square](https://developer.nvidia.com/orca/nvidia-emerald-square), Day version,
  by Nicholas Hull, modified by Kate Anderson (NVIDIA), with Nir Benty; foliage contributed by
  [SpeedTree](https://www.speedtree.com/). © 2017 NVIDIA Corporation,
  [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). The glTF is a
  conversion of the ORCA FBX with Blender 5.2.1: frame 1, no decimation, no texture resize; DDS
  textures decoded to PNG, the specular map's packing (occlusion, roughness, metalness) applied,
  DirectX normals' green inverted, fully opaque materials marked opaque. The conversion is shared
  under the same licence. Used by `a-walk-across-emerald-square`.
- `bistro/`, from `bistro-exterior-uv.glb` (sha256
  `296f71e62f9de576d2ba1b93cdb2b4efea589cbc773e9084e2f4253829edaf8d`):
  [Amazon Lumberyard Bistro](https://developer.nvidia.com/orca/amazon-lumberyard-bistro), exterior,
  from NVIDIA's Open Research Content Archive. Amazon Lumberyard, 2017,
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The glTF is a conversion of the
  ORCA `BistroExterior.fbx` with Blender 5.2.1: frame 1 (the wind animations frozen), no
  decimation, no texture resize, the specular map's packing applied, DirectX normals' green
  inverted. One change for the cook: the 114 texture coordinates of the metal sheets of meshes 781
  and 800 (`MASTER_Grain_Metal`) that lay beyond 256 texture periods are folded into [0, 1), since
  the engine refuses a triangle spanning more periods than a page holds (`T3D-E041`). The file as
  converted, `bistro-exterior.glb`, stays beside it in the release. Used by
  `a-walk-down-the-bistro-street`.

## Files written for their example

These files were made for their example and are released under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/): nothing in them was taken from another
work. Each was generated once, from seeded noise or geometry, and is committed as is; the page reads
it as a user would read their own file.

| Folder | Files | What |
| --- | --- | --- |
| `shapes-from-an-svg/` | `dusk.svg` | a landscape at dusk in layered filled paths, the papercut's source |
| `avif-textures/` | `landscape-q90.avif` … `landscape-q10.avif`, `branch.avif` | a mountain lake at dusk, 1600×800, at four AVIF qualities, and an olive branch with alpha, painted from seeded noise and encoded with ImageMagick (libheif, AV1) |
| `printable-parts/` | `gear.stl`, `vase.ply`, `bolt.amf`, `knot.3mf` | an 18-tooth involute spur gear (binary STL), a twisted nine-lobed vase with vertex colours (binary PLY), an M10 bolt and its nut in two materials (zipped AMF), a trefoil knot tube (3MF package) |
| `voxel-models/` | `lighthouse.vox`, `castle.vox`, `balloon.vox` | three MagicaVoxel models, format version 150 (`SIZE`, `XYZI`, `RGBA`) |
| `a-toolpath-in-lines/` | `star-tower.gcode` | a twisted six-point star tower with a round bore, sliced for a 220 mm Marlin printer: walls, infill, skins, skirt, retractions, arcs, Cura-style `;LAYER:` and `;TYPE:` comments |
| `light-that-bounces/` | `source/room.gltf`, `source/room.bin` | a room for bounced light, cooked with `qem-endpoints` from `COMMITTED_SOURCES` (`scripts/site-caches.ts`) |

`compressed-mesh-input/source/` holds Marble Bust 01 by Rico Cilliers
([Poly Haven](https://polyhaven.com/a/marble_bust_01), CC0, 1k textures), the mesh of
`models/marble-bust/` in one glTF three ways: its original floats (`plain.bin`, the same bytes),
`KHR_draco_mesh_compression` (`draco.bin`, draco-core 2.1.0) and `EXT_meshopt_compression` with
`KHR_mesh_quantization` normals and texture coordinates (`meshopt.bin`, meshoptimizer 0.25). It is
cooked from `COMMITTED_SOURCES`.

## HDR images

`lit-by-an-hdr-image/` holds three equirectangular Radiance images (`.hdr`, 1024×512, the 1k
downloads), unchanged, from [Poly Haven](https://polyhaven.com/license), CC0:

| File | Image | Authors |
| --- | --- | --- |
| `plains.hdr` | [Rosendal Plains 2](https://polyhaven.com/a/rosendal_plains_2) | Dimitrios Savva (photography), Jarod Guest (processing) |
| `sunset.hdr` | [Venice Sunset](https://polyhaven.com/a/venice_sunset) | Greg Zaal |
| `harbour.hdr` | [Golden Bay](https://polyhaven.com/a/golden_bay) | Greg Zaal |

`motion-retargeting` reuses CesiumMan (`cesium-man/`, above).
