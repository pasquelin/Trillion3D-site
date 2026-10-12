// The public surface the documentation runs: the common facade's maths, the diagnostic, quality
// and format tables the enum pages show, and the internal browser depth convention the portal
// explains without presenting it as an application import. The demos import this module, so every
// demo executes the engine itself rather than a copy of it.
export * from '#engine/packages/sdk/common/math.ts'
export { RAD2DEG, TAU } from '#engine/packages/math/src/constants.ts'
export { clamp, saturate } from '#engine/packages/math/src/scalar/reals.ts'
export { length3 } from '#engine/packages/math/src/vector/vector.ts'
export { unorm8 } from '#engine/packages/math/src/color/color.ts'
export { perspectiveSlope } from '#engine/packages/math/src/projection/camera.ts'
export { DIAGNOSTICS } from '#engine/packages/sdk/common/diagnostics.ts'
export {
  LOD_QUALITY,
  adaptivePixelError,
  lodQuality,
} from '#engine/packages/sdk/common/contracts.ts'
export { COLUMN_KIND } from '#engine/packages/sdk/common/streaming.ts'
export {
  DEPTH_CLEAR,
  DEPTH_COMPARE_OR_EQUAL,
  DEPTH_NEAR,
} from '#engine/packages/sdk-browser/src/camera/depthConvention.ts'
