export type CompressImageOptions = {
  maxWidth: number
  quality?: number
  /** Fills the canvas before drawing — use #ffffff for logos with transparency. */
  backgroundColor?: string
}

function enableHighQualityCanvasDraw(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
}

/** Resize and compress an image file to a JPEG data URL. */
export function compressImageToDataUrl(
  file: File,
  options: CompressImageOptions,
): Promise<string> {
  const { maxWidth, quality = 0.72, backgroundColor } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        if (backgroundColor) {
          ctx.fillStyle = backgroundColor
          ctx.fillRect(0, 0, width, height)
        }

        enableHighQualityCanvasDraw(ctx)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

/** Logo upload: white backing so transparent PNGs do not turn black in JPEG. */
export function compressLogoToDataUrl(file: File, maxWidth = 320): Promise<string> {
  return compressImageToDataUrl(file, {
    maxWidth,
    quality: 0.78,
    backgroundColor: "#ffffff",
  })
}

/** Profile photo — light backing for transparent sources; sized for sharp 88–100px display / PDF. */
export function compressProfilePhotoToDataUrl(file: File, maxWidth = 400): Promise<string> {
  return compressImageToDataUrl(file, {
    maxWidth,
    quality: 0.92,
    backgroundColor: "#ffffff",
  })
}

const TRANSPARENT_IMAGE_MIME = /^data:image\/(png|webp|gif|svg\+xml|bmp)/i

/** True when a data URL may have alpha (html2canvas often rasterizes these as black). */
export function imageDataUrlMayHaveTransparency(dataUrl: string): boolean {
  const trimmed = dataUrl.trim()
  if (!trimmed.startsWith("data:image/")) return false
  return TRANSPARENT_IMAGE_MIME.test(trimmed)
}

/**
 * Composite a data URL onto a solid background (default white) for PDF / JPEG storage.
 * No-op for opaque JPEGs from {@link compressLogoToDataUrl}.
 */
export function flattenImageDataUrl(
  dataUrl: string,
  options: {
    backgroundColor?: string
    maxWidth?: number
    quality?: number
  } = {},
): Promise<string> {
  const trimmed = dataUrl.trim()
  if (!trimmed) return Promise.resolve(trimmed)
  if (!imageDataUrlMayHaveTransparency(trimmed) && /^data:image\/jpe?g/i.test(trimmed)) {
    return Promise.resolve(trimmed)
  }

  const { backgroundColor = "#ffffff", maxWidth, quality = 0.78 } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (maxWidth && width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, width, height)
      enableHighQualityCanvasDraw(ctx)
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Failed to load image for flatten"))
    img.src = trimmed
  })
}

/** Wait until an image is decoded (or time out) before html2canvas runs. */
export function waitForImageElement(img: HTMLImageElement, timeoutMs = 8000): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    img.addEventListener("load", done, { once: true })
    img.addEventListener("error", done, { once: true })
    window.setTimeout(done, timeoutMs)
  })
}

/** Square center-crop for profile photos — html2canvas ignores object-fit and squashes non-square JPEGs. */
export function flattenProfilePhotoForPdfExport(
  dataUrl: string,
  sizePx = 264,
  backgroundColor = "#ffffff",
  quality = 0.92,
): Promise<string> {
  const trimmed = dataUrl.trim()
  if (!trimmed) return Promise.resolve(trimmed)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = sizePx
      canvas.height = sizePx
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, sizePx, sizePx)
      enableHighQualityCanvasDraw(ctx)
      const scale = Math.max(sizePx / img.width, sizePx / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (sizePx - w) / 2, (sizePx - h) / 2, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Failed to load profile photo for export"))
    img.src = trimmed
  })
}

export type FlattenedLogoForExport = {
  dataUrl: string
  width: number
  height: number
}

/** Fit logo inside a box on white — preserves aspect ratio for PDF rasterization. */
export function flattenLogoForPdfExport(
  dataUrl: string,
  maxWidth = 600,
  maxHeight = 168,
  backgroundColor = "#ffffff",
  quality = 0.92,
): Promise<FlattenedLogoForExport> {
  const trimmed = dataUrl.trim()
  if (!trimmed) {
    return Promise.resolve({ dataUrl: trimmed, width: 0, height: 0 })
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (img.width < 1 || img.height < 1) {
        reject(new Error("Logo image has no dimensions"))
        return
      }
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, w, h)
      enableHighQualityCanvasDraw(ctx)
      ctx.drawImage(img, 0, 0, w, h)
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", quality),
        width: w,
        height: h,
      })
    }
    img.onerror = () => reject(new Error("Failed to load logo for export"))
    img.src = trimmed
  })
}

export type FlattenImagesForPdfOptions = {
  backgroundColor?: string
  maxImageWidth?: number
  profilePhotoSizePx?: number
  logoMaxWidth?: number
  logoMaxHeight?: number
  quality?: number
  profileQuality?: number
  logoQuality?: number
}

function isProfilePhotoImage(img: HTMLImageElement): boolean {
  if (img.classList.contains("cover-letter-profile-photo")) return true
  const alt = (img.getAttribute("alt") || "").toLowerCase()
  if (alt.includes("profile")) return true
  const style = (img.getAttribute("style") || "").toLowerCase()
  return style.includes("border-radius") && (style.includes("50%") || style.includes("object-fit: cover"))
}

function isCompanyLogoImage(img: HTMLImageElement): boolean {
  if (img.classList.contains("cover-letter-company-logo")) return true
  const alt = (img.getAttribute("alt") || "").toLowerCase()
  return alt.includes("logo") || alt.includes("company")
}

/** Flatten all inline images in an export root so html2canvas does not turn transparency black. */
export async function flattenImagesForPdfExport(
  root: HTMLElement,
  options: FlattenImagesForPdfOptions | string = "#ffffff",
): Promise<void> {
  const resolved: FlattenImagesForPdfOptions =
    typeof options === "string" ? { backgroundColor: options } : options
  const {
    backgroundColor = "#ffffff",
    maxImageWidth = 400,
    profilePhotoSizePx = 264,
    logoMaxWidth = 600,
    logoMaxHeight = 168,
    quality = 0.78,
    profileQuality = 0.92,
    logoQuality = 0.92,
  } = resolved

  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(
    images.map(async (img) => {
      if (!(img instanceof HTMLImageElement)) return
      if (img.dataset.pdfPrepared === "1") {
        await waitForImageElement(img)
        return
      }

      const src = (img.currentSrc || img.src || img.getAttribute("src") || "").trim()
      if (!src.startsWith("data:image/")) return
      try {
        if (isProfilePhotoImage(img)) {
          img.src = await flattenProfilePhotoForPdfExport(
            src,
            profilePhotoSizePx,
            backgroundColor,
            profileQuality,
          )
        } else if (isCompanyLogoImage(img)) {
          const flat = await flattenLogoForPdfExport(
            src,
            logoMaxWidth,
            logoMaxHeight,
            backgroundColor,
            logoQuality,
          )
          img.src = flat.dataUrl
          img.width = flat.width
          img.height = flat.height
          img.style.width = `${flat.width}px`
          img.style.height = `${flat.height}px`
          img.style.maxWidth = "none"
          img.style.maxHeight = "none"
          img.style.objectFit = "none"
          img.style.display = "block"
          img.dataset.pdfPrepared = "1"
        } else if (imageDataUrlMayHaveTransparency(src) || !/^data:image\/jpe?g/i.test(src)) {
          img.src = await flattenImageDataUrl(src, {
            backgroundColor,
            maxWidth: maxImageWidth,
            quality,
          })
        } else {
          img.src = await flattenImageDataUrl(src, {
            backgroundColor,
            maxWidth: maxImageWidth,
            quality,
          })
        }
        await waitForImageElement(img)
      } catch (err) {
        console.warn("[pdf] Could not flatten image, keeping original:", err)
        await waitForImageElement(img)
      }
    }),
  )
}
