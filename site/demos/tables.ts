/**
 * The enum pages show the engine's own tables, read from the bundle at load time: what the
 * page displays cannot drift from what the engine holds, because it is the same object.
 */
import {
  COLUMN_KIND,
  DIAGNOSTICS,
  IDENTITY_MATRIX4,
  LOD_QUALITY,
  adaptivePixelError,
  lodQuality,
} from './engine.ts'
import { formatNumber, matrixView, slider, valueView, verdictView } from './kit.ts'
import type { DemoDef } from './kit.ts'

export const TABLE_DEMOS: Record<string, DemoDef> = {
  IDENTITY_MATRIX4: {
    run() {
      return [
        matrixView(
          'the constant itself, read from the engine',
          IDENTITY_MATRIX4,
          'read and never written',
        ),
      ]
    },
  },
  DiagnosticMode: {
    run() {
      return [
        valueView(
          'DIAGNOSTICS — the engine says which modes it can produce, and why not',
          Object.entries(DIAGNOSTICS).map(([mode, capability]): [string, string] => [
            mode,
            `${capability.available ? 'available' : 'unavailable'} — ${capability.reason}`,
          ]),
        ),
      ]
    },
  },
  LodQualityId: {
    controls: [
      slider('speed', 'camera speed (m/s)', 0, 40, 0, 0.5),
      slider('radius', 'radius of what is on screen (m)', 1, 200, 30, 1),
    ],
    run(state) {
      const rows = Object.values(LOD_QUALITY).map((quality): [string, string] => [
        quality.id,
        `${quality.label} — pixelError ${quality.pixelError}, anisotropy ${quality.anisotropy}${quality.adaptive ? ', adaptive' : ''}`,
      ])
      const base = lodQuality('adaptive').pixelError
      const adapted = adaptivePixelError(base, state.speed, state.radius)
      return [
        valueView('LOD_QUALITY, as the engine holds it', rows),
        valueView('adaptivePixelError(base, speed, radius) on the adaptive preset', [
          ['base', formatNumber(base)],
          ['threshold at this speed', formatNumber(adapted)],
          ['note', 'a still view keeps the base; a moving view may coarsen'],
        ]),
      ]
    },
  },
  ColumnKind: {
    run() {
      const kinds: Record<string, string[]> = {}
      for (const [column, kind] of Object.entries(COLUMN_KIND)) (kinds[kind] ??= []).push(column)
      return [
        valueView(
          'COLUMN_KIND — every column of the binary manifest, by storage',
          Object.entries(kinds).map(([kind, columns]): [string, string] => [
            kind,
            columns.join(', '),
          ]),
        ),
      ]
    },
  },
}
