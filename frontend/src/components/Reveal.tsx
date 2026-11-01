import { useEffect, useRef, type ReactNode } from 'react'

/** Плавное появление блока при попадании во viewport (IntersectionObserver).
 *  Уважает prefers-reduced-motion и режим слабовидящих — там блоки видны сразу. */
export default function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('revealed')
        return
      }
    } catch {}
    let io: IntersectionObserver | null = null
    try {
      io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            el.classList.add('revealed')
            io?.disconnect()
          }
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
      io.observe(el)
    } catch {
      el.classList.add('revealed')
    }
    return () => io?.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}
