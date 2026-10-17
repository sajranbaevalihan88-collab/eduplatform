import { AssetRecordType, type TLAsset } from 'tldraw'

export function extractPages(data: any): { pages: string[]; target: number } {
  if (!data) return { pages: [], target: 0 }
  if (Array.isArray(data.images) && data.images.length) return { pages: data.images.filter(Boolean), target: data.currentPage || 0 }
  if (typeof data.image === 'string' && data.image.startsWith('data:image')) return { pages: [data.image], target: 0 }
  return { pages: [], target: 0 }
}

export function isLegacyBoardMeta(b: any): boolean {
  return !!(b?.data && !b.data.fmt && (typeof b.data.image === 'string' || !!b.data.images?.length))
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image()
  i.onload = () => res(i)
  i.onerror = rej
  i.src = url
})

export async function compressDataUrl(url: string, maxEdge = 1280, quality = 0.8): Promise<string | null> {
  try {
    const img = await loadImage(url)
    const natW = img.naturalWidth || maxEdge
    const natH = img.naturalHeight || maxEdge
    const scale = Math.min(1, maxEdge / Math.max(natW, natH))
    const w = Math.max(1, Math.round(natW * scale))
    const h = Math.max(1, Math.round(natH * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}

export async function importLegacyPages(editor: any, pages: string[], target: number, sheetLabel: (n: number) => string): Promise<void> {
  if (!editor || !pages.length) return
  try {
    for (let i = 0; i < pages.length; i++) {
      try {
        const src = await compressDataUrl(pages[i], 1024, 0.82)
        if (!src) continue
        const img = await loadImage(src)
        const scale = 1600 / (img.naturalWidth || 1600)
        const w = Math.round((img.naturalWidth || 1600) * scale)
        const h = Math.round((img.naturalHeight || 900) * scale)
        if (i > 0) {
          const all = editor.getPages()
          if (all[i]) {
            editor.setCurrentPage(all[i].id)
          } else {
            editor.createPage({ name: sheetLabel(i + 1) })
            const np = editor.getPages()[i]
            if (!np) continue
            editor.setCurrentPage(np.id)
          }
        }
        const asset: TLAsset = AssetRecordType.create({
          id: AssetRecordType.createId(),
          type: 'image',
          props: { src, w, h, name: `legacy-${i + 1}`, mimeType: 'image/jpeg', isAnimated: false },
        })
        editor.createAssets([asset])
        editor.createShape({ type: 'image', x: 0, y: 0, props: { assetId: asset.id, w, h } })
      } catch {}
    }
    try {
      const all = editor.getPages()
      editor.setCurrentPage((all[target]?.id) || all[0].id)
    } catch {}
    try { editor.zoomToFit({ animationDuration: 0 }) } catch {}
  } catch {}
}
