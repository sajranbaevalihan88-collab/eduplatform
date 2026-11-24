/**
 * Строгий HTML-санитизатор для текстового редактора документов.
 * Использует whitelist тегов, атрибутов и CSS-свойств; блокирует SVG, MathML, XSS,
 * javascript: схемы, form-hijacking и стилевые инъекции.
 */

const ALLOWED_TAGS = new Set([
  'p', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'blockquote', 'hr', 'br',
  'a', 'img', 'font', 'pre', 'code', 'div', 'sub', 'sup',
])

const ALLOWED_ATTRS = new Set([
  'style', 'class', 'href', 'target', 'rel', 'src', 'alt', 'title',
  'width', 'height', 'colspan', 'rowspan', 'border',
  'color', 'size', 'face', 'align', 'valign',
  'data-free', 'data-fixed', 'data-word-meta', 'data-frame', 'data-zebra',
])

const ALLOWED_CSS_PROPS = new Set([
  'color', 'background', 'background-color', 'font-family', 'font-size',
  'font-weight', 'font-style', 'text-decoration', 'text-align', 'text-indent',
  'line-height', 'letter-spacing', 'vertical-align', 'white-space',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
  'border-color', 'border-width', 'border-style', 'border-radius', 'border-collapse',
  'width', 'max-width', 'min-width', 'height', 'display', 'float', 'clear',
  'list-style', 'list-style-type', 'page-break-after', 'break-after',
])

const SAFE_URL_PATTERN = /^(?:https?:\/\/|mailto:|#|\/(?!\/))/i
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i

function sanitizeStyleAttr(raw: string): string {
  const out: string[] = []
  for (const part of raw.split(';')) {
    const idx = part.indexOf(':')
    if (idx <= 0) continue
    const prop = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    if (!ALLOWED_CSS_PROPS.has(prop) || !val) continue
    // Запрещаем CSS-экранирование, url(), expression(), behavior, @import, javascript
    if (/[\\<>]|expression|javascript|behavior|@import|url\s*\(/i.test(val)) continue
    out.push(`${prop}:${val}`)
  }
  return out.join(';')
}

export function sanitizeWordHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return ''
  try {
    const tpl = document.createElement('template')
    tpl.innerHTML = rawHtml

    // 1. Немедленно удаляем опасные контейнеры
    tpl.content
      .querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math,template,noscript')
      .forEach(el => el.remove())

    const cleanNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const tagName = el.tagName.toLowerCase()

        if (!ALLOWED_TAGS.has(tagName)) {
          // Неразрешённый тег: разворачиваем и ОБЯЗАТЕЛЬНО рекурсивно санитизируем каждого ребёнка
          const parent = el.parentNode
          if (parent) {
            const children = Array.from(el.childNodes)
            for (const child of children) {
              parent.insertBefore(child, el)
              cleanNode(child)
            }
            parent.removeChild(el)
          }
          return
        }

        // Фильтрация атрибутов
        for (const attr of Array.from(el.attributes)) {
          const attrName = attr.name.toLowerCase()

          if (attrName.startsWith('on') || attrName === 'srcdoc' || !ALLOWED_ATTRS.has(attrName)) {
            el.removeAttribute(attr.name)
            continue
          }

          if (attrName === 'href') {
            const val = attr.value.trim()
            if (!SAFE_URL_PATTERN.test(val)) {
              el.removeAttribute(attr.name)
            } else {
              el.setAttribute('rel', 'noopener noreferrer')
            }
          }

          if (attrName === 'src') {
            const val = attr.value.trim()
            if (!SAFE_URL_PATTERN.test(val) && !SAFE_DATA_IMAGE_PATTERN.test(val)) {
              el.removeAttribute(attr.name)
            }
          }

          if (attrName === 'style') {
            const cleaned = sanitizeStyleAttr(attr.value)
            if (cleaned) el.setAttribute('style', cleaned)
            else el.removeAttribute(attr.name)
          }

          if (attrName === 'class') {
            const cleanedClass = attr.value.replace(/\bsel\b/g, '').trim()
            if (cleanedClass) el.setAttribute('class', cleanedClass)
            else el.removeAttribute('class')
          }
        }
      }

      Array.from(node.childNodes).forEach(cleanNode)
    }

    Array.from(tpl.content.childNodes).forEach(cleanNode)

    // Разворачиваем обычные div (оставляя div.page-break, div.word-frame и div.word-meta)
    tpl.content.querySelectorAll('div:not(.page-break):not(.word-frame):not(.word-meta)').forEach(d => {
      const parent = d.parentNode
      if (!parent) return
      while (d.firstChild) parent.insertBefore(d.firstChild, d)
      parent.removeChild(d)
    })

    return tpl.innerHTML
  } catch {
    return ''
  }
}

export const sanitizeHtml = sanitizeWordHtml

