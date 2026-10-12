import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { gitPathsSync } from './git-paths.ts'
import { ROOT } from './engine.ts'

/** The maintained files of the checkout `directory` (tracked or new, never ignored), that exist on
 *  disk; null outside a Git checkout. The site's by default; `ENGINE` gives the engine's. */
export function repositoryFiles(directory = ROOT): string[] | null {
  if (!existsSync(resolve(directory, '.git'))) return null
  return [
    ...new Set(
      gitPathsSync(['ls-files', '-co', '--exclude-standard', '-z'], directory).filter((file) =>
        existsSync(resolve(directory, file)),
      ),
    ),
  ]
}
