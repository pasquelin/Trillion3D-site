import type { EntryFrame } from '../i18n/entries.ts'
import { EDITOR_GUIDES } from './editorGuides.ts'

/** Guides: their words, prose in `html`, are each language's `written` text in `site/i18n/`. */
const GUIDE = { section: 'guides', kind: 'Guide' }

export const GUIDES: EntryFrame[] = [
  // Install, compile, draw: its commands are the same in every language, and
  // `node scripts/prove-install-page.ts` runs the English ones in a clean folder.
  {
    ...GUIDE,
    id: 'install',
  },
  // HLOD: the compile option `hlod`, both its forms, and the `hlod` and `wireframe` views.
  {
    ...GUIDE,
    id: 'hlod',
  },
  // Temporal anti-aliasing: the scene's level (compile option, page, live), who decides, each
  // material's share of history (`materials`, glTF `extras`), and the `taa-material-history` view.
  {
    ...GUIDE,
    id: 'temporal-antialiasing',
  },
  // Responsive anti-aliasing: the compile options `responsive` and `materials`, the glTF
  // material's `extras`, which one wins, and the `taa-responsive` view.
  {
    ...GUIDE,
    id: 'responsive-antialiasing',
  },
  {
    ...GUIDE,
    id: 'three-migration',
  },
  {
    ...GUIDE,
    id: 'measurement-entry',
  },
  {
    ...GUIDE,
    id: 'createWorldJob',
    example: `const job = createJob('city-world', async ({ signal }) => {
  const world = createWorld('viewer', { signal });
  await world.scene.load('/cache/city/manifest.json', { signal });
  return world;
});
job.subscribe(() => console.log(job.getSnapshot().progress));
const world = await job.promise;`,
  },
  ...EDITOR_GUIDES,
]
