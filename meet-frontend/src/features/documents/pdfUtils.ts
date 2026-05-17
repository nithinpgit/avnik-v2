import * as pdfjs from 'pdfjs-dist'
import { resolveFileAssetUrl } from './documentsApi'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export async function getPdfPageCount(fileUrl: string): Promise<number> {
  const doc = await pdfjs.getDocument({ url: resolveFileAssetUrl(fileUrl) }).promise
  return doc.numPages
}

export async function renderPdfPageToDataUrl(
  fileUrl: string,
  pageNumber: number,
  scale: number,
): Promise<string> {
  const doc = await pdfjs.getDocument({ url: resolveFileAssetUrl(fileUrl) }).promise
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png')
}
