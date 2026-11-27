// Усиленный режим защиты (прокторинг) от скриншотов, копирования и списывания во время теста.
// 1) Превентивный blackout в тот же кадр при нажатии Meta/Win, Alt, PrintScreen, F12, Ctrl/Cmd+Shift+S/I/J/C/P
//    (Win+Shift+S и Alt+PrtScr захватывают ЧЁРНЫЙ ЭКРАН, т.к. Meta/Alt перехватывается ДО заморозки экрана Windows!)
// 2) Строгий полноэкранный замок: выход из Fullscreen (Esc/F11) блокирует тест непроницаемой заглушкой
//    до явного возврата в полноэкранный режим (mouseenter/focus НЕ снимают замок).
// 3) Мгновенное скрытие при потере фокуса (blur), смене вкладки (visibilitychange), уводе мыши (mouseleave / края экрана)
//    и резком изменении размера окна (открытие DevTools или разделение экрана).
// 4) Серийная перезапись буфера обмена (0 / 80 / 250 / 500 мс) при PrintScreen и копировании.
// 5) Усиленный персональный водяной знак (ФИО / ник + дата/время) по диагонали всего экрана.

export interface ShotGuardTexts {
  warnTitle: string
  warnMsg: string
  blurTitle: string
  blurMsg: string
  studentWatermark?: string
  requireFullscreen?: boolean
  maxViolations?: number
}

let release: null | (() => void) = null

export function supportsFullscreen(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  // На мобильных (iOS Safari и узкие экраны) Fullscreen API недоступен или нестабилен
  if (window.innerWidth < 768) return false
  return typeof document.documentElement?.requestFullscreen === 'function'
}

export function enableShotGuard(
  onViolation: (reason: string) => void,
  texts: ShotGuardTexts,
): () => void {
  if (release) return release
  const doc = document
  const requireFs = texts.requireFullscreen !== false && supportsFullscreen()

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
    '  filter: blur(60px) !important;',
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
    '  opacity: 0.09;',
    '  background-repeat: repeat;',
    '}',
    'html.dark .edu-watermark-overlay {',
    '  filter: invert(1);',
    '  opacity: 0.11;',
    '}',
  ].join('\n')
  doc.head.appendChild(style)
  doc.body.classList.add('edu-shot-guard')

  const escXml = (s: string) =>
    String(s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))
  const safeLabel = String(studentLabel || 'Ученик').slice(0, 70)
  const stamp = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const watermarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="210" viewBox="0 0 360 210"><text x="16" y="105" fill="#0f172a" font-size="14" font-weight="700" font-family="sans-serif" transform="rotate(-22 180 105)">${escXml(safeLabel)} • ${escXml(stamp)} • ТЕСТ</text></svg>`
  const watermarkDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(watermarkSvg)}`

  const wm = doc.createElement('div')
  wm.id = 'edu-shot-watermark'
  wm.className = 'edu-watermark-overlay'
  wm.style.backgroundImage = `url("${watermarkDataUri}")`
  doc.body.appendChild(wm)

  // Полностью непроницаемая чёрная шторка (синхронно перекрывает экран до снимка)
  const ov = doc.createElement('div')
  ov.id = 'edu-shot-overlay'
  ov.setAttribute(
    'style',
    'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:#000000;color:#fff;text-align:center;font:600 17px/1.6 system-ui,-apple-system,sans-serif;padding:24px;'
  )
  doc.body.appendChild(ov)

  let lastWarn = 0
  let lockedReason: null | 'fullscreen' | 'violation' | 'focus' = null
  const scrubTimers: number[] = []
  let initInnerW = window.innerWidth
  let initInnerH = window.innerHeight
  let enteredFsOnce = !!doc.fullscreenElement

  const writeClipboardOnce = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText('⚠️ EduPlatform: Скриншоты и копирование во время теста запрещены!')
          .catch(() => {})
      }
    } catch {}
  }

  // Серийная перезапись буфера: на Windows OS записывает картинку PrintScreen с задержкой 40–300 мс
  const scrubClipboardBurst = () => {
    writeClipboardOnce()
    for (const ms of [80, 220, 480]) {
      const tid = window.setTimeout(writeClipboardOnce, ms)
      scrubTimers.push(tid)
    }
  }

  const blackoutSync = () => {
    doc.body.classList.add('edu-shot-blur')
    doc.body.classList.add('edu-blackout')
    ov.style.display = 'flex'
  }

  const hideOverlay = (force = false) => {
    if (!force && (lockedReason === 'fullscreen' || lockedReason === 'violation')) {
      return
    }
    lockedReason = null
    ov.style.display = 'none'
    doc.body.classList.remove('edu-shot-blur')
    doc.body.classList.remove('edu-blackout')
  }

  const showShield = (
    title: string,
    msg: string,
    mode: 'fullscreen' | 'violation' | 'focus',
  ) => {
    blackoutSync()
    lockedReason = mode
    ov.textContent = ''

    const box = doc.createElement('div')
    box.style.maxWidth = '460px'

    const iconEl = doc.createElement('div')
    iconEl.style.fontSize = '52px'
    iconEl.textContent = mode === 'violation' ? '🚫' : mode === 'fullscreen' ? '🔒' : '🛡️'

    const titleEl = doc.createElement('div')
    titleEl.setAttribute('style', 'font-size:22px;font-weight:800;margin:12px 0 8px;color:#fff')
    titleEl.textContent = String(title || '')

    const msgEl = doc.createElement('div')
    msgEl.setAttribute('style', 'font-size:15px;color:#cbd5e1;line-height:1.5')
    msgEl.textContent = String(msg || '')

    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.setAttribute(
      'style',
      'margin-top:20px;padding:12px 24px;border-radius:12px;border:0;background:#4f46e5;color:#fff;font-weight:700;font-size:15px;cursor:pointer;'
    )
    if (mode === 'fullscreen') {
      btn.textContent = '🔒 Вернуться в полноэкранный режим'
      btn.onclick = () => {
        requestGuardFullscreen().then(() => {
          if (doc.fullscreenElement) {
            enteredFsOnce = true
            hideOverlay(true)
          }
        })
      }
    } else {
      btn.textContent = 'Вернуться к тесту'
      btn.onclick = () => {
        if (requireFs && !doc.fullscreenElement) {
          requestGuardFullscreen().then(() => {
            if (doc.fullscreenElement) {
              enteredFsOnce = true
              hideOverlay(true)
            }
          })
        } else {
          hideOverlay(true)
        }
      }
    }

    const badgeEl = doc.createElement('div')
    badgeEl.setAttribute(
      'style',
      'margin-top:16px;padding:8px 14px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;font-size:12px;color:#94a3b8;display:inline-block'
    )
    badgeEl.textContent = `👤 Сдача теста: ${safeLabel}`

    box.append(iconEl, titleEl, msgEl, btn, doc.createElement('br'), badgeEl)
    ov.appendChild(box)
  }

  const recordViolation = (reason: string, title = texts.warnTitle, msg = texts.warnMsg) => {
    blackoutSync()
    scrubClipboardBurst()
    const n = Date.now()
    if (n - lastWarn >= 700) {
      lastWarn = n
      onViolation(reason)
    }
    showShield(title, msg, 'violation')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const k = (e.key || '').toLowerCase()
    const code = (e.code || '').toLowerCase()

    // 1. ПРЕВЕНТИВНЫЙ BLACKOUT на Win (Meta/OS) и Alt!
    // На Windows Win+Shift+S замораживает экран ДО того, как 'S' дойдёт до браузера —
    // но нажатие Meta приходит за 150-500 мс раньше. Мгновенно гасим экран в этот же кадр!
    if (
      e.key === 'Meta' || e.key === 'OS' || e.metaKey ||
      code === 'metaleft' || code === 'metaright' ||
      e.key === 'PrintScreen' || k === 'printscreen' || code === 'printscreen'
    ) {
      e.preventDefault()
      recordViolation(
        'screenshot_key',
        texts.warnTitle,
        'Клавиши Win / Cmd / PrintScreen заблокированы во время теста. Экран скрыт автоматически.',
      )
      return
    }

    // Alt + любая клавиша (Alt+PrintScreen, Alt+Tab) -> мгновенно гасим экран
    if (e.key === 'Alt' || e.altKey) {
      blackoutSync()
      showShield(texts.blurTitle, 'Системные комбинации с Alt запрещены во время теста.', 'focus')
      return
    }

    // F12 DevTools
    if (e.key === 'F12') {
      e.preventDefault()
      recordViolation('devtools')
      return
    }

    // Ctrl+Shift+I / J / C / S (DevTools / Скриншот браузера)
    if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's', 'k', 'm'].includes(k)) {
      e.preventDefault()
      recordViolation('devtools_or_shot')
      return
    }

    // Ctrl+C, Ctrl+X, Ctrl+S, Ctrl+P, Ctrl+U
    if (e.ctrlKey && ['c', 'x', 's', 'p', 'u'].includes(k)) {
      e.preventDefault()
      recordViolation('copy_or_print')
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    const k = (e.key || '').toLowerCase()
    const code = (e.code || '').toLowerCase()
    if (e.key === 'PrintScreen' || k === 'printscreen' || code === 'printscreen') {
      recordViolation('printscreen_up')
    }
  }

  const onCtx = (e: Event) => {
    e.preventDefault()
    recordViolation('contextmenu')
  }

  const onCopy = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    recordViolation('copy')
  }

  const onDrag = (e: Event) => e.preventDefault()

  const onBlur = () => {
    scrubClipboardBurst()
    if (lockedReason !== 'violation' && lockedReason !== 'fullscreen') {
      recordViolation('window_blur', texts.blurTitle, 'Окно теста потеряло фокус (переключение окна или инструмент скриншота).')
    } else {
      blackoutSync()
    }
  }

  const onFocus = () => {
    scrubClipboardBurst()
    if (lockedReason === 'focus') {
      if (requireFs && !doc.fullscreenElement) {
        showShield('Требуется полноэкранный режим', 'Для продолжения теста вернитесь в полноэкранный режим.', 'fullscreen')
      } else {
        hideOverlay(true)
      }
    }
  }

  const onVis = () => {
    if (doc.hidden) {
      recordViolation('tab_hidden', texts.blurTitle, 'Переключение вкладки или сворачивание браузера зафиксировано как нарушение.')
    }
  }

  const onMouseLeave = () => {
    blackoutSync()
    if (!lockedReason) {
      showShield(texts.blurTitle, 'Курсор вышел за пределы окна теста. Верните курсор внутрь окна.', 'focus')
    }
  }

  // Если курсор тянется к самой верхней/нижней кромке (панель браузера / кнопка «Снимок экрана» в Edge / панель задач)
  const onMouseMove = (e: MouseEvent) => {
    if (lockedReason === 'focus' && e.clientY > 14 && e.clientY < window.innerHeight - 14 && !doc.hidden && doc.hasFocus()) {
      if (!requireFs || doc.fullscreenElement) {
        hideOverlay(true)
      }
      return
    }
    if (!lockedReason && (e.clientY <= 3 || e.clientY >= window.innerHeight - 3)) {
      blackoutSync()
      showShield(texts.blurTitle, 'Не уводите курсор к панели инструментов браузера во время теста.', 'focus')
    }
  }

  const onFs = () => {
    if (doc.fullscreenElement) {
      enteredFsOnce = true
      if (lockedReason === 'fullscreen') {
        hideOverlay(true)
      }
      initInnerW = window.innerWidth
      initInnerH = window.innerHeight
    } else if (requireFs) {
      // Выход из полноэкранного режима: фиксируем нарушение и держим жёсткий замок до возврата!
      if (enteredFsOnce) {
        onViolation('exit_fullscreen')
      }
      showShield(
        'Вы вышли из полноэкранного режима',
        'Вопросы скрыты. Чтобы продолжить тест, нажмите кнопку ниже и вернитесь на весь экран.',
        'fullscreen',
      )
    }
  }

  const onResize = () => {
    // Резкое сужение окна (открыли DevTools сбоку/снизу или включили разделение экрана)
    if (!doc.fullscreenElement && requireFs && enteredFsOnce) {
      showShield('Вы вышли из полноэкранного режима', 'Вернитесь в полноэкранный режим для продолжения теста.', 'fullscreen')
      return
    }
    const dw = Math.abs(window.innerWidth - initInnerW)
    const dh = Math.abs(window.innerHeight - initInnerH)
    if (doc.fullscreenElement && (dw > 160 || dh > 160)) {
      recordViolation('window_resize', texts.warnTitle, 'Обнаружено изменение размера окна (DevTools или сторонняя панель).')
    }
  }

  const beforePrint = () => {
    recordViolation('print')
  }

  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('contextmenu', onCtx, true)
  window.addEventListener('copy', onCopy, true)
  window.addEventListener('cut', onCopy, true)
  window.addEventListener('dragstart', onDrag, true)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  window.addEventListener('resize', onResize)
  doc.addEventListener('visibilitychange', onVis)
  doc.addEventListener('mouseleave', onMouseLeave)
  doc.addEventListener('mousemove', onMouseMove, { passive: true })
  doc.addEventListener('fullscreenchange', onFs)
  window.addEventListener('beforeprint', beforePrint)

  // Если полноэкранный режим обязателен, но ещё не активен — сразу показываем шторку входа в Fullscreen
  if (requireFs && !doc.fullscreenElement) {
    showShield(
      'Защищённый полноэкранный режим',
      'Нажмите кнопку ниже, чтобы открыть тест на весь экран. При попытке выйти или сделать скриншот экран мгновенно скроется.',
      'fullscreen',
    )
  }

  release = () => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp, true)
    window.removeEventListener('contextmenu', onCtx, true)
    window.removeEventListener('copy', onCopy, true)
    window.removeEventListener('cut', onCopy, true)
    window.removeEventListener('dragstart', onDrag, true)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('resize', onResize)
    doc.removeEventListener('visibilitychange', onVis)
    doc.removeEventListener('mouseleave', onMouseLeave)
    doc.removeEventListener('mousemove', onMouseMove)
    doc.removeEventListener('fullscreenchange', onFs)
    window.removeEventListener('beforeprint', beforePrint)
    for (const tid of scrubTimers) window.clearTimeout(tid)
    scrubTimers.length = 0
    hideOverlay(true)
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

export function requestGuardFullscreen(): Promise<void> {
  const el = document.documentElement
  const fn = el.requestFullscreen?.bind(el)
  if (!fn) return Promise.resolve()
  return fn({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {})
}
