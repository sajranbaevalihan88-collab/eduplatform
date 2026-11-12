/**
 * Строгий HTML-санитизатор для текстового редактора документов.
 * Использует whitelist тегов и атрибутов, блокирует SVG, MathML, XSS,
 * javascript: схемы, form-hijacking и стилевые инъекции.
 */

const ALLOWED_TAGS = new Set([
  'p', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'blockquote', 'hr', 'br',
  'a', 'img', 'font', 'pre', 'code', 'div', 'sub', 'sup'
])

const ALLOWED_ATTRS = new Set([
  'style', 'class', 'href', 'target', 'rel', 'src', 'alt', 'title',
  'width', 'height', 'colspan', 'rowspan', 'border',
  'color', 'size', 'face', 'align', 'valign'
])

const SAFE_URL_PATTERN = /^(?:https?:\/\/|mailto:|#|\/(?!\/))/i
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i

export function sanitizeWordHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return ''
  try {
    const tpl = document.createElement('template')
    tpl.innerHTML = rawHtml

    // 1. Немедленно удаляем опасные контейнеры
    tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,svg,math').forEach(el => el.remove())

    const cleanNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const tagName = el.tagName.toLowerCase()

        if (!ALLOWED_TAGS.has(tagName)) {
          // Неразрешенный тег: заменяем на его дочерние узлы
          const parent = el.parentNode
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el)
            }
            parent.removeChild(el)
          }
          return
        }

        // Фильтрация атрибутов
        for (const attr of Array.from(el.attributes)) {
          const attrName = attr.name.toLowerCase()

          // Удаляем on*, srcdoc, formaction или атрибуты не из whitelist
          if (attrName.startsWith('on') || attrName === 'srcdoc' || !ALLOWED_ATTRS.has(attrName)) {
            el.removeAttribute(attr.name)
            continue
          }

          // Проверка ссылок
          if (attrName === 'href') {
            const val = attr.value.trim()
            if (!SAFE_URL_PATTERN.test(val)) {
              el.removeAttribute(attr.name)
            } else {
              el.setAttribute('rel', 'noopener noreferrer')
            }
          }

          // Проверка картинок
          if (attrName === 'src') {
            const val = attr.value.trim()
            if (!SAFE_URL_PATTERN.test(val) && !SAFE_DATA_IMAGE_PATTERN.test(val)) {
              el.removeAttribute(attr.name)
            }
          }

          // Проверка стилей: запрещаем expression, javascript, url(), behavior
          if (attrName === 'style') {
            const val = attr.value.toLowerCase()
            if (/expression|javascript|behavior|@import|url\s*\(/i.test(val)) {
              el.removeAttribute(attr.name)
            }
          }

          // Удаляем служебные классы выделения
          if (attrName === 'class') {
            const cleanedClass = attr.value.replace(/\bsel\b/g, '').trim()
            if (cleanedClass) {
              el.setAttribute('class', cleanedClass)
            } else {
              el.removeAttribute('class')
            }
          }
        }
      }

      // Рекурсивный обход детей (копия массива)
      Array.from(node.childNodes).forEach(cleanNode)
    }

    Array.from(tpl.content.childNodes).forEach(cleanNode)

    // Разворачиваем обычные div (оставляя div.page-break)
    tpl.content.querySelectorAll('div:not(.page-break)').forEach(d => {
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

