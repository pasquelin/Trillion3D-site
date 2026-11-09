/** The examples whose scene opens in the Trillion3D editor: the project ZIP the example page
 *  makes from the example's source glTF when it is asked for (`site/app/projects`). */
export interface EditorProject {
  /** The project's title. */
  name: string
  /** What the project says of itself. */
  description: string
  /** The source glTF, under the example's folder of `site/assets/examples/`. */
  source: string
  /** Where the editor's view opens. */
  editorCamera: { position: number[]; target: number[] }
  /** Whether the level has the sky module. */
  sky: boolean
}

export const EDITOR_PROJECTS: Record<string, EditorProject> = {
  'long-district': {
    name: 'Long district',
    description:
      'A city street two kilometres long, in metres: blocks of flats, towers, street furniture, ' +
      'parked and driving cars, a tram, a Ferris wheel and a lake, from the Trillion3D examples.',
    source: 'source/district.gltf',
    editorCamera: { position: [0, 1.7, 12], target: [0, 1.7, -100] },
    sky: true,
  },
}
