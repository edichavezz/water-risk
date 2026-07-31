/**
 * Minimal PNG decoder + the two browser APIs `services/wmsSample.ts` needs.
 *
 * The audit harness runs the app's real service modules under Node, and
 * `samplePixel` reads its pixel through `createImageBitmap` and
 * `OffscreenCanvas` — neither of which Node has. Rather than reimplement the
 * sampling (which would audit a copy of the logic instead of the logic), this
 * supplies just enough of those two APIs for the real code path to run.
 *
 * Only what WMS GetMap actually returns is supported: bit depths 1/2/4/8/16,
 * colour types 0/2/3/4/6, no interlacing. Sub-byte depths are not optional —
 * Copernicus EDO serves the drought layer as a 1-bit palette PNG, and a
 * decoder that rejects it reports a healthy service as a dead one.
 */
import { inflateSync } from 'node:zlib'

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decodes a PNG buffer to `{ width, height, data }` with RGBA8 `data`. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')

  let width = 0
  let height = 0
  let depth = 0
  let colourType = 0
  let interlace = 0
  let palette = null
  let trns = null
  const idat = []

  let off = 8
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const body = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      depth = body[8]
      colourType = body[9]
      interlace = body[12]
    } else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') trns = body
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    off += len + 12
  }

  if (![1, 2, 4, 8, 16].includes(depth)) throw new Error(`unsupported PNG bit depth ${depth}`)
  if (interlace !== 0) throw new Error('interlaced PNG not supported')

  const ch = CHANNELS[colourType]
  if (!ch) throw new Error(`unsupported PNG colour type ${colourType}`)

  const raw = inflateSync(Buffer.concat(idat))
  // Filtering works on bytes, so the filter unit is the byte count per pixel
  // rounded up — 1 for every sub-byte depth (PNG spec §9.2).
  const bpp = Math.max(1, Math.ceil((ch * depth) / 8))
  const stride = Math.ceil((width * ch * depth) / 8)
  const px = Buffer.alloc(height * stride)

  // Undo the per-scanline filter (PNG spec §9.2).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    const out = px.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0
      const b = prev ? prev[i] : 0
      const c = prev && i >= bpp ? prev[i - bpp] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) v += paeth(a, b, c)
      out[i] = v & 0xff
    }
  }

  /** Sample `c` of pixel (`x`,`y`), at whatever bit depth the file uses. */
  const sample = (x, y, c) => {
    const idx = x * ch + c
    if (depth === 8) return px[y * stride + idx]
    if (depth === 16) return px[y * stride + idx * 2] // high byte is enough
    const bit = idx * depth
    const byte = px[y * stride + (bit >> 3)]
    return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1)
  }
  // Greyscale at a sub-byte depth stores a fraction of full scale, not a
  // 0–255 value: 1-bit "1" is white, not near-black.
  const maxVal = (1 << depth) - 1
  const grey = v => (depth === 8 || depth === 16 ? v : Math.round((v / maxVal) * 255))

  // Normalise every colour type to RGBA8.
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4
      if (colourType === 3) {
        const idx = sample(x, y, 0)
        data[d] = palette[idx * 3]
        data[d + 1] = palette[idx * 3 + 1]
        data[d + 2] = palette[idx * 3 + 2]
        data[d + 3] = trns && idx < trns.length ? trns[idx] : 255
      } else if (colourType === 0 || colourType === 4) {
        data[d] = data[d + 1] = data[d + 2] = grey(sample(x, y, 0))
        data[d + 3] = colourType === 4 ? grey(sample(x, y, 1)) : 255
      } else {
        data[d] = sample(x, y, 0)
        data[d + 1] = sample(x, y, 1)
        data[d + 2] = sample(x, y, 2)
        data[d + 3] = colourType === 6 ? sample(x, y, 3) : 255
      }
    }
  }

  return { width, height, data }
}

/** Installs `createImageBitmap` and `OffscreenCanvas` on globalThis. */
export function installCanvasShims() {
  globalThis.createImageBitmap = async blob => {
    const img = decodePng(Buffer.from(await blob.arrayBuffer()))
    return { ...img, close() {} }
  }

  globalThis.OffscreenCanvas = class {
    constructor(w, h) {
      this.width = w
      this.height = h
      this._img = null
    }
    getContext(kind) {
      if (kind !== '2d') return null
      const self = this
      return {
        drawImage(img) {
          self._img = img
        },
        getImageData(x, y, w, h) {
          const src = self._img
          const out = new Uint8ClampedArray(w * h * 4)
          for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
              const s = ((y + j) * src.width + (x + i)) * 4
              out.set(src.data.subarray(s, s + 4), (j * w + i) * 4)
            }
          }
          return { data: out }
        },
      }
    }
  }
}
