// Spine colors: try the real cover color first, otherwise use a lively palette.

export const SPINE_PALETTE = [
  '#e76f51', // coral
  '#e9b44c', // mustard
  '#2a9d8f', // teal
  '#3d5a80', // navy
  '#7fb2d9', // sky blue
  '#b5446e', // raspberry
  '#6d597a', // plum
  '#8fb38a', // sage
  '#c8553d', // terracotta
  '#9d8cd6', // lavender
]

// The same book always gets the same palette color.
export function pickPaletteColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SPINE_PALETTE[h % SPINE_PALETTE.length]
}

export function isDarkColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

// Already-known result (or undefined if we haven't looked yet)
export function peekCoverColor(url: string): string | null | undefined {
  return url ? cache.get(url) : null
}

// Find the dominant color of a cover image. Returns null if it can't be read
// (the image blocks it, or it's basically white or grey).
export function extractCoverColor(url: string): Promise<string | null> {
  if (!url) return Promise.resolve(null)
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null)
  const existing = pending.get(url)
  if (existing) return existing

  const p = new Promise<string | null>(resolve => {
    const done = (c: string | null) => { cache.set(url, c); resolve(c) }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => done(null)
    img.onload = () => {
      try {
        const W = 32, H = 48
        const canvas = document.createElement('canvas')
        canvas.width = W; canvas.height = H
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return done(null)
        ctx.drawImage(img, 0, 0, W, H)
        const data = ctx.getImageData(0, 0, W, H).data

        // Group pixels into coarse color buckets; favour colorful ones.
        const buckets = new Map<number, { r: number; g: number; b: number; n: number; w: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 128) continue
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          if (min > 235) continue // ignore near-white paper
          const sat = max === 0 ? 0 : (max - min) / max
          const key = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6)
          const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, w: 0 }
          bk.r += r; bk.g += g; bk.b += b; bk.n += 1; bk.w += 0.2 + sat
          buckets.set(key, bk)
        }
        let best: { r: number; g: number; b: number; n: number; w: number } | null = null
        buckets.forEach(bk => { if (!best || bk.w > best.w) best = bk })
        const top = best as { r: number; g: number; b: number; n: number; w: number } | null
        if (!top || top.n < 12) return done(null)

        let r = top.r / top.n, g = top.g / top.n, b = top.b / top.n
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        if (lum > 215) return done(null) // too pale to see on the shelf
        if (lum < 40) { r += (255 - r) * 0.14; g += (255 - g) * 0.14; b += (255 - b) * 0.14 } // lift near-black
        done(toHex(r, g, b))
      } catch {
        done(null) // image doesn't allow reading its pixels
      }
    }
    img.src = url
  })
  pending.set(url, p)
  return p
}
