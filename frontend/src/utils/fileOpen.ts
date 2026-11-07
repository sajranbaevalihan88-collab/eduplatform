import client from '../api/client'

/**
 * Открыть/скачать медиа-файл с авторизацией: приватные загрузки (/media/uploads/*)
 * закрыты auth-гейтом, прямые <a href> не могут послать Bearer — качаем blob
 * клиентом (как все API-запросы) и открываем через blob:URL.
 */
export async function openMediaFile(url: string, downloadName?: string){
  const r = await client.get(url, { responseType: 'blob' })
  const blob = r.data as Blob
  const objUrl = URL.createObjectURL(blob)
  if (downloadName) {
    const a = document.createElement('a')
    a.href = objUrl
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objUrl), 10000)
  } else {
    const w = window.open(objUrl, '_blank')
    if (!w) {
      // попап-блокер: отдаём скачиванием
      const a = document.createElement('a')
      a.href = objUrl
      a.download = downloadName || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000)
      return
    }
    setTimeout(() => URL.revokeObjectURL(objUrl), 60000)
  }
}

/** Blob-URL для встраивания (iframe/img) с авторизацией. */
export async function fetchMediaBlobUrl(url: string): Promise<string>{
  const r = await client.get(url, { responseType: 'blob' })
  return URL.createObjectURL(r.data as Blob)
}
