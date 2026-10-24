import type { StatsCorner } from '#engine/packages/sdk-browser/src/modules/stats/index.ts'
import { make } from './dom.ts'
import { hideable, overlay } from './overlay.ts'

/** The classes of each corner the panel may sit in, for the examples' card (`statsCard`). */
const statsCorners: Record<StatsCorner, string> = {
  'bottom-left': 'bottom-3 start-3',
  'top-left': 'top-3 start-3',
  'bottom-right': 'bottom-3 end-3',
  'top-right': 'top-3 end-3',
}

/** The look of the card, of its labels and of its values. */
const STATS_CARD =
  'pointer-events-none absolute grid grid-cols-[auto_auto] gap-x-3 rounded-box bg-base-100/60 px-3 py-2 font-mono text-[11px] leading-4 opacity-90 backdrop-blur'
const STATS_TERM = 'opacity-70'
const STATS_VALUE = 'text-end tabular-nums'

/**
 * A card of label and value lines in a corner of the example, at the bottom left unless `corner`
 * says otherwise; what it returns replaces its lines, a value given a class (a colour) by the
 * third item of its line.
 */
export function statsCard(corner: StatsCorner = 'bottom-left') {
  const card = make('dl', `${STATS_CARD} ${statsCorners[corner]}`)
  overlay().append(card)
  hideable(card)
  return (lines: readonly (readonly [string, string, string?])[]) =>
    card.replaceChildren(
      ...lines.flatMap(([label, value, tone = '']) => [
        make('dt', STATS_TERM, label),
        make('dd', `${STATS_VALUE} ${tone}`, value),
      ]),
    )
}
