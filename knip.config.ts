import type { KnipConfig } from 'knip'

// The site's entries: the portal and the examples' kit (bundled by `scripts/docs/build-portal.ts`
// and `build-runtime.ts`), the tests, and the scripts `package.json` and the workflows run, which
// knip finds itself. The engine under `.engine/` is read, never checked here.
const config: KnipConfig = {
  entry: [
    'site/app/main.tsx',
    'site/examples/kit/index.ts',
    '**/*.test.ts',
    // Run by hand: the example scenes' sources and thumbnails (`docs/LEARNING_PORTAL.md`), the
    // first-load measurement of the site and the Install page walkthrough, a Chrome proof.
    'scripts/docs/examples-assets.ts',
    'scripts/docs/examples-thumbnails.ts',
    'scripts/site-first-load.ts',
    'scripts/prove-install-page.ts',
  ],
  project: ['site/**/*.{ts,tsx}', 'scripts/**/*.ts', 'tests/**/*.ts', '*.ts'],
  ignore: ['.engine/**'],
  // A type shared by the declarations of its own file is part of that file's contract.
  ignoreExportsUsedInFile: { interface: true, type: true },
  // DaisyUI is loaded by Tailwind; the build copies SVG files of flag-icons by path
  // (`scripts/docs/build-flags.ts`), importing no module of it.
  ignoreDependencies: ['daisyui', 'flag-icons'],
}

export default config
