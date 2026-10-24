import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { gitPathsSync } from '#engine/scripts/git/git-paths.ts'

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
