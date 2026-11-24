/**
 * Универсальное чтение табличных файлов для импорта расписания, списка учеников и учебной программы.
 * Поддерживает: .xlsx, .xls, .ods (Excel / LibreOffice), .docx (Word), .csv, .tsv, .txt, .json
 * Работает без внешних xlsx-зависимостей (через встроенный ZIP + DecompressionStream и DOMParser).
 */
export const TABLE_IMPORT_ACCEPT = '.csv,.txt,.tsv,.xlsx,.xls,.ods,.docx,.doc,.json'

async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const entries = new Map<string, Uint8Array>()

  // Ищем End of Central Directory (EOCD)
  let eocdOffset = -1
  const minEocd = Math.max(0, bytes.length - 65557)
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) return entries

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  let cdOffset = view.getUint32(eocdOffset + 16, true)
  const decoder = new TextDecoder('utf-8')

  for (let i = 0; i < totalEntries && cdOffset + 46 <= bytes.length; i++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break
    const method = view.getUint16(cdOffset + 10, true)
    const compSize = view.getUint32(cdOffset + 20, true)
    const nameLen = view.getUint16(cdOffset + 28, true)
    const extraLen = view.getUint16(cdOffset + 30, true)
    const commentLen = view.getUint16(cdOffset + 32, true)
    const localHeaderOffset = view.getUint32(cdOffset + 42, true)
    const fileName = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen))
    cdOffset += 46 + nameLen + extraLen + commentLen

    if (localHeaderOffset + 30 > bytes.length) continue
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) continue
    const localNameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compData = bytes.subarray(dataStart, dataStart + compSize)

    if (method === 0) {
      entries.set(fileName, compData)
    } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw')
        const writer = ds.writable.getWriter()
        writer.write(compData)
        writer.close()
        const decompressedBuf = await new Response(ds.readable).arrayBuffer()
        entries.set(fileName, new Uint8Array(decompressedBuf))
      } catch {
        // пропуск повреждённой записи
      }
    }
  }
  return entries
}

function colRefToIndex(ref: string): number {
  const letters = (ref.match(/^[A-Za-z]+/) || [''])[0].toUpperCase()
  if (!letters) return -1
  let idx = 0
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64)
  }
  return idx - 1
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<string> {
  const entries = await readZipEntries(buffer)
  if (entries.size === 0) return ''
  const decoder = new TextDecoder('utf-8')

  // 1. Читаем xl/sharedStrings.xml
  const sharedStrings: string[] = []
  const ssBytes = entries.get('xl/sharedStrings.xml')
  if (ssBytes) {
    const ssDoc = new DOMParser().parseFromString(decoder.decode(ssBytes), 'application/xml')
    const siNodes = Array.from(ssDoc.getElementsByTagName('si'))
    for (const si of siNodes) {
      const tNodes = Array.from(si.getElementsByTagName('t'))
      sharedStrings.push(tNodes.map(t => t.textContent || '').join(''))
    }
  }

  // 2. Находим первый рабочий лист xl/worksheets/sheet*.xml
  const sheetKey =
    (entries.has('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : '') ||
    Array.from(entries.keys())
      .filter(k => /^xl\/worksheets\/sheet\d*\.xml$/i.test(k))
      .sort()[0]
  if (!sheetKey) return ''

  const sheetBytes = entries.get(sheetKey)
  if (!sheetBytes) return ''
  const sheetDoc = new DOMParser().parseFromString(decoder.decode(sheetBytes), 'application/xml')
  const rowNodes = Array.from(sheetDoc.getElementsByTagName('row'))
  const lines: string[] = []

  for (const rowNode of rowNodes) {
    const cells = Array.from(rowNode.getElementsByTagName('c'))
    const rowValues: string[] = []
    let nextCol = 0

    for (const cell of cells) {
      const ref = cell.getAttribute('r') || ''
      const colIdx = colRefToIndex(ref)
      const targetIdx = colIdx >= 0 ? colIdx : nextCol
      while (rowValues.length < targetIdx) rowValues.push('')

      const type = cell.getAttribute('t') || ''
      let val = ''
      if (type === 'inlineStr') {
        const tNodes = Array.from(cell.getElementsByTagName('t'))
        val = tNodes.map(t => t.textContent || '').join('')
      } else {
        const vNode = cell.getElementsByTagName('v')[0]
        const rawVal = vNode?.textContent ?? ''
        if (type === 's') {
          const sIdx = parseInt(rawVal, 10)
          val = !isNaN(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawVal
        } else {
          val = rawVal
        }
      }
      rowValues[targetIdx] = val.replace(/\s+/g, ' ').trim()
      nextCol = targetIdx + 1
    }

    while (rowValues.length > 0 && !rowValues[rowValues.length - 1]) rowValues.pop()
    if (rowValues.some(Boolean)) {
      lines.push(rowValues.join(';'))
    }
  }

  return lines.join('\n')
}

async function parseOdsBuffer(buffer: ArrayBuffer): Promise<string> {
  const entries = await readZipEntries(buffer)
  const contentBytes = entries.get('content.xml')
  if (!contentBytes) return ''
  const xml = new TextDecoder('utf-8').decode(contentBytes)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const rows = Array.from(doc.getElementsByTagName('table:table-row'))
  const lines: string[] = []
  for (const row of rows) {
    const cells = Array.from(row.getElementsByTagName('table:table-cell'))
    const vals: string[] = []
    for (const cell of cells) {
      const repeat = Math.min(16, parseInt(cell.getAttribute('table:number-columns-repeated') || '1', 10) || 1)
      const text = (cell.textContent || '').replace(/\s+/g, ' ').trim()
      for (let r = 0; r < repeat; r++) vals.push(text)
    }
    while (vals.length > 0 && !vals[vals.length - 1]) vals.pop()
    if (vals.some(Boolean)) lines.push(vals.join(';'))
  }
  return lines.join('\n')
}

export async function parseImportedTableFile(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase()

  // 1. Excel (.xlsx) и OpenDocument (.ods)
  if (name.endsWith('.xlsx')) {
    const buf = await file.arrayBuffer()
    const parsed = await parseXlsxBuffer(buf)
    if (parsed) return parsed
  }
  if (name.endsWith('.ods')) {
    const buf = await file.arrayBuffer()
    const parsed = await parseOdsBuffer(buf)
    if (parsed) return parsed
  }

  // 2. Старый Excel (.xls) — может быть ZIP (.xlsx внутри), HTML-таблицей, XML Spreadsheet 2003 или TSV
  if (name.endsWith('.xls')) {
    const buf = await file.arrayBuffer()
    const zipTry = await parseXlsxBuffer(buf)
    if (zipTry) return zipTry
    const txt = new TextDecoder('utf-8').decode(buf)
    if (txt.includes('<tr') || txt.includes('<Row')) {
      const doc = new DOMParser().parseFromString(txt, 'text/html')
      const trs = Array.from(doc.querySelectorAll('tr, row'))
      if (trs.length > 0) {
        const lines = trs
          .map(tr =>
            Array.from(tr.querySelectorAll('th, td, cell, data'))
              .map(td => (td.textContent || '').replace(/\s+/g, ' ').trim())
          )
          .filter(cells => cells.some(Boolean))
          .map(cells => cells.join(';'))
        if (lines.length > 0) return lines.join('\n')
      }
    }
    return normalizePlainTextLines(txt)
  }

  // 3. Word (.docx)
  if (name.endsWith('.docx')) {
    const mammoth: any = await import('mammoth')
    const buf = await file.arrayBuffer()
    try {
      const htmlRes = await mammoth.convertToHtml({ arrayBuffer: buf })
      const html = String(htmlRes?.value || '')
      if (html.includes('<tr')) {
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const trs = Array.from(doc.querySelectorAll('tr'))
        if (trs.length > 0) {
          const tableLines = trs
            .map(tr =>
              Array.from(tr.querySelectorAll('th,td'))
                .map(td => (td.textContent || '').replace(/\s+/g, ' ').trim())
            )
            .filter(cells => cells.some(Boolean))
            .map(cells => cells.join(';'))
          if (tableLines.length > 0) return tableLines.join('\n')
        }
      }
    } catch {
      // fallback на extractRawText ниже
    }
    const rawRes = await mammoth.extractRawText({ arrayBuffer: buf })
    const raw = String(rawRes?.value || '')
    return normalizePlainTextLines(raw)
  }

  // 4. JSON (.json)
  if (name.endsWith('.json')) {
    const txt = await file.text()
    try {
      const parsed = JSON.parse(txt)
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (Array.isArray(item)) return item.map(x => String(x ?? '').trim()).join(';')
            if (item && typeof item === 'object') {
              const vals = [
                item.weekday ?? item.day ?? item.username ?? item.subject ?? '',
                item.period ?? item.num ?? item.first_name ?? item.grade ?? '',
                item.subject ?? item.password ?? item.title ?? '',
                item.room ?? item.description ?? '',
              ].map(v => String(v ?? '').trim())
              while (vals.length > 0 && !vals[vals.length - 1]) vals.pop()
              return vals.join(';')
            }
            return String(item ?? '').trim()
          })
          .filter(Boolean)
          .join('\n')
      }
    } catch {
      // fallback как обычный текст
    }
    return normalizePlainTextLines(txt)
  }

  // 5. CSV / TSV / TXT / прочие текстовые форматы
  const text = await file.text()
  return normalizePlainTextLines(text)
}

function normalizePlainTextLines(text: string): string {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.includes(';')) return trimmed
      if (trimmed.includes('\t')) return trimmed.split('\t').map(s => s.trim()).join(';')
      if (trimmed.includes('|')) return trimmed.split('|').map(s => s.trim()).filter(Boolean).join(';')
      return trimmed
    })
    .filter(Boolean)
    .join('\n')
}
