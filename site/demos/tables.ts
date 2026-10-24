/**
 * The enum pages show the engine's own tables, read from the bundle at load time: what the
 * page displays cannot drift from what the engine holds, because it is the same object.
 */
import { COLUMN_KIND, DIAGNOSTICS, IDENTITY_MATRIX4, LOD_QUALITY } from './engine.ts'
import { matrixView, valueView } from './kit.ts'
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
    run() {
      const rows = Object.values(LOD_QUALITY).map((quality): [string, string] => [
        quality.id,
        `${quality.label} — pixelError ${quality.pixelError}, anisotropy ${quality.anisotropy}`,
      ])
      return [valueView('LOD_QUALITY, as the engine holds it', rows)]
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
