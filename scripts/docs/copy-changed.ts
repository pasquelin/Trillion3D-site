import { copyFileSync, mkdirSync, statSync, utimesSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Copies the file `from` to `to` unless `to` already is its copy: same size and same time, to the
 * whole millisecond (a time set from a `Date` keeps no finer one). The copy takes the time of
 * `from`, so what is compiled or served from it stays as fresh as its source.
 */
export function copyChanged(from: string, to: string): void {
  const source = statSync(from),
    target = statSync(to, { throwIfNoEntry: false })
  if (
    target &&
    target.size === source.size &&
    Math.floor(target.mtimeMs) === Math.floor(source.mtimeMs)
  )
    return
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  utimesSync(to, source.atime, source.mtime)
}
