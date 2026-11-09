/** A ZIP archive written in one piece: each file deflated (`CompressionStream`, in the page as in
 *  Node), stored when that is no smaller, its date a fixed one. */
import { concat, encodeText, littleEndian } from './bytes.ts'

/** A file of the archive: its path in it, `/`-separated, and its bytes. */
export interface ZipEntry {
  path: string
  bytes: Uint8Array
}

/** 2026-01-01 00:00, as MS-DOS writes a time and a date: every entry's. */
const DOS_TIME = 0,
  DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

/** The CRC-32 table of the polynomial ZIP names (0xEDB88320, reflected). */
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/** The CRC-32 of `bytes`. */
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** `bytes` deflated, raw, as ZIP's method 8 holds them. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The ZIP archive of `entries`, in their order. */
export async function zip(entries: readonly ZipEntry[]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [],
    central: Uint8Array[] = []
  let offset = 0
  for (const { path, bytes } of entries) {
    const name = encodeText(path),
      deflated = await deflate(bytes),
      stored = deflated.length >= bytes.length,
      data = stored ? bytes : deflated
    // The fields a local header and a central one share, from the version needed on: version
    // 2.0, the name in UTF-8, the method, the date, the CRC, the sizes, the name's length and no
    // extra field.
    const common = littleEndian(
      [20, 2],
      [0x0800, 2],
      [stored ? 0 : 8, 2],
      [DOS_TIME, 2],
      [DOS_DATE, 2],
      [crc32(bytes), 4],
      [data.length, 4],
      [bytes.length, 4],
      [name.length, 2],
      [0, 2],
    )
    parts.push(littleEndian([0x04034b50, 4]), common, name, data)
    // Made by 2.0 (MS-DOS attributes); no comment, disk 0, no attributes, the local header's offset.
    central.push(
      littleEndian([0x02014b50, 4], [20, 2]),
      common,
      littleEndian([0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]),
      name,
    )
    offset += 4 + common.length + name.length + data.length
  }
  const directory = concat(central)
  const end = littleEndian(
    [0x06054b50, 4],
    [0, 2],
    [0, 2],
    [entries.length, 2],
    [entries.length, 2],
    [directory.length, 4],
    [offset, 4],
    [0, 2],
  )
  return concat([...parts, directory, end])
}
