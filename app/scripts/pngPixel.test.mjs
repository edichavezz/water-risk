import { describe, it, expect } from 'vitest'
import { deflateSync } from 'node:zlib'
import { decodePng } from './pngPixel.mjs'

/**
 * The audit harness reads its readings through this decoder, so a bug here
 * becomes a wrong conclusion about a live service — which is exactly what
 * happened once already: an unsupported bit depth made a healthy Copernicus
 * layer look dead. These cases pin the formats the WMS endpoints actually
 * serve: 8-bit RGBA (IDEE flood) and sub-byte palette (Copernicus drought).
 */

const CRC_TABLE = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, body) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(body.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([len, typed, crc])
}

/** Builds a PNG. `filters` defaults to filter type 0 on every scanline. */
function buildPng({ width, height, depth, colourType, scanlines, palette, trns, filters }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = depth
  ihdr[9] = colourType
  const raw = Buffer.concat(
    scanlines.map((line, i) =>
      Buffer.concat([Buffer.from([filters?.[i] ?? 0]), Buffer.from(line)]),
    ),
  )
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
  ]
  if (palette) parts.push(chunk('PLTE', Buffer.from(palette)))
  if (trns) parts.push(chunk('tRNS', Buffer.from(trns)))
  parts.push(chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}

/** Centre pixel, the only one `samplePixel` ever reads. */
function centre(img) {
  const x = Math.floor(img.width / 2)
  const y = Math.floor(img.height / 2)
  const i = (y * img.width + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]
}

describe('decodePng', () => {
  it('reads the centre pixel of an 8-bit RGBA image', () => {
    // 3x3, middle pixel opaque blue, everything else transparent — the shape
    // of an IDEE flood sample where the point falls inside the zone.
    const clear = [0, 0, 0, 0]
    const blue = [5, 38, 218, 255]
    const row = px => [...clear, ...px, ...clear]
    const png = buildPng({
      width: 3, height: 3, depth: 8, colourType: 6,
      scanlines: [row(clear), row(blue), row(clear)],
    })
    expect(centre(decodePng(png))).toEqual(blue)
  })

  it('reads a 2-bit palette image — the format Copernicus serves', () => {
    // Palette index 2 is the CDI "warning" orange. Four pixels per byte, so
    // the middle pixel of a 3-wide row lives in the middle 2 bits.
    const palette = [255, 255, 255, 240, 228, 66, 230, 159, 0, 220, 5, 12]
    const trns = [0, 255, 255, 255]
    const packed = (a, b, c) => [(a << 6) | (b << 4) | (c << 2)]
    const png = buildPng({
      width: 3, height: 3, depth: 2, colourType: 3, palette, trns,
      scanlines: [packed(0, 0, 0), packed(0, 2, 0), packed(0, 0, 0)],
    })
    expect(centre(decodePng(png))).toEqual([230, 159, 0, 255])
  })

  it('reads a 1-bit greyscale image at full scale, not near-black', () => {
    // A 1-bit "1" is white. Treating the raw sample as a 0-255 value would
    // make it (1,1,1) and misclassify every pixel.
    const png = buildPng({
      width: 3, height: 3, depth: 1, colourType: 0,
      scanlines: [[0b00000000], [0b01000000], [0b00000000]],
    })
    expect(centre(decodePng(png))).toEqual([255, 255, 255, 255])
  })

  it('undoes the Sub filter rather than returning raw bytes', () => {
    // Filter 1 stores each byte as a delta from the pixel one to its left.
    // Deltas of 10 per pixel decode to 10, 20, 30 — an unfiltered read would
    // give 10, 10, 10 and every colour match downstream would be wrong.
    const deltas = [
      10, 0, 0, 255,
      10, 0, 0, 0,
      10, 0, 0, 0,
    ]
    const img = decodePng(buildPng({
      width: 3, height: 1, depth: 8, colourType: 6,
      scanlines: [deltas], filters: [1],
    }))
    expect(centre(img)).toEqual([20, 0, 0, 255])
  })

  it('undoes the Up filter against the previous scanline', () => {
    const img = decodePng(buildPng({
      width: 1, height: 2, depth: 8, colourType: 6,
      scanlines: [[7, 8, 9, 200], [3, 3, 3, 55]],
      filters: [0, 2],
    }))
    // Row 1 = row 0 + deltas, and height 2 makes the centre row index 1.
    expect(centre(img)).toEqual([10, 11, 12, 255])
  })
})
