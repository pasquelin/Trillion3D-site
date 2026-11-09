/** Bytes as the project's files are written from: joined, encoded, and fields in little endian. */

/** `parts` one after the other. */
export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** `text` in UTF-8. */
export const encodeText = (text: string) => new TextEncoder().encode(text)

/** The unsigned `fields`, each `[value, bytes]` with `bytes` 2 or 4, in little endian. */
export function littleEndian(...fields: [value: number, bytes: 2 | 4][]): Uint8Array {
  const out = new Uint8Array(fields.reduce((sum, [, bytes]) => sum + bytes, 0)),
    view = new DataView(out.buffer)
  let at = 0
  for (const [value, bytes] of fields) {
    if (bytes === 2) view.setUint16(at, value, true)
    else view.setUint32(at, value, true)
    at += bytes
  }
  return out
}
