import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DIAGNOSTICS } from '#engine/packages/sdk-core/src/diagnostic/views.ts'
import { fetchWords, statsWords } from './words.ts'

test("the stats panel names the view modes in the kit's words, beside its own", async (t) => {
  const kit = {
    statsPanel: { 'control.view': { label: 'Picture', hint: 'What the world draws.' } },
    views: { beauty: 'Final image', xray: 'see-through' },
    viewHints: { xray: 'The edges of every triangle submitted.' },
  }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ kit })))
  await fetchWords('en')
  assert.deepEqual(statsWords(), {
    'control.view': { label: 'Picture', hint: 'What the world draws.' },
    'view.beauty': { label: 'Final image', hint: undefined },
    'view.xray': { label: 'see-through', hint: 'The edges of every triangle submitted.' },
  })
})

test("every view mode the engine lists is named in the kit's words, with what it shows", () => {
  const english = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8')) as {
    kit: { views: Record<string, string>; viewHints: Record<string, string> }
  }
  const modes = Object.keys(DIAGNOSTICS)
  assert.deepEqual(
    modes.filter((mode) => !english.kit.views[mode]),
    [],
    'a mode without kit.views shows its raw key in every language',
  )
  assert.deepEqual(
    modes.filter((mode) => mode !== 'beauty' && !english.kit.viewHints[mode]),
    [],
    'a mode without kit.viewHints shows the engine English hint',
  )
})
