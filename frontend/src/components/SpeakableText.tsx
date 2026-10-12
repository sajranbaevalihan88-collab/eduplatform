import { useState } from 'react'
import { useAccessibility } from '../context/UIContext'

function splitSentences(text: string): string[] {
  const parts = String(text || '').match(/[^.!?…]+[.!?…]?/g)?.map(x => x.trim()).filter(Boolean)
  if (parts && parts.length) return parts.slice(0, 60)
  const t = String(text || '').trim()
  return t ? [t] : []
}

/** Текст, где каждое предложение озвучивается по клику или Enter.
 *  Работает мышью, тапом на телефоне и Tab+Enter с клавиатуры (как скринридер). */
export default function SpeakableText({ text, className = '' }: { text: string; className?: string }) {
  const { speak } = useAccessibility()
  const [active, setActive] = useState(-1)
  const parts = splitSentences(text)
  if (!parts.length) return null
  if (parts.length === 1) {
    return (
      <span
        className={className}
        tabIndex={0}
        role="button"
        aria-label={`Слушать: ${parts[0].slice(0, 120)}`}
        title="Нажми чтобы слушать (Enter — тоже)"
        onClick={() => { setActive(0); speak(parts[0]); setTimeout(() => setActive(-1), 1200) }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(0); speak(parts[0]) }
        }}
        onFocus={() => setActive(0)}
        onBlur={() => setActive(-1)}
        style={active === 0 ? { background: 'rgba(139,92,246,0.15)', borderRadius: 6 } : undefined}
      >{parts[0]}</span>
    )
  }
  return (
    <span className={className} aria-label="Текст с озвучкой по предложениям">
      {parts.map((s, i) => (
        <span key={i}>
          <span
            tabIndex={0}
            role="button"
            aria-label={`Слушать предложение ${i + 1}: ${s.slice(0, 120)}`}
            title="Нажми чтобы слушать (Enter — тоже, Esc — стоп)"
            onClick={() => { setActive(i); speak(s); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); speak(s) }
            }}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(-1)}
            style={active === i
              ? { background: 'rgba(139,92,246,0.18)', borderRadius: 6, outline: '2px solid rgba(139,92,246,0.5)' }
              : { borderRadius: 6 }}
          >{s}</span>
          {' '}
        </span>
      ))}
    </span>
  )
}
