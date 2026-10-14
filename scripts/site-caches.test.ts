import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { downloadPath, fetchDownload, sha256Of } from './site-caches.ts'

const LOGS = resolve(import.meta.dirname, '../.worktrees/logs')

test('a downloaded source is kept only when its bytes hash to the declared sha256', (t) => {
  mkdirSync(LOGS, { recursive: true })
  const root = mkdtempSync(join(LOGS, 'site-caches-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const release = join(root, 'release')
  mkdirSync(release)
  const bytes = Buffer.from('a scene too heavy for git')
  writeFileSync(join(release, 'scene.glb'), bytes)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const from = `${pathToFileURL(release).href}/`

  const good = { file: 'scene.glb', sha256 }
  fetchDownload(good, root, from)
  assert.equal(sha256Of(downloadPath(good, root)), sha256)
  assert.deepEqual(readFileSync(downloadPath(good, root)), bytes)

  rmSync(join(release, 'scene.glb'))
  fetchDownload(good, root, from)
  assert.ok(existsSync(downloadPath(good, root)), 'a file of the right hash is not fetched again')

  writeFileSync(join(release, 'other.glb'), 'other bytes')
  const bad = { file: 'other.glb', sha256 }
  assert.throws(() => fetchDownload(bad, root, from), /other\.glb: sha256 [0-9a-f]{64}, not /)
  assert.ok(!existsSync(downloadPath(bad, root)), 'refused bytes are not kept')
  assert.ok(!existsSync(`${downloadPath(bad, root)}.part`))

  const missing = { file: 'missing.glb', sha256 }
  assert.throws(() => fetchDownload(missing, root, from), /missing\.glb: download failed/)
})
