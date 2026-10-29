/** Pre-compresses a built site's scene-cache objects in brotli beside their originals (`site.yml`). */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { brotliCompress, constants } from 'node:zlib'

/** The sidecars beside a scene cache's manifest that the engine reads whole — the ray tracing
 *  structures, the manifest pages' columns, the texture previews' pixels, the mesh cards —: a
 *  quarter of their bytes or less in brotli (sponza 6.85 MB to 1.76). Never the distance fields
 *  or the source, which the engine reads by ranges. */
const WHOLE_SIDECAR =
  /[\\/](?:rayTracing|meshCards|(?:manifest-page|preview-pixels)-[0-9a-f]{64})\.bin$/

/** A scene cache's file sent in brotli: a content-addressed object, geometry pages among them —
 *  binary, yet 11 to 24 % lighter —, or a sidecar read whole (`WHOLE_SIDECAR`). The one rule the
 *  docs server (`docs/serve.ts`) and the deploy share. */
export const isCacheObject = (file: string) =>
  /[\\/]objects[\\/][^\\/]+\.bin$/.test(file) || WHOLE_SIDECAR.test(file)

const compress = promisify(brotliCompress)

/** Writes `<object>.br` at the top quality beside every cache object under `root`, one file per
 *  core at a time on zlib's thread pool; returns how many it wrote. */
export async function compressCacheObjects(root: string) {
  const files = (await readdir(root, { recursive: true }))
    .map((file) => resolve(root, file))
    .filter(isCacheObject)
  const top = { params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY } }
  let next = 0
  const worker = async () => {
    for (let file; (file = files[next++]) !== undefined;)
      await writeFile(`${file}.br`, await compress(await readFile(file), top))
  }
  await Promise.all(Array.from({ length: availableParallelism() }, worker))
  return files.length
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.argv[2] ?? 'dist/site'
  console.log(`${await compressCacheObjects(root)} cache objects compressed under ${root}`)
}
