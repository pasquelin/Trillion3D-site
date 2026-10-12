import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Synchronous configuration readers keep their contract without buffering child stdout. */
export function gitPathsSync(args: string[], cwd = process.cwd()): string[] {
  const directory = mkdtempSync(join(tmpdir(), 'geometry-git-output-'))
  let descriptor: number | undefined
  try {
    const output = join(directory, 'paths')
    descriptor = openSync(output, 'w')
    execFileSync('git', args, { cwd, stdio: ['ignore', descriptor, 'inherit'] })
    return readFileSync(output, 'utf8').split('\0').filter(Boolean)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    rmSync(directory, { recursive: true, force: true })
  }
}

/** Fails unless git tracks none of `paths` and its ignore rules name every one, on disk or not. */
export function assertUntracked(paths: string[], cwd = process.cwd()): void {
  assert.deepEqual(gitPathsSync(['ls-files', '-z', '--', ...paths], cwd), [], 'tracked')
  assert.deepEqual(ignoredPaths(paths, cwd, true), paths, 'not ignored')
}

/** The `paths` git's ignore rules name, in one call; a tracked one only `noIndex`. */
export function ignoredPaths(paths: string[], cwd = process.cwd(), noIndex = false): string[] {
  const index = noIndex ? ['--no-index'] : []
  const { stdout } = spawnSync('git', ['check-ignore', ...index, '--stdin', '-z'], {
    cwd,
    input: paths.join('\0'),
    encoding: 'utf8',
    // A large batch of paths is never cut at the default output limit.
    maxBuffer: Infinity,
  })
  // No output when git cannot run there (a folder removed since): none is ignored.
  return (stdout ?? '').split('\0').filter(Boolean)
}
