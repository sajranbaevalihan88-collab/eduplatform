import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

let configured = false

/**
 * Monaco берём из локального node_modules, а не с CDN:
 * CDN jsdelivr отсюда отвечает нестабильно (таймауты на nls и языках),
 * из-за чего редактор навсегда висел на "Загрузка Monaco...".
 * Конфиг должен примениться ДО первого монтирования <Editor/>.
 */
export function configureMonacoLocale() {
  if (configured) return
  configured = true
  try {
    loader.config({ monaco })
  } catch {}
}
