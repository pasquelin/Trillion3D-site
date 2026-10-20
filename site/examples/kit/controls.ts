import { hideable, overlay } from './overlay.ts'
import { perFrame } from './perFrame.ts'
import { exampleWord, kitWord, labelOf } from './words.ts'

// The declared settings and their values are the bench kit's (`bench/kit/index.ts`): one home.
import type { ControlSpec, ControlValues } from '#engine/bench/kit/index.ts'
export type { ControlSpec, ControlValues }

/** One control as the panel draws it. */
type Control =
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number }
  | { kind: 'colour'; key: string; label: string }
  | { kind: 'note'; key: string; label: string; text: string }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'choice'; key: string; label: string; options: readonly string[]; shown: string[] }
  | { kind: 'button'; key: string; label: string; press: () => void }

const isSlider = (spec: readonly (number | string)[]): spec is readonly number[] =>
  typeof spec[0] === 'number'

/** A control's label: the example's word for its key, else, for a numbered key (`lamp2`), the
 * word for its stem and the number, else the key humanised. */
function labelFor(key: string) {
  const [, stem = '', number] = /^(.*?)(\d+)$/.exec(key) ?? []
  const numbered = number && exampleWord('', 'controls', stem)
  return exampleWord(numbered ? `${numbered} ${number}` : labelOf(key), 'controls', key)
}

/** Reads the declared specs into the controls to draw and the values they start at. Labels,
 * choices and notes read in the page's language (`<id>.controls.<key>`,
 * `<id>.choices.<key>.<value>`); the values stay the declared identifiers. */
function describe(specs: Record<string, ControlSpec>) {
  const controls: Control[] = []
  const values: Record<string, number | string | boolean> = {}
  for (const [key, spec] of Object.entries(specs)) {
    const label = labelFor(key)
    if (typeof spec === 'function') controls.push({ kind: 'button', key, label, press: spec })
    else if (typeof spec === 'boolean') {
      controls.push({ kind: 'toggle', key, label })
      values[key] = spec
    } else if (typeof spec === 'string' && !spec.startsWith('#'))
      controls.push({ kind: 'note', key, label, text: exampleWord(spec, 'controls', key) })
    else if (typeof spec === 'string') {
      if (!/^#[0-9a-f]{6}$/i.test(spec)) throw new Error(`${key}: a colour is '#rrggbb'`)
      controls.push({ kind: 'colour', key, label })
      values[key] = spec.toLowerCase()
    } else if (isSlider(spec)) {
      const [min, max, value, step = 10 ** Math.floor(Math.log10((max - min) / 100))] = spec
      if (!(min < max) || value < min || value > max)
        throw new Error(`${key}: a slider is [min, max, value], the value between the two`)
      controls.push({ kind: 'slider', key, label, min, max, step })
      values[key] = value
    } else {
      if (!spec.length) throw new Error(`${key}: a choice needs at least one option`)
      const shown = spec.map((option) => exampleWord(option, 'choices', key, option))
      controls.push({ kind: 'choice', key, label, options: spec, shown })
      values[key] = spec[0]
    }
  }
  return { controls, values }
}

/** A slider's value as printed beside it: as many decimals as its step carries, three at most. */
function printed(value: number, step: number): string {
  let decimals = 0
  while (decimals < 3 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-9)
    decimals++
  return value.toFixed(decimals)
}

function field(control: Control, values: Record<string, unknown>, changed: () => void) {
  const run = perFrame(changed, requestAnimationFrame)
  // A drag's `input` runs once a frame; the `change` that ends it, or a click, at once.
  const set = (value: unknown, now = true) => {
    values[control.key] = value
    run(now)
  }
  if (control.kind === 'note') {
    const line = document.createElement('p')
    line.className = 'text-xs opacity-80'
    line.textContent = control.text
    return line
  }
  if (control.kind === 'button') {
    const button = document.createElement('button')
    button.className = 'btn btn-xs btn-primary btn-outline w-full'
    button.textContent = control.label
    button.onclick = control.press
    return button
  }
  const row = document.createElement('label')
  row.className = 'flex items-center gap-2'
  const name = document.createElement('span')
  name.className = 'w-24 shrink-0 truncate text-xs'
  name.textContent = control.label
  row.append(name)
  if (control.kind === 'choice') {
    const select = document.createElement('select')
    select.className = 'select select-xs min-w-0 flex-1'
    select.append(...control.options.map((option, at) => new Option(control.shown[at], option)))
    select.onchange = () => {
      set(select.value)
      select.blur() // the keys back to the scene: a focused list takes W and the arrows
    }
    row.append(select)
    return row
  }
  const input = document.createElement('input')
  row.append(input)
  if (control.kind === 'toggle') {
    input.type = 'checkbox'
    input.className = 'toggle toggle-xs toggle-primary'
    input.checked = Boolean(values[control.key])
    input.onchange = () => set(input.checked)
  } else if (control.kind === 'colour') {
    input.type = 'color'
    input.className = 'h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0'
    input.value = String(values[control.key])
    input.oninput = () => set(input.value, false)
    input.onchange = () => set(input.value)
  } else {
    const { min, max, step } = control
    Object.assign(input, { type: 'range', min, max, step, value: values[control.key] })
    input.className = 'range range-xs range-primary min-w-0 flex-1'
    const shown = document.createElement('output')
    shown.className = 'w-10 text-right text-xs tabular-nums'
    const show = () => (shown.textContent = printed(input.valueAsNumber, step))
    input.oninput = () => (show(), set(input.valueAsNumber, false))
    input.onchange = () => set(input.valueAsNumber)
    show()
    row.append(shown)
  }
  return row
}

type OnChange<Specs> = (values: ControlValues<Specs>, key?: keyof ControlValues<Specs>) => void

/**
 * A settings panel in the top-right corner of the example, one row per declared control. The
 * returned object holds the live values; `onChange(values, key)` runs once at start, with no
 * key, then after every change. The page hosting the example shows or hides it, and the stats
 * corner (`stats.ts`), by posting `{ type: 'trillion3d:controls', visible }`; standalone, they
 * are shown.
 */
export function controls<const Specs extends Record<string, ControlSpec>>(
  specs: Specs,
  onChange: OnChange<Specs> = () => {},
): ControlValues<Specs> {
  const { controls: declared, values } = describe(specs)
  const live = values as ControlValues<Specs>
  const box = document.createElement('details')
  box.className =
    'pointer-events-auto absolute top-3 end-3 w-64 max-w-[calc(100vw-1.5rem)] card bg-base-100/85 text-sm shadow-xl backdrop-blur'
  box.toggleAttribute('open', innerWidth >= 640)
  const title = document.createElement('summary')
  title.className = 'cursor-pointer select-none px-3 py-2 font-semibold'
  title.textContent = kitWord('panel', 'controls')
  const rows = document.createElement('div')
  rows.className = 'flex flex-col gap-2 px-3 pb-3'
  rows.dataset.rows = ''
  for (const control of declared)
    rows.append(field(control, values, () => onChange(live, control.key as never)))
  box.append(title, rows)
  overlay().append(box)
  hideable(box)
  onChange(live)
  return live
}

/** What `viewModes` needs of a world: its view mode and its cut's freeze, read and written, and
 * its frame hook. */
interface ViewWorld {
  diagnostic: { mode: string; freeze: boolean; readonly modes: readonly string[] }
  onFrame(hook: () => void): unknown
  invalidate(): void
}

/** The view modes `world` offers, `triangles` left out: the page's alias of `wireframe`. */
const offeredModes = (world: ViewWorld) =>
  world.diagnostic.modes.filter((mode) => mode !== 'triangles')

/**
 * A `View` row at the foot of the controls panel, declared after `controls` like a readout: one
 * choice for each view mode the world offers (`world.diagnostic.modes`), the normal image
 * (`beauty`) first, each named in the page's language (`kit.views.<mode>`), and under it, while a
 * mode other than `beauty` is on, what its colours mean (`kit.viewHints.<mode>`). The row shows
 * the world's mode, whoever set it: it is read again when the list is opened. The world knows its
 * modes once its session opens: the list is read again at each frame until they come, then that
 * hook removes itself, so the row costs the frames after nothing. A mode the session refuses (the
 * world keeps the mode it had and says why on the console) is greyed out. Below, a `Freeze culling`
 * toggle (`kit.panel.freeze`) holds the cut — its levels, HLOD, frustum and occlusion — at the
 * camera of that moment (`world.diagnostic.freeze`): stepping aside in the `xray` view then shows
 * what it submitted and what it dropped.
 */
export function viewModes(world: ViewWorld) {
  const panel = overlay().querySelector('[data-rows]')
  if (!panel) throw new Error('viewModes: declare the controls first')
  const values: Record<string, unknown> = {}
  const refused = new Set<string>()
  const hint = document.createElement('p')
  hint.className = 'text-xs opacity-80'
  const paint = () => {
    const mode = world.diagnostic.mode
    values.view = mode
    const select = line.querySelector('select')
    if (select) {
      select.value = mode
      for (const option of select.options) option.disabled = refused.has(option.value)
    }
    hint.textContent = mode === 'beauty' ? '' : kitWord('viewHints', mode, '')
    hint.hidden = !hint.textContent
  }
  const row = (modes: readonly string[]) => {
    const shown = modes.map((mode) => kitWord('views', mode))
    const label = kitWord('panel', 'view')
    const control: Control = { kind: 'choice', key: 'view', label, options: modes, shown }
    const next = field(control, values, () => {
      const asked = String(values.view)
      world.diagnostic.mode = asked
      if (world.diagnostic.mode !== asked) refused.add(asked)
      paint()
      world.invalidate()
    })
    next.querySelector('select')?.addEventListener('pointerdown', paint)
    return next
  }
  let modes = offeredModes(world)
  let line = row(modes)
  values.freeze = world.diagnostic.freeze
  const freeze = field(
    { kind: 'toggle', key: 'freeze', label: kitWord('panel', 'freeze') },
    values,
    () => {
      world.diagnostic.freeze = Boolean(values.freeze)
      world.invalidate()
    },
  )
  panel.append(line, hint, freeze)
  paint()
  // Before the session publishes its modes, the world offers `beauty` alone, its first frame
  // included: the hook waits for the list, then removes itself.
  const unhook = world.onFrame(() => {
    const now = offeredModes(world)
    if (now.join() === modes.join()) return
    if (typeof unhook === 'function') unhook()
    modes = now
    const next = row(modes)
    line.replaceWith(next)
    line = next
    paint()
  })
}
