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
  // Shadow and light-grid overflows: `shadowVsmOverflowFlags` (and the option that silences it),
  // `tileLightPoolOverflowed`, and the capacities `shadowOnePassProjectionMaxLightsPerPixel` and
  // `lightGridMaxCulledLightsPerCell`.
  {
    ...GUIDE,
    id: 'shadow-overflows',
  },
  // Contact shadows: a light's `contactShadowLength` and the fields beside it, the view's
  // `contactShadows` and `contactShadowOverride…` options, and `indirectLightingIntensity`.
  {
    ...GUIDE,
    id: 'contact-shadows',
  },
  // The compute throttle of the shadow maps: `shadowDynamicResolutionLoadBudget` and
  // `shadowDynamicResolutionTimeBudgetMs`, the history weight and the two caps beside them.
  {
    ...GUIDE,
    id: 'shadow-compute-throttle',
  },
  // Canvas size and the cut's pixel error.
  {
    ...GUIDE,
    id: 'canvas-size-and-pixel-error',
  },
  // Software raster.
  {
    ...GUIDE,
    id: 'software-raster',
  },
  // The cut's settings.
  {
    ...GUIDE,
    id: 'cut-settings',
  },
  // Depth pyramid and occlusion culling.
  {
    ...GUIDE,
    id: 'depth-pyramid-and-occlusion',
  },
  // Run-time tessellation.
  {
    ...GUIDE,
    id: 'tessellation',
  },
  // Volumetric lightmap.
  {
    ...GUIDE,
    id: 'volumetric-lightmap',
  },
  // Global distance field.
  {
    ...GUIDE,
    id: 'global-distance-field',
  },
  // Distance field occlusion of the sky light.
  {
    ...GUIDE,
    id: 'distance-field-occlusion',
  },
  // Surface cache.
  {
    ...GUIDE,
    id: 'surface-cache',
  },
  // Ambient occlusion.
  {
    ...GUIDE,
    id: 'ambient-occlusion',
  },
  // Ambient cubemap.
  {
    ...GUIDE,
    id: 'ambient-cubemap',
  },
  // Reflection captures.
  {
    ...GUIDE,
    id: 'reflection-capture',
  },
  // Material pass settings.
  {
    ...GUIDE,
    id: 'shading-settings',
  },
  // Automatic exposure.
  {
    ...GUIDE,
    id: 'exposure',
  },
  // Render scale, dynamic resolution and frame rate.
  {
    ...GUIDE,
    id: 'render-scale-and-frame-rate',
  },
  // The effect chain.
  {
    ...GUIDE,
    id: 'effect-chain',
  },
  // Film effects.
  {
    ...GUIDE,
    id: 'film-effects',
  },
  // Colour grading.
  {
    ...GUIDE,
    id: 'colour-grading',
  },
  // Outline effect.
  {
    ...GUIDE,
    id: 'outline-effect',
  },
  // Extra views and teardown.
  {
    ...GUIDE,
    id: 'extra-views',
  },
  // Texture filtering.
  {
    ...GUIDE,
    id: 'texture-filtering',
  },
  // Create a world.
  {
    ...GUIDE,
    id: 'world-creation-options',
  },
  // Camera controllers.
  {
    ...GUIDE,
    id: 'camera-controllers',
  },
  // Live material values.
  {
    ...GUIDE,
    id: 'live-material-values',
  },
  // Geometry rewritten every frame.
  {
    ...GUIDE,
    id: 'geometry-rewritten-every-frame',
  },
  // Particles: emitters spawning with the world's frames.
  {
    ...GUIDE,
    id: 'particles',
  },
  // Guides: lines, points and helpers over the image.
  {
    ...GUIDE,
    id: 'guide-lines-and-helpers',
  },
  // Page materials.
  {
    ...GUIDE,
    id: 'page-materials',
  },
  // Material graph.
  {
    ...GUIDE,
    id: 'material-graph',
  },
  // Sky module.
  {
    ...GUIDE,
    id: 'sky-module',
  },
  // Height fog part.
  {
    ...GUIDE,
    id: 'height-fog-part',
  },
  // Atmosphere part.
  {
    ...GUIDE,
    id: 'atmosphere-part',
  },
  // Clouds part.
  {
    ...GUIDE,
    id: 'clouds-part',
  },
  // Declared lights.
  {
    ...GUIDE,
    id: 'declared-lights',
  },
  // Simple lights.
  {
    ...GUIDE,
    id: 'simple-lights',
  },
  // Rectangle lights' pictures.
  {
    ...GUIDE,
    id: 'rectangle-light-pictures',
  },
  // Light functions.
  {
    ...GUIDE,
    id: 'light-functions',
  },
  // A lamp's range is authored, and no frame shortens it.
  {
    ...GUIDE,
    id: 'light-range',
  },
  // Every mesh casts a shadow unless it says castShadow = false.
  {
    ...GUIDE,
    id: 'mesh-cast-shadow',
  },
  // One primitive out of the shadow maps: castsShadowMaps = false.
  {
    ...GUIDE,
    id: 'cast-shadow-maps-per-primitive',
  },
  // A sun's shadow distance and its far casters.
  {
    ...GUIDE,
    id: 'sun-shadow-distance',
  },
  // Classic shadow maps' depth atlas.
  {
    ...GUIDE,
    id: 'classic-shadow-map-atlas',
  },
  // Clipmap statistics.
  {
    ...GUIDE,
    id: 'clipmap-statistics',
  },
  // Clusters table.
  {
    ...GUIDE,
    id: 'clusters-table',
  },
  // A see-through surface casts no shadow.
  {
    ...GUIDE,
    id: 'see-through-surface-shadow',
  },
  // A see-through surface reads the sun's shadow, with one sample.
  {
    ...GUIDE,
    id: 'see-through-surface-sun-shadow',
  },
  // A light that follows the exposure.
  {
    ...GUIDE,
    id: 'light-follows-exposure',
  },
  // A light that is left out at a distance.
  {
    ...GUIDE,
    id: 'light-distance-culling',
  },
  // Lighting channels.
  {
    ...GUIDE,
    id: 'lighting-channels',
  },
  // A see-through surface lit from the translucency lighting volume.
  {
    ...GUIDE,
    id: 'translucency-lighting-volume',
  },
  // Translucency global illumination volume.
  {
    ...GUIDE,
    id: 'translucency-global-illumination-volume',
  },
  // Single-layer water.
  {
    ...GUIDE,
    id: 'single-layer-water',
  },
  // Heterogeneous volumes: voxel grids and the volumetric shadow map.
  {
    ...GUIDE,
    id: 'heterogeneous-volumes',
  },
  // The scattering of the light under a surface (subsurface profile).
  {
    ...GUIDE,
    id: 'subsurface-profile',
  },
  // The pass of the image a see-through surface is drawn in.
  {
    ...GUIDE,
    id: 'see-through-surface-pass',
  },
  // A lamp's source radius and its housing.
  {
    ...GUIDE,
    id: 'light-source-radius',
  },
  // A lamp's cone, fall-off and share of light.
  {
    ...GUIDE,
    id: 'spot-light-cone',
  },
  // Lights imported from the source file.
  {
    ...GUIDE,
    id: 'imported-lights',
  },
  // Memory budgets.
  {
    ...GUIDE,
    id: 'memory-budgets',
  },
  // Out of memory is absorbed.
  {
    ...GUIDE,
    id: 'out-of-memory',
  },
  // Captures and image checks.
  {
    ...GUIDE,
    id: 'captures-and-image-checks',
  },
  // GPU deformation.
  {
    ...GUIDE,
    id: 'gpu-deformation',
  },
  // Sampled lighting: guide filter.
  {
    ...GUIDE,
    id: 'sampled-lighting-guide-filter',
  },
  // Hair strands: coverage mapping.
  {
    ...GUIDE,
    id: 'hair-strands-coverage-mapping',
  },
  // Path tracer and its denoiser.
  {
    ...GUIDE,
    id: 'path-tracer-and-its-denoiser',
  },
  // Heterogeneous volumes: preshading and level of detail.
  {
    ...GUIDE,
    id: 'heterogeneous-volumes-preshading',
  },
  // Hair strands: compute raster.
  {
    ...GUIDE,
    id: 'hair-strands-compute-raster',
  },
  // Hair strands: velocity.
  {
    ...GUIDE,
    id: 'hair-strands-velocity',
  },
  // Hair strands: curve raster.
  {
    ...GUIDE,
    id: 'hair-strands-curve-raster',
  },
  // Hair strands: forward raster.
  {
    ...GUIDE,
    id: 'hair-strands-forward-raster',
  },
  // Hair strands: G-buffer write.
  {
    ...GUIDE,
    id: 'hair-strands-g-buffer-write',
  },
  // Surface cache: debug views.
  {
    ...GUIDE,
    id: 'surface-cache-debug-views',
  },
  // Reflections that read the radiance cache.
  {
    ...GUIDE,
    id: 'reflections-that-read-the-radiance-cache',
  },
  // Short-range occlusion through the scene's triangles.
  {
    ...GUIDE,
    id: 'short-range-occlusion-triangles',
  },
  // Reservoir gather of the indirect light.
  {
    ...GUIDE,
    id: 'reservoir-gather-of-the-indirect-light',
  },
  // Sampled lighting: debug views.
  {
    ...GUIDE,
    id: 'sampled-lighting-debug-views',
  },
  // Hair strands: debug views.
  {
    ...GUIDE,
    id: 'hair-strands-debug-views',
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
