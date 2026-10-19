// Режим защиты от скриншотов при прохождении теста.
// Браузер физически не может перехватить системный скриншот (PrtScn,
// «Ножницы», кнопки телефона) — поэтому режим работает так:
// 1) при потере фокуса окна (Alt+Tab, «Ножницы», другая вкладка/приложение)
//    контент размывается и накрывается заглушкой — скрин получается пустым;
// 2) клавиши PrintScreen и Ctrl+C/X/S/P/U перехватываются с предупреждением;
// 3) копирование, контекстное меню, печать и выделение текста запрещены;
// 4) каждое нарушение считается — счётчик попадает в итог попытки.

export interface ShotGuardTexts {
  warnTitle: string
  warnMsg: string
  blurTitle: string
  blurMsg: string
}

let release: null | (() => void) = null

export function enableShotGuard(onViolation: () => void, texts: ShotGuardTexts): () => void {
  if (release) return release
  const doc = document

  const style = doc.createElement('style')
  style.id = 'edu-shot-style'
  style.textContent = [
    'body.edu-shot-guard, body.edu-shot-guard *{ -webkit-user-select:none!important; user-select:none!important; }',
    'body.edu-shot-guard img{ -webkit-user-drag:none!important; }',
    'body.edu-shot-blur #root{ filter:blur(20px) saturate(.4); pointer-events:none; }',
    '@media print{ body.edu-shot-guard > #root{ display:none!important; } }'
  ].join('\n')
  doc.head.appendChild(style)
  doc.body.classList.add('edu-shot-guard')

  const ov = doc.createElement('div')
  ov.id = 'edu-shot-overlay'
  ov.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.94);color:#fff;text-align:center;font:600 17px/1.6 system-ui,-apple-system,sans-serif;padding:24px;')
  doc.body.appendChild(ov)

  const show = (title: string, msg: string, blur: boolean, autoMs?: number) => {
    ov.innerHTML = `<div style="max-width:440px"><div style="font-size:44px">${blur ? '🛡️' : '🚫'}</div><div style="font-size:20px;margin:10px 0 6px">${title}</div><div style="font-size:14px;opacity:.8">${msg}</div>${blur ? `<div style="margin-top:16px;font-size:13px;opacity:.55">${texts.warnMsg}</div>` : ''}</div>`
    ov.style.display = 'flex'
    doc.body.classList.toggle('edu-shot-blur', blur)
    if (autoMs) {
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(hideOverlay, autoMs)
    }
  }
  const hideOverlay = () => {
    ov.style.display = 'none'
    doc.body.classList.remove('edu-shot-blur')
    window.clearTimeout(hideTimer)
  }
  let hideTimer: number | undefined
  let lastWarn = 0

  const warn = () => {
    const n = Date.now()
    if (n - lastWarn < 800) { lastWarn = n; return }
    lastWarn = n
    onViolation()
    show(texts.warnTitle, texts.warnMsg, false, 1700)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'PrintScreen') { warn(); return }
    const k = (e.key || '').toLowerCase()
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ['c', 'x', 's', 'p', 'u'].includes(k)) {
      e.preventDefault()
      warn()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'PrintScreen') warn()
  }
  const onCtx = (e: Event) => { e.preventDefault(); warn() }
  const onCopy = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    warn()
  }
  const onDrag = (e: Event) => e.preventDefault()
  const onBlur = () => show(texts.blurTitle, texts.blurMsg, true)
  const onFocus = () => hideOverlay()
  const onVis = () => { if (doc.hidden) show(texts.blurTitle, texts.blurMsg, true) }
  const onFs = () => {
    if (!doc.fullscreenElement) {
      onViolation()
      show(texts.blurTitle, texts.blurMsg, true)
    }
  }
  const beforePrint = () => warn()

  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('contextmenu', onCtx, true)
  window.addEventListener('copy', onCopy, true)
  window.addEventListener('cut', onCopy, true)
  window.addEventListener('dragstart', onDrag, true)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  doc.addEventListener('visibilitychange', onVis)
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
    doc.removeEventListener('fullscreenchange', onFs)
    window.removeEventListener('beforeprint', beforePrint)
    window.clearTimeout(hideTimer)
    hideOverlay()
    doc.body.classList.remove('edu-shot-guard', 'edu-shot-blur')
    style.remove()
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
