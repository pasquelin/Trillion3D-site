/**
 * An example's scene as a project of the Trillion3D editor, made in the page when it is asked for:
 * one ZIP holding `.project.json`, the level under `Scenes/` and its models under `Models/`.
 *
 * An example whose scene is one compiled model (`EDITOR_PROJECTS`) has its source glTF cut into
 * models (`gltfSplit.ts`): each mesh a root node draws still becomes one `.glb`, placed by an actor
 * for each node that draws it, grouped by model; the nodes its clips move, and those under them,
 * become one model of their own, its clips kept, placed once where they stand. Any other example
 * hands its live scene over (`site/examples/kit/projectExport.ts`): each object at the top of it a
 * `.glb` the engine wrote, its pose moved to its actor, objects whose files are then the same one
 * model; what draws nothing (a lamp alone, an empty group, a model the page loaded compiled) is
 * left out. The models travel as sources for the editor to compile with its own engine. An actor
 * names the manifest that compile writes (`Models/<stem>/native/full/manifest.json`): it draws
 * nothing until its model is compiled in the editor.
 */
import { QUARTER_PI, RAD2DEG, TAU } from '#engine/packages/math/src/constants.ts'
import { clamp } from '#engine/packages/math/src/scalar/reals.ts'
import {
  multiplyQuaternion,
  rotateByQuaternion,
} from '#engine/packages/math/src/quaternion/quaternion.ts'
import { hypot4 } from '#engine/packages/math/src/float/hypot.ts'
import { eulerFromRotationMatrix } from '#engine/packages/math/src/matrix/euler.ts'
import { rotationMatrix4 } from '#engine/packages/math/src/matrix/matrix4Compose.ts'
import { EDITOR_PROJECTS } from '../../content/editor-projects.ts'
import type {
  ExportAnswer,
  ExportedLight,
  ExportedObject,
} from '../../examples/kit/projectExport.ts'
import { encodeText } from './bytes.ts'
import { SCENE_SOURCES } from './sources.inline.ts'
import {
  animatedNodes,
  glb,
  glbOf,
  readGlb,
  readGltf,
  subtree,
  type Gltf,
  type Node,
  type ReadFile,
  type Source,
} from './gltfSplit.ts'
import { zip, type ZipEntry } from './zip.ts'

/** `text` as a file or id name: lower case, words joined by `-`. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** A placement of a model in the level: the actor's id and name, its model's stem (the source
 *  `Models/<stem>.glb`), its group, its node's pose, and whether it plays the model's clip. */
interface Placement {
  id: string
  name: string
  model: string
  group?: string
  pose: Pick<Node, 'translation' | 'rotation' | 'scale' | 'matrix'>
  clip?: string
}

/** The models of `source` and their placements. */
function cut(source: Source) {
  const { gltf } = source,
    roots = gltf.scenes[gltf.scene ?? 0].nodes,
    moving = animatedNodes(gltf)
  const animated = roots.filter((root) => subtree(gltf, [root]).some((node) => moving.has(node)))
  const models = new Map<string, Uint8Array>(),
    placements: Placement[] = []
  if (animated.length) {
    const clip = gltf.animations?.[0]?.name ?? 'animation_0',
      model = slug(clip)
    // The editor binds a clip's tracks to the nodes by name: each node it moves names one.
    const names = subtree(gltf, animated).map((node) => gltf.nodes[node].name),
      twice = names.find((name, k) => !name || names.indexOf(name) !== k)
    if (twice !== undefined) throw new Error(`a moving node named "${twice}" not once`)
    models.set(
      model,
      glbOf(source, { roots: animated.map((node) => ({ node })), animations: true }),
    )
    placements.push({ id: slug(clip), name: clip, model, pose: {}, clip })
  }
  // A still root: its mesh is one model, shared by every root that draws it; a root with children
  // or no mesh is a model of its own.
  const still = roots.filter((root) => !animated.includes(root)),
    count = new Map<string, number>()
  const keyOf = (root: number) => {
    const { mesh, children } = gltf.nodes[root]
    return mesh !== undefined && !children?.length
      ? ((gltf.meshes![mesh].name as string | undefined) ?? `mesh ${mesh}`)
      : (gltf.nodes[root].name ?? `node ${root}`)
  }
  for (const root of still) count.set(keyOf(root), (count.get(keyOf(root)) ?? 0) + 1)
  const seen = new Map<string, number>()
  for (const root of still) {
    const key = keyOf(root),
      model = slug(key),
      k = seen.get(key) ?? 0,
      { translation, rotation, scale, matrix, name } = gltf.nodes[root]
    seen.set(key, k + 1)
    if (!models.has(model))
      models.set(model, glbOf(source, { roots: [{ node: root, placed: {} }] }))
    const many = count.get(key)! > 1
    placements.push({
      id: many ? `${slug(key)}-${k + 1}` : slug(key),
      name: name ?? (many ? `${key} ${k + 1}` : key),
      model,
      ...(many ? { group: key } : {}),
      pose: { translation, rotation, scale, matrix },
    })
  }
  return { models, placements, count }
}

/** `name` once among `taken`, a number after it when it is there already; then taken. */
function unique(name: string, taken: Set<string>) {
  let out = name
  for (let k = 2; taken.has(out); k++) out = `${name}-${k}`
  taken.add(out)
  return out
}

/** The SHA-256 of `bytes`, in hexadecimal. */
async function digest(bytes: Uint8Array) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A lamp of the level: the editor's `light` actor but its id, its name and its pose. */
interface Lamp {
  name: string
  fields: Record<string, unknown>
  pose: Pick<Node, 'translation' | 'rotation'>
}

/** The kinds of lamp glTF holds (`KHR_lights_punctual`), with their aim and photometric
 *  intensity; the editor's other kinds are written from what the page set. */
const PUNCTUAL = new Set(['point', 'spot', 'directional'])

/** The lamp `light` the page exported as `gltf`, named `name`; none for a kind the editor has not.
 *  A punctual one is read off its glTF: its intensity in candelas (point, spot) or lux, its range,
 *  its cones, and its aim — its node's, or a child's holding it turned. */
function lampOf(name: string, light: ExportedLight, gltf: Gltf, root: number): Lamp | undefined {
  const base = { light: light.kind, color: light.color },
    top = gltf.nodes[root]
  if (light.kind === 'ambient' || light.kind === 'hemisphere')
    return {
      name,
      fields: {
        ...base,
        intensity: Math.max(0, light.intensity),
        castShadow: false,
        ...(light.kind === 'hemisphere'
          ? { engine: { light: { groundColor: light.groundColor } } }
          : {}),
      },
      pose: { translation: top.translation },
    }
  if (!PUNCTUAL.has(light.kind)) return undefined
  const lit = (at: number) =>
    (gltf.nodes[at].extensions?.KHR_lights_punctual as { light?: number } | undefined)?.light
  const holder = subtree(gltf, [root]).find((at) => lit(at) !== undefined)
  const entries = (gltf.extensions?.KHR_lights_punctual as { lights?: Record<string, unknown>[] })
    ?.lights
  const entry = holder === undefined ? undefined : entries?.[lit(holder)!]
  if (holder === undefined || !entry) return undefined
  // The holder's pose in the scene: under the top node when it is a child of it.
  const turn = top.rotation ?? [0, 0, 0, 1],
    at = top.translation ?? [0, 0, 0]
  let pose: Lamp['pose'] = { translation: at, rotation: turn }
  if (holder !== root) {
    const child = gltf.nodes[holder],
      [sx, sy, sz] = top.scale ?? [1, 1, 1],
      [cx, cy, cz] = child.translation ?? [0, 0, 0],
      moved = rotateByQuaternion(new Float64Array(3), turn, sx * cx, sy * cy, sz * cz)
    pose = {
      translation: [at[0] + moved[0], at[1] + moved[1], at[2] + moved[2]],
      rotation: [...multiplyQuaternion(new Float64Array(4), turn, child.rotation ?? [0, 0, 0, 1])],
    }
  }
  const spot = entry.spot as { innerConeAngle?: number; outerConeAngle?: number } | undefined,
    outer = clamp(Math.round((spot?.outerConeAngle ?? QUARTER_PI) * RAD2DEG), 1, 89)
  return {
    name,
    fields: {
      ...base,
      intensity: Math.max(0, Number(entry.intensity ?? 1)),
      castShadow: light.castShadow,
      ...(light.kind === 'directional'
        ? {}
        : {
            distance: Number(entry.range ?? 0),
            engine: { light: { intensityUnits: 'candelas' } },
          }),
      ...(light.kind === 'spot'
        ? {
            angle: outer,
            innerAngle: clamp(Math.round((spot?.innerConeAngle ?? 0) * RAD2DEG), 0, outer),
          }
        : {}),
    },
    pose,
  }
}

/** The models, placements and lamps of the objects a page exported: each object's binary glTF
 *  with its top node's pose moved to its actor, one model for objects whose files are then the
 *  same; a lamp at the top of the scene as a lamp of the level; the names of the objects that draw
 *  nothing (`left`). */
async function placedObjects(objects: readonly ExportedObject[], taken: Set<string>) {
  const models = new Map<string, Uint8Array>(),
    stems = new Map<string, string>(),
    placements: Placement[] = [],
    lamps: Lamp[] = [],
    loaded: Loaded[] = [],
    left: string[] = []
  for (const [k, object] of objects.entries()) {
    const { gltf, bin } = readGlb(object.glb),
      root = gltf.scenes[gltf.scene ?? 0]?.nodes[0],
      node = root === undefined ? undefined : gltf.nodes[root],
      name = object.name || node?.name || `object ${k + 1}`
    if (object.light && root !== undefined) {
      const lamp = lampOf(name, object.light, gltf, root)
      if (lamp) lamps.push(lamp)
      else left.push(name)
      continue
    }
    if (root === undefined) {
      left.push(name)
      continue
    }
    const { translation, rotation, scale, ...still } = node!,
      pose = node!.matrix ? {} : { translation, rotation, scale }
    // A compiled model the page loaded is written empty, its manifest's address on it: its scene
    // comes from its source.
    for (const at of subtree(gltf, [root])) {
      const url = (gltf.nodes[at].extras as { manifestUrl?: unknown } | undefined)?.manifestUrl
      const scene = typeof url === 'string' ? sceneOf(url) : undefined
      if (scene) loaded.push({ scene, name, pose })
      else if (url !== undefined) left.push(name)
    }
    if (!subtree(gltf, [root]).some((at) => gltf.nodes[at].mesh !== undefined)) {
      if (!loaded.some((scene) => scene.name === name)) left.push(name)
      continue
    }
    // A pose given as a matrix stays in the model, its actor at the origin.
    if (!node!.matrix) gltf.nodes[root] = still
    const file = glb(gltf, bin),
      hash = await digest(file)
    let stem = stems.get(hash)
    if (!stem) {
      stem = unique(slug(name) || 'object', taken)
      stems.set(hash, stem)
      models.set(stem, file)
    }
    placements.push({ id: '', name, model: stem, pose })
  }
  return { models, placements, lamps, loaded, left }
}

/** A compiled scene a page loaded: its folder under `site/assets/` (`examples/bust`), the name of
 *  the object that placed it and its pose. */
interface Loaded {
  scene: string
  name: string
  pose: Placement['pose']
}

/** The scene folder under `site/assets/` a compiled model's manifest address lies in. */
function sceneOf(url: string) {
  const [, scene] = /assets\/((?:examples|gallery)\/[^/]+)\/cache[^/]*\//.exec(url) ?? []
  return scene && scene in SCENE_SOURCES ? scene : undefined
}

/** The file kinds a source folder holds a model in; the others (buffers, pictures, materials)
 *  are what those read. */
const MODEL_FILES = /\.(gltf|glb|obj|usdz|usda|usdc|usd|fbx|dae|stl|ply)$/i

/** The release whose assets are the scenes too heavy for git (`DOWNLOADS_RELEASE` of
 *  `scripts/site-caches.ts`). */
const DOWNLOADS_PAGE = 'https://github.com/pasquelin/Trillion3D-site/releases/tag/scenes-orca-1'

/** The scenes `loaded` as the project's models: each one's source folder copied once under
 *  `Models/<name>-source/`, each model file at its top one model (the only one named after the
 *  scene), placed where the page placed the scene. A scene whose source the site does not serve is
 *  placed under the name its downloaded file is to take, and said in `missing`. */
async function sourcesOf(loaded: readonly Loaded[], taken: Set<string>, read: ReadFile) {
  const files: { path: string; bytes: Uint8Array }[] = [],
    placements: Placement[] = [],
    missing: string[] = [],
    stemsOf = new Map<string, string[]>()
  for (const { scene, name, pose } of loaded) {
    let stems = stemsOf.get(scene)
    if (!stems) {
      const listed = SCENE_SOURCES[scene],
        folder = scene.slice(scene.indexOf('/') + 1),
        models = listed.filter((path) => !path.includes('/') && MODEL_FILES.test(path))
      if (!listed.length) {
        stems = [unique(folder, taken)]
        missing.push(
          `\`Models/${stems[0]}.glb\`: the source of the scene \`${folder}\` is too heavy to be served ` +
            `(an NVIDIA ORCA scene): download it from ${DOWNLOADS_PAGE} and save it as ` +
            `\`Models/${stems[0]}.glb\`.`,
        )
      } else {
        const home = unique(`${folder}-source`, taken)
        stems = models.map((path) =>
          unique(models.length === 1 ? folder : slug(path.replace(/\.[^.]*$/, '')), taken),
        )
        for (const path of listed) {
          const at = models.indexOf(path),
            renamed = at < 0 ? path : `${stems[at]}${path.slice(path.lastIndexOf('.'))}`
          files.push({
            path: `Models/${home}/${renamed}`,
            bytes: await read(`${scene}/source/${path}`),
          })
        }
      }
      stemsOf.set(scene, stems)
    }
    for (const stem of stems)
      placements.push({ id: '', name: stems.length > 1 ? stem : name, model: stem, pose })
  }
  return { files, placements, missing }
}

/** Gives each placement its id, once every model is counted: a model placed more than once is a
 *  group of its own. */
function counted(placements: Placement[]) {
  const count = new Map<string, number>()
  for (const { model } of placements) count.set(model, (count.get(model) ?? 0) + 1)
  const ids = new Set<string>(),
    seen = new Map<string, number>()
  for (const placement of placements) {
    const k = (seen.get(placement.model) ?? 0) + 1,
      many = count.get(placement.model)! > 1
    seen.set(placement.model, k)
    placement.id = unique(many ? `${placement.model}-${k}` : placement.model, ids)
    if (many) placement.group = placement.model
  }
  return count
}

/** The editor's own lamps, for a scene that has neither a sky nor a lamp of its own: a sun and a
 *  sky light, at the intensities the editor gives new ones. */
const DEFAULT_LAMPS: Lamp[] = [
  {
    name: 'Sun',
    fields: { light: 'directional', color: '#fff4e5', intensity: 10, castShadow: true },
    // 50° down, 30° round: the editor's angles as a quaternion (x, y, z, w).
    pose: { translation: [3, 6, 2], rotation: [-0.3967, 0.2164, 0.0999, 0.8865] },
  },
  {
    name: 'Sky light',
    fields: {
      light: 'hemisphere',
      color: '#bcd4ff',
      intensity: 0.6,
      castShadow: false,
      engine: { light: { groundColor: '#3a3226' } },
    },
    pose: { translation: [0, 3, 0] },
  },
]

/** What the level says of the scene besides its actors: its title, its sky, its background and
 *  where the editor's view opens. */
interface Scene {
  name: string
  description: string
  sky: unknown
  background: string
  editorCamera: { position: number[]; target: number[] }
}

/** The editor project of `example`, as the files of its ZIP under the folder `example`. An example
 *  of `EDITOR_PROJECTS` has its source glTF read through `read`, by its path under its folder of
 *  `site/assets/examples/`; any other is the scene its page exported (`page`), titled `title`.
 *  `left` names what the project leaves out. */
export async function editorProject(
  example: string,
  { read, page, title = example }: { read: ReadFile; page?: ExportedScene; title?: string },
): Promise<{ entries: ZipEntry[]; left: string[] }> {
  const project = EDITOR_PROJECTS[example]
  const models = new Map<string, Uint8Array>(),
    files: { path: string; bytes: Uint8Array }[] = [],
    placements: Placement[] = [],
    lamps: Lamp[] = [],
    left: string[] = [],
    missing: string[] = []
  let scene: Scene, count: Map<string, number>
  if (project) {
    const folder = project.source.slice(0, project.source.lastIndexOf('/') + 1),
      file = project.source.slice(folder.length),
      from = `examples/${example}/${folder}`
    const district = cut(await readGltf(file, (path) => read(from + path)))
    district.models.forEach((bytes, stem) => models.set(stem, bytes))
    placements.push(...district.placements)
    count = district.count
    scene = { ...project, background: DEFAULT_BACKGROUND }
  } else {
    if (!page) throw new Error(`${example}: no scene to export`)
    const taken = new Set<string>(),
      built = await placedObjects(page.objects, taken),
      sources = await sourcesOf(built.loaded, taken, read)
    built.models.forEach((bytes, stem) => models.set(stem, bytes))
    files.push(...sources.files)
    placements.push(...built.placements, ...sources.placements)
    lamps.push(...built.lamps)
    left.push(...built.left)
    missing.push(...sources.missing)
    count = counted(placements)
    scene = {
      name: title,
      description: `The scene of the Trillion3D example "${title}", as its page built it.`,
      sky:
        page.sky === true || (typeof page.sky === 'object' && page.sky !== null) ? page.sky : false,
      background: page.background ?? DEFAULT_BACKGROUND,
      editorCamera: page.camera,
    }
  }
  const lit = lamps.length || scene.sky !== false ? lamps : DEFAULT_LAMPS
  const level = levelOf(example, scene, placements, count, lit)
  const manifest = {
    format: 't3d-project',
    version: 1,
    id: example,
    name: scene.name,
    description: scene.description,
    startLevel: `Scenes/${example}.scene.json`,
    created: Date.UTC(2026, 0, 1),
    template: 'empty',
  }
  const skipped = [
    ...new Set(
      // A loaded model comes from its source, a lamp glTF has not is a lamp of the level.
      (page?.objects ?? []).flatMap(({ skipped, light }) =>
        skipped
          .filter(({ reason }) => reason !== 'loaded-model' && !(light && reason === 'light-kind'))
          .map(
            ({ reason, field, name }) =>
              `${name || 'an object'}: ${reason}${field ? ` (${field})` : ''}`,
          ),
      ),
    ),
  ]
  const json = (value: unknown) => encodeText(`${JSON.stringify(value, null, 2)}\n`)
  const entries = [
    { path: `${example}/.project.json`, bytes: json(manifest) },
    {
      path: `${example}/README.md`,
      bytes: encodeText(readmeOf(scene.name, missing, skipped, left)),
    },
    { path: `${example}/Scenes/${example}.scene.json`, bytes: json(level) },
    ...[...models].map(([stem, bytes]) => ({ path: `${example}/Models/${stem}.glb`, bytes })),
    ...files.map(({ path, bytes }) => ({ path: `${example}/${path}`, bytes })),
  ]
  return { entries, left: [...missing, ...left] }
}

/** The project's README: how to open it, and what it does not hold. */
function readmeOf(name: string, missing: string[], skipped: string[], left: string[]) {
  const list = (lines: string[]) => lines.map((line) => `- ${line}`).join('\n')
  return [
    `# ${name}`,
    '',
    'A Trillion3D editor project made from a Trillion3D example: import this ZIP in the editor.',
    '',
    '## Compile the models',
    '',
    'Each model under `Models/` is a source: an actor draws nothing until its model is compiled',
    '(Build > Compile a Model..., or a double click on the file in the Content Browser).',
    ...(missing.length ? ['', '## Not included', '', list(missing)] : []),
    ...(skipped.length || left.length
      ? [
          '',
          '## Left out by the export',
          '',
          list([...skipped, ...left.map((object) => `${object}: draws nothing the editor places`)]),
        ]
      : []),
    '',
    'What the example moves in its own code is not part of the project: its scene is taken as it',
    'stood when the project was made.',
    '',
  ].join('\n')
}

/** The editor's background where there is no sky. */
const DEFAULT_BACKGROUND = '#33363b'

/** The level the editor reads: a group for each model placed more than once, an actor for each
 *  placement. */
function levelOf(
  example: string,
  scene: Scene,
  placements: Placement[],
  count: Map<string, number>,
  lamps: Lamp[],
) {
  const lampIds = new Set<string>()
  const groups = [...count].filter(([, n]) => n > 1).map(([key]) => key)
  const actor = (fields: Record<string, unknown>) => ({
    parentId: null,
    visible: true,
    tags: [],
    components: [],
    ...fields,
  })
  return {
    format: 't3d-level',
    version: 1,
    id: example,
    name: scene.name,
    // The editor's defaults but the sky and the background.
    settings: {
      sky: scene.sky,
      background: scene.background,
      gravity: 9.81,
      player: { walkSpeed: 6, jumpSpeed: 4.2, jumps: 1 },
      killZ: -30,
    },
    editorCamera: scene.editorCamera,
    actors: [
      ...groups.map((key) =>
        actor({
          id: `group-${slug(key)}`,
          name: `${key} (${count.get(key)})`,
          kind: 'group',
          transform: transformOf({}),
        }),
      ),
      ...placements.map(({ id, name, model, group, pose, clip }) =>
        actor({
          id,
          name,
          kind: 'model',
          source: `Models/${model}/native/full/manifest.json`,
          ...(group ? { parentId: `group-${slug(group)}` } : {}),
          transform: transformOf(pose),
          ...(clip
            ? {
                animation: {
                  mode: 'asset',
                  clip,
                  loop: true,
                  playRate: 1,
                  start: 0,
                  playing: true,
                },
              }
            : {}),
        }),
      ),
      ...lamps.map(({ name, fields, pose }) =>
        actor({
          id: unique(`lamp-${slug(name) || 'light'}`, lampIds),
          name,
          kind: 'light',
          ...fields,
          transform: transformOf(pose),
        }),
      ),
    ],
  }
}

/** A node's pose as the editor's transform: position, rotation and scale, the rotation in
 *  degrees about X, Y then Z (intrinsic). */
function transformOf({ translation, rotation, scale, matrix }: Placement['pose']) {
  if (matrix) throw new Error('a placement given by a matrix: not written yet')
  return {
    position: translation ?? [0, 0, 0],
    rotation: rotation ? degreesOf(rotation) : [0, 0, 0],
    scale: scale ?? [1, 1, 1],
  }
}

/** The quaternion `q` (x, y, z, w) as the editor's angles: degrees about X, Y then Z, read off
 *  its rotation matrix as the editor reads them, to a millionth of a degree. */
function degreesOf(q: readonly number[]) {
  const degrees = (angles: ArrayLike<number>) =>
    // `+ 0` folds a negative zero into zero.
    Array.from(angles, (angle) => Math.round(angle * RAD2DEG * 1e6) / 1e6 + 0)
  // A turn about Y alone is its one angle: read off the matrix past a quarter turn, it would be
  // given as a half turn about X and Z and the rest about Y.
  if (q[0] === 0 && q[2] === 0) {
    // Twice a half angle in (-π, π]: one turn is taken off past a half one.
    const yaw = 2 * Math.atan2(q[1], q[3])
    return degrees([0, yaw > Math.PI ? yaw - TAU : yaw <= -Math.PI ? yaw + TAU : yaw, 0])
  }
  const n = hypot4(q[0], q[1], q[2], q[3]),
    turn = rotationMatrix4(
      new Float64Array(16),
      q.map((v) => v / n),
    ),
    angles = eulerFromRotationMatrix(new Float64Array(3), turn, 'XYZ')
  return degrees(angles)
}

/** The scene a page exported, its answer without its envelope. */
export type ExportedScene = Extract<ExportAnswer, { objects: unknown }>

/** How long a page may take to export its scene, in milliseconds. */
const EXPORT_WAIT = 180_000

/** The scene of the example in `frame`, asked of its kit (`projectExport.ts`). */
function exportFrame(frame: HTMLIFrameElement): Promise<ExportedScene> {
  const target = frame.contentWindow
  if (!target) return Promise.reject(new Error('the example is not running'))
  const id = Math.random()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('the example did not answer')), EXPORT_WAIT)
    const hear = (event: MessageEvent) => {
      const answer = event.data as Partial<ExportAnswer> | null
      if (event.source !== target || answer?.type !== 'trillion3d:exported' || answer.id !== id)
        return
      finish('error' in answer ? new Error(answer.error) : undefined, answer as ExportedScene)
    }
    const finish = (error?: Error, scene?: ExportedScene) => {
      clearTimeout(timer)
      removeEventListener('message', hear)
      if (error) reject(error)
      else resolve(scene!)
    }
    addEventListener('message', hear)
    target.postMessage({ type: 'trillion3d:export', id }, location.origin)
  })
}

/** Makes the project ZIP of `example`, titled `title`, and hands it to the person as
 *  `<example>.zip`: from its source served beside the portal, or from the scene of its page running
 *  in `frame`. Resolves to the names of what the project leaves out. */
export async function downloadEditorProject(
  example: string,
  title: string,
  frame: HTMLIFrameElement | null,
): Promise<string[]> {
  const read: ReadFile = async (path) => {
    const url = new URL(`assets/${path}`, document.baseURI),
      response = await fetch(url)
    if (!response.ok) throw new Error(`${url.href}: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }
  const page = example in EDITOR_PROJECTS || !frame ? undefined : await exportFrame(frame)
  const { entries, left } = await editorProject(example, { read, page, title })
  const archive = await zip(entries)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([archive as BlobPart], { type: 'application/zip' }))
  link.download = `${example}.zip`
  link.click()
  // Revoked on the next task: some browsers start the download after `click` returns.
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
  return left
}
