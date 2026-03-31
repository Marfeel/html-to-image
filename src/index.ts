import { Options, SvgDataURLResult, EncodeOptions } from './types'
import { cloneNode } from './clone-node'
import { embedImages, clearCache as clearImagesCache } from './embed-images'
import { applyStyle } from './apply-style'
import {
  embedWebFonts,
  getWebFontCSS,
  clearCache as clearWebfontsCache,
} from './embed-webfonts'
import {
  getImageSize,
  getPixelRatio,
  createImage,
  canvasToBlob,
  nodeToDataURL,
  checkCanvasDimensions,
  checkDimensions,
} from './util'

export type { Options, SvgDataURLResult, EncodeOptions } from './types'

export async function toSvg<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<string> {
  const { width, height } = getImageSize(node, options)
  const clonedNode = (await cloneNode(node, options, true)) as HTMLElement
  await embedWebFonts(clonedNode, options)
  await embedImages(clonedNode, options)
  applyStyle(clonedNode, options)
  const datauri = await nodeToDataURL(clonedNode, width, height)
  return datauri
}

export async function toSvgDataURL<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<SvgDataURLResult> {
  const { width, height } = getImageSize(node, options)
  const svg = await toSvg(node, options)

  const ratio = options.pixelRatio || getPixelRatio()
  const canvasWidth = options.canvasWidth || width
  const canvasHeight = options.canvasHeight || height

  return {
    svgDataURL: svg,
    width: canvasWidth * ratio,
    height: canvasHeight * ratio,
  }
}

export async function encodeSvgToDataURL(
  svgDataURL: string,
  width: number,
  height: number,
  options: EncodeOptions = {},
): Promise<string> {
  const {
    format = 'image/png',
    quality = 1,
    backgroundColor,
    skipAutoScale,
  } = options
  const dims = skipAutoScale
    ? { width, height }
    : checkDimensions(width, height)

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(dims.width, dims.height)
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D

    if (backgroundColor) {
      context.fillStyle = backgroundColor
      context.fillRect(0, 0, dims.width, dims.height)
    }

    const blob = await fetch(svgDataURL).then((r) => r.blob())
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: dims.width,
      resizeHeight: dims.height,
    })
    context.drawImage(bitmap, 0, 0)
    bitmap.close()

    const outputBlob = await (canvas as any).convertToBlob({
      type: format,
      quality: format === 'image/jpeg' ? quality : undefined,
    })

    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(outputBlob)
    })
  }

  const img = await createImage(svgDataURL)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  canvas.width = dims.width
  canvas.height = dims.height

  if (backgroundColor) {
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(img, 0, 0, canvas.width, canvas.height)

  return format === 'image/jpeg'
    ? canvas.toDataURL('image/jpeg', quality)
    : canvas.toDataURL()
}

export async function toCanvas<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<HTMLCanvasElement> {
  const { width, height } = getImageSize(node, options)
  const svg = await toSvg(node, options)
  const img = await createImage(svg)

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  const ratio = options.pixelRatio || getPixelRatio()
  const canvasWidth = options.canvasWidth || width
  const canvasHeight = options.canvasHeight || height

  canvas.width = canvasWidth * ratio
  canvas.height = canvasHeight * ratio

  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas)
  }
  canvas.style.width = `${canvasWidth}`
  canvas.style.height = `${canvasHeight}`

  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas
}

export async function toPixelData<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<Uint8ClampedArray> {
  const { width, height } = getImageSize(node, options)
  const canvas = await toCanvas(node, options)
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(0, 0, width, height).data
}

export async function toPng<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<string> {
  const canvas = await toCanvas(node, options)
  return canvas.toDataURL()
}

export async function toJpeg<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<string> {
  const canvas = await toCanvas(node, options)
  return canvas.toDataURL('image/jpeg', options.quality || 1)
}

export async function toBlob<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<Blob | null> {
  const canvas = await toCanvas(node, options)
  const blob = await canvasToBlob(canvas)
  return blob
}

export async function getFontEmbedCSS<T extends HTMLElement>(
  node: T,
  options: Options = {},
): Promise<string> {
  return getWebFontCSS(node, options)
}

export enum CacheType {
  IMAGES,
  FONTS,
}

export function clearCaches(kind?: CacheType) {
  const cacheToWiperMap = {
    [CacheType.IMAGES]: clearImagesCache,
    [CacheType.FONTS]: clearWebfontsCache,
  }
  const cachesToClear =
    kind === undefined ? [CacheType.FONTS, CacheType.IMAGES] : [kind]

  cachesToClear.forEach((c) => cacheToWiperMap[c]())
}
