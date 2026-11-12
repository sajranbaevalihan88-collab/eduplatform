// Режим усиленной защиты от скриншотов, копирования и читерства при прохождении теста.
// 1) Мгновенное скрытие (visibility: hidden + opacity: 0) при потере фокуса окна (Alt+Tab, "Ножницы", Telegram, etc.)
// 2) Полное скрытие контента при mouseleave (курсор ушёл за пределы окна браузера)
// 3) Перехват PrintScreen, Win+Shift+S, F12, Ctrl+Shift+I/C/J, Ctrl+P/S/U/C/X с мгновенным blackout
// 4) Очистка буфера обмена (scrubClipboard) при любых подозрительных действиях
// 5) Непрерывный водяной знак (ФИО / ник ученика + дата/время) по диагонали всего экрана — защищает даже от фото на телефон
// 6) Полный запрет контекстного меню, выделения текста, перетаскивания и печати (@media print)

export interface ShotGuardTexts {
  warnTitle: string
  warnMsg: string
  blurTitle: string
  blurMsg: string
  studentWatermark?: string
}

let release: null | (() => void) = null

export function enableShotGuard(onViolation: () => void, texts: ShotGuardTexts): () => void {
  if (release) return release
  const doc = document

  // Получаем имя текущего пользователя для персонального водяного знака
  let studentLabel = texts.studentWatermark || ''
  if (!studentLabel) {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      studentLabel = (u.first_name ? `${u.first_name} (@${u.username})` : u.username) || 'Ученик'
    } catch {
      studentLabel = 'Ученик'
    }
  }

  const style = doc.createElement('style')
  style.id = 'edu-shot-style'
  style.textContent = [
    'body.edu-shot-guard, body.edu-shot-guard * {',
    '  -webkit-user-select: none !important;',
    '  user-select: none !important;',
    '  -webkit-touch-callout: none !important;',
    '}',
    'body.edu-shot-guard img { -webkit-user-drag: none !important; }',
    'body.edu-shot-guard.edu-blackout #root, body.edu-shot-guard.edu-shot-blur #root {',
    '  visibility: hidden !important;',
    '  opacity: 0 !important;',
    '  filter: blur(50px) !important;',
    '  pointer-events: none !important;',
    '}',
    '@media print {',
    '  body.edu-shot-guard, body.edu-shot-guard > * { display: none !important; }',
    '}',
    '.edu-watermark-overlay {',
    '  position: fixed;',
    '  inset: 0;',
    '  pointer-events: none;',
    '  z-index: 2147482000;',
    '  opacity: 0.13;',
    '  background-repeat: repeat;',
    '}'
  ].join('\n')
  doc.head.appendChild(style)
  doc.body.classList.add('edu-shot-guard')

  // Создаем динамический SVG водяной знак
  const watermarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200" viewBox="0 0 340 200"><text x="20" y="100" fill="#000" font-size="14" font-weight="bold" font-family="sans-serif" transform="rotate(-22 170 100)">${studentLabel} • ТЕСТИРОВАНИЕ • КОПИРОВАНИЕ ЗАПРЕЩЕНО</text></svg>`
  const watermarkDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(watermarkSvg)}`

  const wm = doc.createElement('div')
  wm.id = 'edu-shot-watermark'
  wm.className = 'edu-watermark-overlay'
  wm.style.backgroundImage = `url("${watermarkDataUri}")`
  doc.body.appendChild(wm)

  // Полноэкранная непроницаемая заглушка (100% black)
  const ov = doc.createElement('div')
  ov.id = 'edu-shot-overlay'
  ov.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:#020617;color:#fff;text-align:center;font:600 17px/1.6 system-ui,-apple-system,sans-serif;padding:24px;')
  doc.body.appendChild(ov)

  let hideTimer: number | undefined
  let lastWarn = 0

  const scrubClipboard = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('⚠️ EduPlatform: Копирование и создание скриншотов во время теста запрещены!').catch(() => {})
      }
    } catch {}
  }

  const show = (title: string, msg: string, blur: boolean, autoMs?: number) => {
    ov.innerHTML = `<div style="max-width:440px"><div style="font-size:48px">${blur ? '🛡️' : '🚫'}</div><div style="font-size:22px;margin:12px 0 6px;color:#fff">${title}</div><div style="font-size:15px;color:#94a3b8">${msg}</div><div style="margin-top:20px;padding:8px 14px;background:#0f172a;border-radius:10px;font-size:12px;color:#cbd5e1;display:inline-block">👤 Сдача теста: ${studentLabel}</div></div>`
    ov.style.display = 'flex'
    doc.body.classList.add('edu-shot-blur')
    doc.body.classList.add('edu-blackout')
    scrubClipboard()
    if (autoMs) {
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(hideOverlay, autoMs)
    }
  }

  const hideOverlay = () => {
    ov.style.display = 'none'
    doc.body.classList.remove('edu-shot-blur')
    doc.body.classList.remove('edu-blackout')
    window.clearTimeout(hideTimer)
  }

  const warn = () => {
    const n = Date.now()
    if (n - lastWarn < 800) { lastWarn = n; return }
    lastWarn = n
    onViolation()
    scrubClipboard()
    show(texts.warnTitle, texts.warnMsg, false, 1700)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const k = (e.key || '').toLowerCase()
    // PrintScreen, Win+Shift+S, F12, DevTools
    if (e.key === 'PrintScreen' || k === 'printscreen') {
      e.preventDefault()
      scrubClipboard()
      doc.body.classList.add('edu-blackout')
      warn()
      return
    }
    // F12 DevTools
    if (e.key === 'F12') {
      e.preventDefault()
      warn()
      return
    }
    // Ctrl+Shift+I / J / C (DevTools) или Ctrl+Shift+S / Win+Shift+S (Ножницы)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 's'].includes(k)) {
      e.preventDefault()
      scrubClipboard()
      doc.body.classList.add('edu-blackout')
      warn()
      return
    }
    // Ctrl+C, Ctrl+X, Ctrl+S, Ctrl+P, Ctrl+U
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ['c', 'x', 's', 'p', 'u'].includes(k)) {
      e.preventDefault()
      warn()
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    const k = (e.key || '').toLowerCase()
    if (e.key === 'PrintScreen' || k === 'printscreen') {
      scrubClipboard()
      doc.body.classList.add('edu-blackout')
      warn()
    }
  }

  const onCtx = (e: Event) => { e.preventDefault(); warn() }
  const onCopy = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    scrubClipboard()
    warn()
  }
  const onDrag = (e: Event) => e.preventDefault()
  const onBlur = () => {
    scrubClipboard()
    show(texts.blurTitle, texts.blurMsg, true)
  }
  const onFocus = () => {
    scrubClipboard()
    hideOverlay()
  }
  const onVis = () => {
    if (doc.hidden) {
      scrubClipboard()
      show(texts.blurTitle, texts.blurMsg, true)
    }
  }
  const onMouseLeave = () => {
    // Курсор ушёл за пределы окна браузера — часто начало выделения области в Snipping Tool
    show(texts.blurTitle, texts.blurMsg, true)
  }
  const onMouseEnter = () => {
    if (!doc.hidden && doc.hasFocus()) {
      hideOverlay()
    }
  }
  const onFs = () => {
    if (!doc.fullscreenElement) {
      onViolation()
      show(texts.blurTitle, texts.blurMsg, true)
    }
  }
  const beforePrint = () => {
    scrubClipboard()
    warn()
  }

  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('contextmenu', onCtx, true)
  window.addEventListener('copy', onCopy, true)
  window.addEventListener('cut', onCopy, true)
  window.addEventListener('dragstart', onDrag, true)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  doc.addEventListener('visibilitychange', onVis)
  doc.addEventListener('mouseleave', onMouseLeave)
  doc.addEventListener('mouseenter', onMouseEnter)
  doc.addEventListener('fullscreenchange', onFs)
  window.addEventListener('beforeprint', beforePrint)

  release = () => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp, true)
    window.removeEventListener('contextmenu', onCtx, true)
    window.removeEventListener('copy', onCopy, true)
    window.removeEventListener('cut', onCopy, true)
    window.removeEventListener('dragstart', onDrag, true)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    doc.removeEventListener('visibilitychange', onVis)
    doc.removeEventListener('mouseleave', onMouseLeave)
    doc.removeEventListener('mouseenter', onMouseEnter)
    doc.removeEventListener('fullscreenchange', onFs)
    window.removeEventListener('beforeprint', beforePrint)
    window.clearTimeout(hideTimer)
    hideOverlay()
    doc.body.classList.remove('edu-shot-guard', 'edu-shot-blur', 'edu-blackout')
    style.remove()
    wm.remove()
    ov.remove()
    release = null
  }
  return release
}

export function disableShotGuard() {
  release?.()
}

export function requestGuardFullscreen() {
  const el = document.documentElement
  const fn = el.requestFullscreen?.bind(el)
  if (fn) fn({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {})
}
