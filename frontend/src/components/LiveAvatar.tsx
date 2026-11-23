import React from 'react'

export type BlookRarity = 'common' | 'rare' | 'epic' | 'legendary'

export const RARITY_META: Record<BlookRarity, { label: string; color: string; pill: string }> = {
  common: { label: 'Обычный', color: '#22c55e', pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' },
  rare: { label: 'Редкий', color: '#38bdf8', pill: 'bg-sky-500/20 text-sky-300 border-sky-400/40' },
  epic: { label: 'Эпический', color: '#c084fc', pill: 'bg-purple-500/20 text-purple-300 border-purple-400/40' },
  legendary: { label: 'Легендарный', color: '#fbbf24', pill: 'bg-amber-400/25 text-amber-300 border-amber-300/50' },
}

export const AVATAR_CHARS: ReadonlyArray<{
  id: string
  name: string
  rarity: BlookRarity
  base: string
  shade: string
  accent: string
}> = [
  // Обычные (Питомцы — в духе классических Blooks)
  { id: 'fox', name: 'Лисёнок', rarity: 'common', base: '#f97316', shade: '#c2410c', accent: '#fff7ed' },
  { id: 'cat', name: 'Котик', rarity: 'common', base: '#fbbf24', shade: '#d97706', accent: '#fef3c7' },
  { id: 'panda', name: 'Панда', rarity: 'common', base: '#f8fafc', shade: '#cbd5e1', accent: '#1e293b' },
  { id: 'frog', name: 'Лягушка', rarity: 'common', base: '#4ade80', shade: '#16a34a', accent: '#dcfce7' },
  { id: 'chick', name: 'Цыплёнок', rarity: 'common', base: '#fde047', shade: '#eab308', accent: '#f97316' },
  { id: 'bunny', name: 'Зайка', rarity: 'common', base: '#f9a8d4', shade: '#db2777', accent: '#fdf2f8' },
  { id: 'bear', name: 'Мишка', rarity: 'common', base: '#b45309', shade: '#78350f', accent: '#fde68a' },
  { id: 'dog', name: 'Щенок', rarity: 'common', base: '#d97706', shade: '#92400e', accent: '#fef3c7' },
  // Редкие (Животные Ала-Тоо)
  { id: 'leopard', name: 'Ак Илбирс', rarity: 'rare', base: '#e2e8f0', shade: '#94a3b8', accent: '#475569' },
  { id: 'wolf', name: 'Көк-Бөрү', rarity: 'rare', base: '#64748b', shade: '#334155', accent: '#e2e8f0' },
  { id: 'eagle', name: 'Беркут', rarity: 'rare', base: '#92400e', shade: '#451a03', accent: '#facc15' },
  { id: 'owl', name: 'Сова', rarity: 'rare', base: '#8b5cf6', shade: '#5b21b6', accent: '#fde047' },
  // Эпические
  { id: 'shark', name: 'Акула', rarity: 'epic', base: '#38bdf8', shade: '#0284c7', accent: '#f0f9ff' },
  { id: 'robot', name: 'Робот AI', rarity: 'epic', base: '#06b6d4', shade: '#0e7490', accent: '#0f172a' },
  // Легендарные
  { id: 'dragon', name: 'Дракон', rarity: 'legendary', base: '#10b981', shade: '#047857', accent: '#facc15' },
  { id: 'king', name: 'Король', rarity: 'legendary', base: '#f59e0b', shade: '#b45309', accent: '#fef08a' },
  { id: 'unicorn', name: 'Единорог', rarity: 'legendary', base: '#e879f9', shade: '#a21caf', accent: '#fde047' },
  { id: 'astro', name: 'Космонавт', rarity: 'legendary', base: '#f8fafc', shade: '#94a3b8', accent: '#3b82f6' },
]

// Совместимость со старыми вызовами
export const AVATAR_HATS = [{ id: 'none', label: 'Блук', emoji: '✨' }] as const
export const AVATAR_BGS = [{ id: 'blook', from: '#0ea5e9', to: '#6366f1' }] as const

export function buildAvatarCode(charId: string, _hatId = 'none', _bgId = 'blook'): string {
  return `av:${charId}:none:blook`
}

export function parseAvatarCode(code?: string): { isCustom: boolean; charId: string; raw: string } {
  const s = String(code || '').trim()
  if (s.startsWith('av:')) {
    const [, charId = 'fox'] = s.split(':')
    return { isCustom: true, charId, raw: s }
  }
  return { isCustom: false, charId: 'fox', raw: s || '🦊' }
}

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
}

/**
 * Аутентичный Blooket-стиль «Блук» (квадратный скруглённый персонаж-кубик с мягкой 3D-фаской).
 * Все 18 персонажей выполнены в ЕДИНОМ стиле, без неаккуратных шапок поверх рамки.
 */
export default function LiveAvatar({
  code,
  size = 'md',
  className = '',
  streak = 0,
}: {
  code?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  streak?: number
}) {
  const parsed = parseAvatarCode(code)
  const szCls = SIZE_MAP[size]

  if (!parsed.isCustom) {
    return (
      <span className={`inline-flex items-center justify-center rounded-2xl bg-white/15 shrink-0 select-none text-xl ${szCls} ${className}`}>
        {parsed.raw}
      </span>
    )
  }

  const ch = AVATAR_CHARS.find(c => c.id === parsed.charId) || AVATAR_CHARS[0]
  const id = ch.id
  const isLeg = ch.rarity === 'legendary'

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${szCls} ${className}`}
      style={{
        filter:
          streak >= 2
            ? 'drop-shadow(0 0 10px rgba(251,191,36,0.9))'
            : isLeg
              ? 'drop-shadow(0 4px 10px rgba(250,204,21,0.4))'
              : 'drop-shadow(0 3px 6px rgba(0,0,0,0.28))',
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        {/* ─── УШКИ / РОЖКИ / ПЛАВНИК / КОРОНА (аккуратно вписаны в силуэт Блука!) ─── */}
        {(id === 'fox' || id === 'cat' || id === 'wolf' || id === 'leopard') && (
          <g>
            <path d="M16,28 L16,8 Q16,3 22,6 L40,18 Z" fill={ch.shade} />
            <path d="M84,28 L84,8 Q84,3 78,6 L60,18 Z" fill={ch.shade} />
            <path d="M21,23 L21,12 L33,19 Z" fill={id === 'fox' || id === 'wolf' ? ch.accent : '#fda4af'} />
            <path d="M79,23 L79,12 L67,19 Z" fill={id === 'fox' || id === 'wolf' ? ch.accent : '#fda4af'} />
          </g>
        )}
        {(id === 'panda' || id === 'bear') && (
          <g>
            <circle cx="22" cy="18" r="13" fill={id === 'panda' ? '#1e293b' : ch.shade} />
            <circle cx="78" cy="18" r="13" fill={id === 'panda' ? '#1e293b' : ch.shade} />
            {id === 'bear' && (
              <>
                <circle cx="22" cy="18" r="7" fill={ch.accent} />
                <circle cx="78" cy="18" r="7" fill={ch.accent} />
              </>
            )}
          </g>
        )}
        {id === 'bunny' && (
          <g>
            <rect x="23" y="0" width="14" height="28" rx="7" fill={ch.base} />
            <rect x="63" y="0" width="14" height="28" rx="7" fill={ch.base} />
            <rect x="26.5" y="4" width="7" height="19" rx="3.5" fill="#fdf2f8" />
            <rect x="66.5" y="4" width="7" height="19" rx="3.5" fill="#fdf2f8" />
          </g>
        )}
        {id === 'dog' && (
          <g>
            <rect x="4" y="24" width="16" height="36" rx="8" fill={ch.shade} />
            <rect x="80" y="24" width="16" height="36" rx="8" fill={ch.shade} />
          </g>
        )}
        {id === 'frog' && (
          <g>
            <circle cx="26" cy="20" r="14" fill={ch.base} />
            <circle cx="74" cy="20" r="14" fill={ch.base} />
          </g>
        )}
        {id === 'chick' && (
          <path d="M44,18 Q50,4 56,18 Q62,10 60,22 L40,22 Q38,10 44,18 Z" fill="#f97316" />
        )}
        {id === 'eagle' && (
          <path d="M32,18 L44,6 L50,15 L56,6 L68,18 Z" fill="#fef3c7" />
        )}
        {id === 'owl' && (
          <g fill={ch.shade}>
            <polygon points="14,26 16,8 34,18" />
            <polygon points="86,26 84,8 66,18" />
          </g>
        )}
        {id === 'shark' && (
          <path d="M44,18 Q54,0 64,18 Z" fill={ch.shade} />
        )}
        {id === 'robot' && (
          <g>
            <line x1="50" y1="18" x2="50" y2="7" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
            <circle cx="50" cy="6" r="5" fill="#facc15" />
          </g>
        )}
        {id === 'dragon' && (
          <g>
            <polygon points="20,22 14,4 34,16" fill="#facc15" />
            <polygon points="80,22 86,4 66,16" fill="#facc15" />
            <polygon points="44,18 50,7 56,18" fill="#fde047" />
          </g>
        )}
        {id === 'king' && (
          <g>
            <polygon points="22,22 26,4 39,14 50,2 61,14 74,4 78,22" fill="#fde047" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="50" cy="14" r="3" fill="#ef4444" />
            <circle cx="34" cy="16" r="2.2" fill="#38bdf8" />
            <circle cx="66" cy="16" r="2.2" fill="#38bdf8" />
          </g>
        )}
        {id === 'unicorn' && (
          <g>
            <polygon points="18,24 18,8 34,18" fill={ch.shade} />
            <polygon points="82,24 82,8 66,18" fill={ch.shade} />
            <polygon points="50,0 41,22 59,22" fill="#fde047" />
            <line x1="45" y1="14" x2="55" y2="12" stroke="#f59e0b" strokeWidth="2" />
            <line x1="47" y1="8" x2="53" y2="7" stroke="#f59e0b" strokeWidth="1.8" />
          </g>
        )}

        {/* ─── ГЛАВНОЕ ТЕЛО БЛУКА (скруглённый квадрат Blooket с объёмным нижним краем!) ─── */}
        <rect x="10" y="16" width="80" height="80" rx="22" fill={ch.shade} />
        <rect x="10" y="16" width="80" height="72" rx="20" fill={ch.base} />
        {/* Мягкий глянцевый блик сверху (фирменная фишка Blooket) */}
        <rect x="20" y="21" width="60" height="8" rx="4" fill="#ffffff" opacity="0.22" />

        {/* ─── УЗОРЫ И ДЕТАЛИ МОРДОЧКИ ─── */}
        {id === 'fox' && (
          <path d="M10,58 Q30,76 50,62 Q70,76 90,58 L90,68 Q90,88 70,88 L30,88 Q10,88 10,68 Z" fill={ch.accent} />
        )}
        {id === 'wolf' && (
          <path d="M12,56 Q32,68 50,58 Q68,68 88,56 L88,68 Q88,88 68,88 L32,88 Q12,88 12,68 Z" fill={ch.accent} />
        )}
        {id === 'leopard' && (
          <g fill={ch.accent} opacity="0.55">
            <circle cx="24" cy="30" r="3.5" />
            <circle cx="76" cy="30" r="3.5" />
            <circle cx="50" cy="26" r="3" />
            <circle cx="20" cy="70" r="3.2" />
            <circle cx="80" cy="70" r="3.2" />
          </g>
        )}
        {id === 'cat' && (
          <g fill={ch.shade} opacity="0.55">
            <rect x="46" y="16" width="8" height="12" rx="3" />
            <rect x="35" y="16" width="6" height="9" rx="3" />
            <rect x="59" y="16" width="6" height="9" rx="3" />
          </g>
        )}
        {id === 'panda' && (
          <g fill="#1e293b">
            <ellipse cx="34" cy="48" rx="12" ry="10" transform="rotate(-14 34 48)" />
            <ellipse cx="66" cy="48" rx="12" ry="10" transform="rotate(14 66 48)" />
          </g>
        )}
        {id === 'eagle' && (
          <path d="M14,22 Q50,16 86,22 L86,44 Q50,36 14,44 Z" fill="#ffffff" />
        )}
        {id === 'owl' && (
          <g fill="#f5f3ff">
            <circle cx="35" cy="48" r="14" />
            <circle cx="65" cy="48" r="14" />
          </g>
        )}
        {id === 'shark' && (
          <>
            <path d="M10,64 L90,64 L90,68 Q90,88 70,88 L30,88 Q10,88 10,68 Z" fill="#f0f9ff" />
            <polygon points="30,64 36,74 42,64 48,74 54,64 60,74 66,64 70,73 74,64" fill="#ffffff" stroke="#0284c7" strokeWidth="1.2" />
          </>
        )}
        {id === 'robot' && (
          <rect x="20" y="32" width="60" height="30" rx="11" fill="#0f172a" />
        )}
        {id === 'astro' && (
          <rect x="19" y="27" width="62" height="44" rx="16" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2.5" />
        )}
        {id === 'dragon' && (
          <ellipse cx="50" cy="76" rx="26" ry="11" fill="#a7f3d0" opacity="0.65" />
        )}
        {id === 'frog' && (
          <ellipse cx="50" cy="73" rx="28" ry="12" fill="#dcfce7" opacity="0.7" />
        )}
        {id === 'king' && (
          <path d="M14,66 Q50,58 86,66 L86,74 Q86,88 70,88 L30,88 Q14,88 14,74 Z" fill="#fef3c7" />
        )}
        {id === 'unicorn' && (
          <path d="M22,20 Q36,34 50,24 Q64,34 78,20 Q62,14 50,18 Q38,14 22,20 Z" fill="#38bdf8" opacity="0.85" />
        )}

        {/* ─── ГЛАЗКИ (фирменные блестящие круглые глазки Blooket!) ─── */}
        {id === 'robot' ? (
          <g>
            <rect x="28" y="40" width="15" height="14" rx="5" fill="#22d3ee" />
            <rect x="57" y="40" width="15" height="14" rx="5" fill="#22d3ee" />
            <circle cx="33" cy="44" r="2.5" fill="#ffffff" />
            <circle cx="62" cy="44" r="2.5" fill="#ffffff" />
          </g>
        ) : id === 'astro' ? (
          <g>
            <circle cx="37" cy="48" r="6" fill="#38bdf8" />
            <circle cx="63" cy="48" r="6" fill="#38bdf8" />
            <circle cx="39" cy="46" r="2.4" fill="#ffffff" />
            <circle cx="65" cy="46" r="2.4" fill="#ffffff" />
            <path d="M26,35 Q36,30 48,32" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
          </g>
        ) : id === 'frog' ? (
          <g>
            <circle cx="27" cy="21" r="8" fill="#ffffff" />
            <circle cx="73" cy="21" r="8" fill="#ffffff" />
            <circle cx="27" cy="21" r="4.5" fill="#0f172a" />
            <circle cx="73" cy="21" r="4.5" fill="#0f172a" />
            <circle cx="28.5" cy="19.5" r="1.8" fill="#ffffff" />
            <circle cx="74.5" cy="19.5" r="1.8" fill="#ffffff" />
          </g>
        ) : (
          <g>
            <circle cx="34" cy="48" r="7" fill={id === 'panda' ? '#ffffff' : '#0f172a'} />
            <circle cx="66" cy="48" r="7" fill={id === 'panda' ? '#ffffff' : '#0f172a'} />
            <circle cx="36.2" cy="45.5" r="2.6" fill={id === 'panda' ? '#0f172a' : '#ffffff'} />
            <circle cx="68.2" cy="45.5" r="2.6" fill={id === 'panda' ? '#0f172a' : '#ffffff'} />
            <circle cx="31.8" cy="50.5" r="1.2" fill={id === 'panda' ? '#0f172a' : '#ffffff'} opacity="0.8" />
            <circle cx="63.8" cy="50.5" r="1.2" fill={id === 'panda' ? '#0f172a' : '#ffffff'} opacity="0.8" />
          </g>
        )}

        {/* ─── РУМЯНЕЦ (делает всех Блуков супер-милыми!) ─── */}
        {id !== 'robot' && id !== 'astro' && id !== 'shark' && (
          <g fill="#fb7185" opacity="0.4">
            <ellipse cx="22" cy="59" rx="5.5" ry="3.2" />
            <ellipse cx="78" cy="59" rx="5.5" ry="3.2" />
          </g>
        )}

        {/* ─── НОСИК / КЛЮВ / УЛЫБКА ─── */}
        {id === 'chick' || id === 'eagle' || id === 'owl' ? (
          <polygon points="42,54 58,54 50,68" fill="#facc15" stroke="#ca8a04" strokeWidth="1.8" strokeLinejoin="round" />
        ) : id === 'robot' ? (
          <rect x="33" y="70" width="34" height="7" rx="3.5" fill="#0f172a" />
        ) : id === 'astro' ? (
          <path d="M43,59 Q50,65 57,59" fill="none" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
        ) : id === 'shark' ? null : id === 'frog' ? (
          <path d="M32,54 Q50,68 68,54" fill="none" stroke="#14532d" strokeWidth="3.5" strokeLinecap="round" />
        ) : id === 'king' ? (
          <>
            <path d="M36,64 Q50,58 64,64" fill="none" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M43,72 Q50,77 57,72" fill="none" stroke="#78350f" strokeWidth="2.8" strokeLinecap="round" />
          </>
        ) : (
          <>
            {(id === 'bear' || id === 'dog' || id === 'leopard') && (
              <ellipse cx="50" cy="65" rx="16" ry="11" fill={id === 'leopard' ? '#ffffff' : ch.accent} />
            )}
            <ellipse cx="50" cy="60" rx="5.5" ry="4" fill="#0f172a" />
            <path d="M41,68 Q45.5,73 50,68 Q54.5,73 59,68" fill="none" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
          </>
        )}
      </svg>

      {/* Огненный бейдж серии */}
      {streak >= 2 && (
        <span className="absolute -bottom-1.5 -right-1.5 z-10 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 text-[9px] font-black leading-none shadow-md border border-white/60">
          🔥{streak}
        </span>
      )}
    </div>
  )
}
