// The site's static server: the engine's (`scripts/test/static-server.ts`), whose content types,
// byte ranges, replies and port it reads, with the brotli encoding the docs portal serves its scene
// caches in (`compress`). What sets one use apart is an option, never a copy.
import { once } from 'node:events'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream'
import { constants, createBrotliCompress } from 'node:zlib'
import {
  byteRange,
  contentType,
  reply,
  type StaticOptions as EngineStaticOptions,
} from '#engine/scripts/test/static-server.ts'

/** The file the URL-encoded `path` names under `dir`, or `null` when it leaves `dir`. */
function fileUnder(dir: string, path: string): string | null {
  const base = resolve(dir)
  const file = resolve(base, `./${decodeURIComponent(path)}`)
  return file === base || file.startsWith(base + sep) ? file : null
}

/** What sets one server apart: the engine's options, and the encoding. Without options it answers
 *  404 to everything. */
export interface StaticOptions extends EngineStaticOptions {
  /** Whether a file is sent brotli-encoded to a request that accepts it (`Content-Encoding: br`):
   *  the client reads the file's own bytes once it decodes them. */
  compress?: (file: string) => boolean
}

/** Whether an `Accept-Encoding` header accepts brotli: named, and not with a zero weight. */
function acceptsBrotli(header: string | undefined) {
  return (header ?? '').split(',').some((entry) => {
    const [name, ...parameters] = entry.split(';').map((part) => part.trim().toLowerCase())
    return name === 'br' && !parameters.some((p) => /^q=0(\.0*)?$/.test(p))
  })
}

/** Brotli as a local server can afford per request: quality 5 of 11 compresses tens of megabytes a
 *  second; a published tree carries its files compressed at the top quality (`site.yml`). */
const ON_THE_FLY = { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }

/** Serves the file `path` names under `dir`, a directory by its `index.html`; one byte range
 *  (`byteRange`) answers 206 with those bytes alone, never encoded. */
async function serveFile(
  dir: string,
  path: string,
  response: ServerResponse,
  { 'accept-encoding': acceptEncoding, range: rangeHeader }: IncomingMessage['headers'],
  { refuse, transform, compress }: StaticOptions,
) {
  let file = fileUnder(dir, path)
  if (file === null || refuse?.(file)) return reply(response, 403)
  let found = await stat(file)
  if (found.isDirectory()) found = await stat((file = resolve(file, 'index.html')))
  if (!found.isFile()) return reply(response, 404)
  const served = transform?.(file)
  if (served) return reply(response, 200, served.type, served.text)
  const range = byteRange(rangeHeader, found.size)
  if (range === null)
    return response
      .writeHead(416, { 'accept-ranges': 'bytes', 'content-range': `bytes */${found.size}` })
      .end()
  // The file is opened before the headers leave, so a file it cannot read is still a 404.
  const stream = createReadStream(file, range)
  await once(stream, 'open')
  // A client gone meanwhile closed the response: nothing may pipe onto it, the file closes now.
  if (response.destroyed) return stream.destroy()
  const encoded = compress?.(file),
    brotli = encoded && !range && acceptsBrotli(acceptEncoding)
  response.writeHead(range ? 206 : 200, {
    'content-type': contentType(extname(file)),
    'accept-ranges': 'bytes',
    ...(encoded && { vary: 'accept-encoding' }),
    ...(range && { 'content-range': `bytes ${range.start}-${range.end}/${found.size}` }),
    ...(brotli
      ? { 'content-encoding': 'br' }
      : { 'content-length': range ? range.end - range.start + 1 : found.size }),
  })
  // A read error past the headers destroys the response, so the socket never waits on it.
  if (brotli) pipeline(stream, createBrotliCompress(ON_THE_FLY), response, () => {})
  else pipeline(stream, response, () => {})
}

/** A server over `options.mounts`; a path no mount takes, or no file answers, is a 404. */
export function staticServer(options: StaticOptions = {}): Server {
  const { mounts = [], headers = {}, answer } = options
  const every = Object.entries(headers)
  return createServer((request, response) => {
    for (const [name, value] of every) response.setHeader(name, value)
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (answer?.(request, response, url)) return
    const mount = mounts.find(({ prefix }) => url.pathname.startsWith(prefix))
    if (!mount) return reply(response, 404)
    const path = url.pathname.slice(mount.prefix.length)
    serveFile(mount.dir, path, response, request.headers, options).catch(
      (error: NodeJS.ErrnoException) => {
        // A missing file is an ordinary 404; anything else (a transform that throws, a file it
        // may not read) is still a 404, but said, so the page's failed import has its cause.
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR')
          console.error(`static server: ${url.pathname}:`, error)
        if (!response.headersSent) reply(response, 404)
      },
    )
  })
}
