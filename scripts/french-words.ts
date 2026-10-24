// The French strings `check:english` (`scripts/check-english.ts`) leaves uncounted in the site's
// code. The words it counts, and the shape of an exception, are the engine's
// (`scripts/check/french-words.ts`).
import type { FrenchException } from '#engine/scripts/check/french-words.ts'

const PERF_FORMAT: FrenchException = {
  reason:
    'a key of the bench perf measurement format (`#engine/bench/kit/measureTypes.ts`), written by ' +
    '`bench/core/measure.ts` and `bench/perf`, read by `bench/runner/perf`, `bench/oracles` and ' +
    "`site/examples/kit/verdict.ts`, and stored in each machine's `.mesure/baselines`: listed " +
    'until renamed together with its readers',
  files: /^(?:bench\/(?:core|perf|oracles|runner\/perf)\/|site\/examples\/kit\/)/,
}

/** The format's keys holding a counted word, excepted only where they are keys (`.key`, `key:`,
 *  `key?:`, `'key'`) in the files of the format: the same word elsewhere is counted. */
const PERF_KEYS = ['medianeMs', 'temoin', 'ecartTemoin', 'ecartBaseline', 'fichier', 'resultats']

/** The French strings that must stay, not counted. Each is matched literally, never inside a longer
 *  name. */
export const FRENCH_EXCEPTIONS: Record<string, FrenchException> = {
  ...Object.fromEntries(
    PERF_KEYS.flatMap((key) => [`.${key}`, `${key}:`, `${key}?:`, `'${key}'`]).map((form) => [
      form,
      PERF_FORMAT,
    ]),
  ),
  '.mesure': {
    reason:
      'the measurement folder outside Git (`bench/core/paths.ts`, `.gitignore`, AGENTS.md rule 10): ' +
      'every machine and worktree keeps its bench assets there, which no script can fetch again',
  },
  'atlas-couleur': {
    reason:
      'a fixture folder and file name (`tests/fixtures/formats/previews/atlas-couleur`) read by the ' +
      'texture preview tests of the asset compiler',
  },
}
