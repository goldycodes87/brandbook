'use client'

/**
 * Get a camera photograph into a shape that will actually go through.
 *
 * A phone in a pasture produces an 8-9 MB JPEG, and sometimes a HEIC. Both
 * break the receipt scanner, for different reasons:
 *
 *   Size   Claude's per-image limit on the first-party API is 10 MB
 *          base64-encoded, and base64 inflates by a third. An 8.74 MB
 *          photograph arrives as 11.65 MB and is refused. A 7 MB one goes
 *          through. That is why it works some days.
 *
 *   HEIC   What an iPhone stores natively. The API accepts jpeg, png, webp
 *          and gif, and nothing else. Taking the picture inside the app
 *          usually yields JPEG; picking one from the library may not.
 *
 * Both are fixed in the same place: decode it here and re-encode as a JPEG
 * the right size before anything is sent.
 *
 * The long edge is capped at 1568px because that is the resolution Claude
 * downscales to anyway — sending more pixels costs upload time on a cell
 * connection and buys nothing. On the ranch's own photographs that is an
 * 8.74 MB file down to roughly 0.6 MB, which also matters on a bar of signal
 * at the far end of a pasture.
 */

export interface PreparedImage {
  blob: Blob
  /** Base64 without the data: prefix, ready for the API. */
  base64: string
  mediaType: 'image/jpeg' | 'image/png'
  width: number
  height: number
  originalBytes: number
  bytes: number
}

/**
 * For anything read by the model: Claude downscales past this anyway, so more
 * pixels cost upload time and buy nothing.
 */
export const EDGE_FOR_READING = 1568

/**
 * For a photograph of an animal, which is looked at by people rather than read
 * by a model. Bound by the screen and the bill rather than by an API limit, so
 * it keeps more detail — a brand or an ear notch stays legible when somebody
 * opens the picture full size a year from now. Still around a megabyte against
 * the nine the camera produced.
 */
export const EDGE_FOR_KEEPING = 2048

/**
 * For a logo or a brand mark. These are drawn at 38px in an email seal and at
 * about 120px on an invoice header, so a thousand pixels is already generous;
 * what matters is that a 4 MB PNG off a designer's machine stops being posted
 * through a function with a 4.5 MB body limit.
 */
export const EDGE_FOR_MARK = 1024

/** Comfortably inside the 10 MB base64 ceiling, with room for the overhead. */
const MAX_BYTES = 4_500_000

export interface PrepareOptions {
  /** Longest side in pixels. Defaults to EDGE_FOR_READING. */
  maxEdge?: number
  /** JPEG quality, 0-1. Defaults to 0.82. */
  quality?: number
  /**
   * Output format. Defaults to JPEG, which is right for a photograph and wrong
   * for a logo: JPEG has no alpha, so a transparent mark comes out as a white
   * box sitting on whatever it was placed over. Pass 'preserve' to keep PNG
   * input as PNG — and with it the transparency — while still resizing.
   */
  format?: 'jpeg' | 'preserve'
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap applies EXIF orientation, which an <img> does not do
  // consistently — without it a sideways receipt reaches Claude sideways.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Falls through: some browsers refuse HEIC here but can still render it.
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read on this device.')) }
    img.src = url
  })
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('That image could not be read on this device.'))
    r.readAsDataURL(blob)
  })
}

export async function prepareImage(file: File, opts: PrepareOptions = {}): Promise<PreparedImage> {
  const maxEdge = opts.maxEdge ?? EDGE_FOR_READING

  // PNG only where the caller asked for it AND the source is one, so a
  // photograph never accidentally comes back as a 6 MB lossless file.
  const keepPng = opts.format === 'preserve' && file.type === 'image/png'
  const outType: 'image/jpeg' | 'image/png' = keepPng ? 'image/png' : 'image/jpeg'

  const source = await decode(file)
  const sw = 'width'  in source ? source.width  : 0
  const sh = 'height' in source ? source.height : 0
  if (!sw || !sh) throw new Error('That image has no size this device can read.')

  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This device would not give us a canvas to work on.')
  // White underneath, in case a transparent PNG ever comes through: a receipt
  // on a transparent ground renders as black-on-black once flattened to JPEG.
  // Skipped when the output keeps its alpha, which is the whole point there.
  if (!keepPng) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h)
  if ('close' in source) source.close()

  const encode = (quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('That image could not be converted on this device.'))),
        outType,
        quality,
      )
    })

  // Almost always one pass. The loop is for the odd photograph that stays
  // large at this resolution rather than for the common case. PNG ignores the
  // quality argument, so there is nothing to step down and one pass is all.
  const first = opts.quality ?? 0.82
  let blob = await encode(first)
  if (!keepPng) {
    for (const q of [0.7, 0.55, 0.4].filter(q => q < first)) {
      if (blob.size <= MAX_BYTES) break
      blob = await encode(q)
    }
  }

  return {
    blob,
    base64: await toBase64(blob),
    mediaType: outType,
    width: w,
    height: h,
    originalBytes: file.size,
    bytes: blob.size,
  }
}

/**
 * The same preparation, for a file that is about to be read by the model and
 * might be a PDF.
 *
 * A PDF is passed through untouched: it is not an image, the canvas cannot
 * decode it, and the API's document limit is 32 MB rather than the 10 MB it
 * allows an image — so the thing that breaks photographs does not apply. An
 * image goes through prepareImage and comes back as a JPEG inside the ceiling.
 */
export async function prepareForReading(
  file: File,
): Promise<{ base64: string; mediaType: string; bytes: number; originalBytes: number }> {
  if (file.type === 'application/pdf') {
    return {
      base64: await toBase64(file),
      mediaType: 'application/pdf',
      bytes: file.size,
      originalBytes: file.size,
    }
  }

  const img = await prepareImage(file, { maxEdge: EDGE_FOR_READING })
  return {
    base64: img.base64,
    mediaType: img.mediaType,
    bytes: img.bytes,
    originalBytes: img.originalBytes,
  }
}
