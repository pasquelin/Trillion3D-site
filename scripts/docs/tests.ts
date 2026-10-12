/**
 * The site's unit tests: every `*.test.ts` the repository maintains, under `node --test`, two at a
 * time locally (`TRILLION3D_TEST_CONCURRENCY` overriding) and at full parallelism in the CI. They
 * read the site's sources and the pinned engine (`.engine/`, `scripts/engine.ts`); the API files
 * they read are written first when a source is newer.
 */
import { spawnSync } from 'node:child_process'
import { generateApiFiles } from '../generate-api-reference.ts'
import { heavyStep } from '../heavy-lock.ts'
import { repositoryFiles } from '../repository-files.ts'

/** Whether `file`, a path from the root, is a unit test of the site. */
export const isUnitTest = (file: string) => /^(?:scripts|site|tests)\/.*\.test\.m?ts$/.test(file)

const tests = (repositoryFiles() ?? []).filter(isUnitTest).sort()
if (!tests.length) throw new Error('No unit test found.')
console.log(`Unit tests: ${tests.length}`)
await generateApiFiles()
const concurrency = process.env.CI
  ? []
  : [`--test-concurrency=${process.env.TRILLION3D_TEST_CONCURRENCY || '2'}`]
await heavyStep('test', () => {
  const { status, error } = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--test', ...concurrency, ...tests],
    { stdio: 'inherit' },
  )
  if (error) throw error
  if (status !== 0) process.exit(status ?? 1)
})
