import client from '../api/client'

const SAFE_INLINE_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
])

/**
 * Открыть/скачать медиа-файл с авторизацией: приватные загрузки (/media/uploads/*)
 * закрыты auth-гейтом, прямые <a href> не могут послать Bearer — качаем blob
 * клиентом и открываем безопасно (SVG/HTML никогда не открываются inline на same-origin).
 */
export async function openMediaFile(url: string, downloadName?: string) {
  const r = await client.get(url, { responseType: 'blob' })
  const blob = r.data as Blob
  const mime = (blob.type || '').split(';')[0].trim().toLowerCase()
  const objUrl = URL.createObjectURL(blob)

  const triggerDownload = () => {
    const a = document.createElement('a')
    a.href = objUrl
    a.download = downloadName || 'file'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000)
  }

  if (downloadName || !SAFE_INLINE_MIMES.has(mime)) {
    triggerDownload()
    return
  }

  const w = window.open(objUrl, '_blank', 'noopener,noreferrer')
  if (!w) {
    triggerDownload()
    return
  }
  setTimeout(() => URL.revokeObjectURL(objUrl), 60000)
}

/** Blob-URL для встраивания (iframe/img) с авторизацией. */
export async function fetchMediaBlobUrl(url: string): Promise<string> {
  const r = await client.get(url, { responseType: 'blob' })
  return URL.createObjectURL(r.data as Blob)
}
