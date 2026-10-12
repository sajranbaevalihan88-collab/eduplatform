import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useAccessibility } from '../context/UIContext'
import { playNotifySound } from '../utils/sound'
import SpeakableText from '../components/SpeakableText'
import { Bell, BellOff, Play, Pause, Trash2, Plus, Check, Volume2, Timer } from 'lucide-react'

type Note = {
  id: number | string
  title: string
  text: string
  remind_at: string | null
  reminded?: boolean
  timer_sec: number
  done?: boolean
  _left?: number
  _running?: boolean
  _local?: boolean
}

type Ringtone = 'standard' | 'wave' | 'alarm'

const LS_KEY = 'edu-notes-v1'
const LS_RING = 'edu-notes-ringtone'
const LS_VOL = 'edu-notes-volume'

function loadLocal(): Note[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

// Рингтоны: MP3 из /sounds, фолбэк — общий движок (там свой WebAudio-синт)
export function playRingtone(name: Ringtone, volume = 0.8) {
  playNotifySound(name, volume)
}

const RINGTONES: { id: Ringtone; label: string }[] = [
  { id: 'standard', label: 'Стандарт' },
  { id: 'wave', label: 'Волна' },
  { id: 'alarm', label: 'Тревога' },
]

export default function Notes() {
  const { speak, rate, setRate, volume: voiceVol, setVolume: setVoiceVol, voiceLang, setLang } = useAccessibility()
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [timerH, setTimerH] = useState(0)
  const [timerM, setTimerM] = useState(25)
  const [timerS, setTimerS] = useState(0)
  const [ringtone, setRingtone] = useState<Ringtone>(() => (localStorage.getItem(LS_RING) as Ringtone) || 'standard')
  const [ringVol, setRingVol] = useState(() => {
    const v = parseFloat(localStorage.getItem(LS_VOL) || '0.8')
    return isNaN(v) ? 0.8 : Math.max(0, Math.min(1, v))
  })
  const [online, setOnline] = useState(true)
  const timers = useRef<Record<string, any>>({})

  // загрузка: сначала бэк, при ошибке — localStorage (для стенда без интернета)
  useEffect(() => {
    client.get('/notes/').then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data.results || []
      setNotes(arr.map((n: any) => ({ ...n, _left: n.timer_sec || 0, _running: false })))
      setOnline(true)
    }).catch(() => {
      setNotes(loadLocal().map(n => ({ ...n, _local: true, _left: n.timer_sec || 0 })))
      setOnline(false)
    })
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const p: any = (Notification as any).requestPermission?.()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }
    } catch {}
  }, [])

  const persistLocal = (arr: Note[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr.map(({ _left, _running, ...rest }) => rest))) } catch {}
  }

  const saveRingtone = (r: Ringtone) => {
    setRingtone(r)
    try { localStorage.setItem(LS_RING, r) } catch {}
  }
  const saveRingVol = (v: number) => {
    const c = Math.max(0, Math.min(1, v))
    setRingVol(c)
    try { localStorage.setItem(LS_VOL, String(c)) } catch {}
  }

  const notify = (title: string, body: string) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    } catch {}
    playRingtone(ringtone, ringVol)
    speak(`${title}. ${body}`)
  }

  // проверка напоминаний по дате каждые 5 сек
  useEffect(() => {
    const iv = setInterval(() => {
      setNotes(prev => prev.map(n => {
        if (n.reminded || !n.remind_at || n.done) return n
        const t = new Date(n.remind_at).getTime()
        if (!isNaN(t) && Date.now() >= t) {
          notify('Напоминание', n.title)
          // помечаем на бэке один раз
          if (!n._local && typeof n.id === 'number') {
            client.patch(`/notes/${n.id}/`, { reminded: true }).catch(() => {})
          }
          return { ...n, reminded: true }
        }
        return n
      }))
    }, 5000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringtone, ringVol])

  // отсчёт в заголовке вкладки — жюри видит со спины
  useEffect(() => {
    const running = notes.find(n => n._running && (n._left ?? 0) > 0)
    if (running) {
      const s = running._left ?? running.timer_sec
      document.title = `⏰ ${fmt(s)} • ${running.title}`
    } else {
      document.title = 'EduPlatform AI — Уроки, Тесты, Игры и Аркан тартыш'
    }
  }, [notes])

  // ушли со страницы — вернули нормальный заголовок
  useEffect(() => () => {
    document.title = 'EduPlatform — Уроки, Презентации, Тесты'
  }, [])

  // Esc — стоп всех таймеров (озвучку стопает провайдер)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        Object.values(timers.current).forEach(clearInterval)
        timers.current = {}
        setNotes(ns => ns.map(x => ({ ...x, _running: false })))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const timerTotal = Math.max(0, Math.min(24 * 3600,
    (timerH || 0) * 3600 + (timerM || 0) * 60 + (timerS || 0)))

  const setPreset = (sec: number) => {
    setTimerH(Math.floor(sec / 3600))
    setTimerM(Math.floor((sec % 3600) / 60))
    setTimerS(sec % 60)
  }

  const create = async () => {
    const payload = {
      title: title.trim() || 'Заметка',
      text: text.trim(),
      remind_at: remindAt ? new Date(remindAt).toISOString() : null,
      timer_sec: timerTotal,
    }
    try {
      const r = await client.post('/notes/', payload)
      const created = { ...r.data, _left: r.data.timer_sec || 0, _running: false }
      setNotes(ns => {
        const next = [created, ...ns]
        persistLocal(next)
        return next
      })
    } catch {
      // офлайн — только локально, для демо на стенде
      const local: Note = {
        id: `local-${Date.now()}`, ...payload,
        _left: payload.timer_sec, _running: false, _local: true,
      }
      setNotes(ns => {
        const next = [local, ...ns]
        persistLocal(next)
        return next
      })
      setOnline(false)
    }
    setTitle(''); setText(''); setRemindAt('')
  }

  const remove = async (id: number | string) => {
    const key = String(id)
    if (timers.current[key]) { clearInterval(timers.current[key]); delete timers.current[key] }
    setNotes(ns => {
      const next = ns.filter(n => n.id !== id)
      persistLocal(next)
      return next
    })
    if (typeof id === 'number') {
      try { await client.delete(`/notes/${id}/`) } catch {}
    }
  }

  const toggleDone = async (n: Note) => {
    const next = { ...n, done: !n.done }
    setNotes(ns => {
      const arr = ns.map(x => x.id === n.id ? next : x)
      persistLocal(arr)
      return arr
    })
    if (typeof n.id === 'number' && !n._local) {
      try { await client.patch(`/notes/${n.id}/`, { done: next.done }) } catch {}
    }
  }

  const startTimer = (n: Note) => {
    const key = String(n.id)
    if (timers.current[key]) return
    if (!n._left || n._left <= 0) {
      // если таймер кончился — перезапуск на исходный
      setNotes(ns => ns.map(x => x.id === n.id ? { ...x, _left: x.timer_sec } : x))
    }
    setNotes(ns => ns.map(x => x.id === n.id ? { ...x, _running: true } : x))
    timers.current[key] = setInterval(() => {
      setNotes(prev => prev.map(x => {
        if (x.id !== n.id) return x
        const left = (x._left ?? x.timer_sec) - 1
        if (left <= 0) {
          clearInterval(timers.current[key])
          delete timers.current[key]
          notify('Таймер вышел', x.title)
          return { ...x, _left: 0, _running: false }
        }
        return { ...x, _left: left }
      }))
    }, 1000)
  }

  const stopTimer = (n: Note) => {
    const key = String(n.id)
    if (timers.current[key]) {
      clearInterval(timers.current[key])
      delete timers.current[key]
    }
    setNotes(ns => ns.map(x => x.id === n.id ? { ...x, _running: false } : x))
  }

  useEffect(() => () => Object.values(timers.current).forEach(clearInterval), [])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display font-bold text-xl dark:text-white">Заметки ⏰</h1>
        {!online && <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">офлайн-режим (стенд)</span>}
        <button
          onClick={() => speak('Заметки. Напишите текст, поставьте дату напоминания или запустите таймер обратного отсчёта. Каждое предложение можно слушать отдельно.')}
          className="ml-auto p-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white"
          title="Озвучить раздел"
          aria-label="Озвучить раздел Заметки"
        ><Volume2 size={16} /></button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-3">
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Заголовок: Повторить глаголы"
          aria-label="Заголовок заметки"
          className="w-full px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-semibold"
        />
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Текст заметки... Каждое предложение можно будет слушать отдельно."
          aria-label="Текст заметки"
          className="w-full h-24 px-4 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 dark:text-slate-300">
            <Bell size={16} /> Напомнить:
            <input
              type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)}
              aria-label="Дата и время напоминания"
              className="px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white"
            />
          </label>
          <fieldset className="flex items-center gap-2 dark:text-slate-300">
            <Timer size={16} /> Таймер:
            <label className="flex items-center gap-1">Ч
              <input type="number" min={0} max={23} value={timerH} aria-label="Часы таймера"
                onChange={e => setTimerH(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                className="w-14 px-2 py-2 rounded-xl border dark:bg-slate-700 dark:text-white text-center" />
            </label>
            <label className="flex items-center gap-1">М
              <input type="number" min={0} max={59} value={timerM} aria-label="Минуты таймера"
                onChange={e => setTimerM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-14 px-2 py-2 rounded-xl border dark:bg-slate-700 dark:text-white text-center" />
            </label>
            <label className="flex items-center gap-1">С
              <input type="number" min={0} max={59} value={timerS} aria-label="Секунды таймера"
                onChange={e => setTimerS(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-14 px-2 py-2 rounded-xl border dark:bg-slate-700 dark:text-white text-center" />
            </label>
          </fieldset>
          <div className="flex gap-1" role="group" aria-label="Готовые пресеты таймера">
            {[{ l: '1:00', s: 60 }, { l: '5:00', s: 300 }, { l: '15:00', s: 900 }, { l: '25:00', s: 1500 }].map(p => (
              <button key={p.l} onClick={() => setPreset(p.s)}
                className={`px-2 py-1 rounded-lg text-xs font-bold ${timerTotal === p.s ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 dark:text-white'}`}>{p.l}</button>
            ))}
          </div>
          <button onClick={create} className="ml-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-violet-600 text-white font-semibold flex items-center gap-2">
            <Plus size={16} /> Добавить
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm pt-1 border-t border-slate-100 dark:border-slate-700">
          <label className="flex items-center gap-2 dark:text-slate-300">
            Рингтон:
            <select value={ringtone} onChange={e => saveRingtone(e.target.value as Ringtone)}
              aria-label="Выбор рингтона"
              className="px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white">
              {RINGTONES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <button onClick={() => playRingtone(ringtone, ringVol)}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white text-xs font-bold"
            aria-label="Прослушать рингтон">▶ Прослушать</button>
          <label className="flex items-center gap-2 dark:text-slate-300">
            Громкость:
            <input type="range" min={0} max={1} step={0.1} value={ringVol}
              onChange={e => saveRingVol(parseFloat(e.target.value))}
              aria-label="Громкость рингтона" className="w-24" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm pt-1 border-t border-slate-100 dark:border-slate-700" aria-label="Настройки голоса">
          <span className="dark:text-slate-300 font-semibold">Голос:</span>
          <label className="flex items-center gap-2 dark:text-slate-300">
            Скорость:
            <input type="range" min={0.5} max={2} step={0.25} value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              aria-label="Скорость озвучки" className="w-24" />
            <span className="text-xs w-8">{rate}x</span>
          </label>
          <label className="flex items-center gap-2 dark:text-slate-300">
            Громкость:
            <input type="range" min={0} max={1} step={0.1} value={voiceVol}
              onChange={e => setVoiceVol(parseFloat(e.target.value))}
              aria-label="Громкость озвучки" className="w-24" />
          </label>
          <label className="flex items-center gap-2 dark:text-slate-300">
            Язык:
            <select value={voiceLang} onChange={e => setLang(e.target.value)}
              aria-label="Язык озвучки"
              className="px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white">
              <option value="ru">Русский</option>
              <option value="ky">Кыргызча</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3" aria-live="polite">
        {notes.length === 0 && (
          <div className="text-center text-slate-400 py-8">Пока пусто — добавь первую заметку для демо: «Повторить урок», таймер 1 мин 30 сек.</div>
        )}
        {notes.map(n => (
          <article key={n.id} className={`bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-4 ${n.done ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => toggleDone(n)}
                aria-label={n.done ? `Вернуть заметку ${n.title}` : `Отметить выполненной: ${n.title}`}
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${n.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>
                {n.done && <Check size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <h2 className={`font-bold dark:text-white ${n.done ? 'line-through' : ''}`}>{n.title}</h2>
                {n.text && (
                  <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    <SpeakableText text={n.text} />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {n.remind_at && (
                    <span className={`px-2 py-1 rounded-full flex items-center gap-1 ${n.reminded ? 'bg-slate-100' : 'bg-amber-100 text-amber-700'}`}>
                      {n.reminded ? <BellOff size={12} /> : <Bell size={12} />}
                      {new Date(n.remind_at).toLocaleString()}
                      {!n.reminded && ' — напомню голосом'}
                    </span>
                  )}
                  {(n.timer_sec || 0) > 0 && (
                    <span role="timer" aria-label={`Осталось ${fmt(n._left ?? n.timer_sec)}`}
                      className="px-2 py-1 rounded-full bg-violet-100 text-violet-700 font-mono font-bold">
                      {fmt(n._left ?? n.timer_sec)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(n.timer_sec || 0) > 0 && (
                  n._running
                    ? <button onClick={() => stopTimer(n)} className="p-2 rounded-xl bg-amber-100 text-amber-700" title="Пауза (Esc — стоп всё)" aria-label={`Пауза таймера ${n.title}`}><Pause size={16} /></button>
                    : <button onClick={() => startTimer(n)} className="p-2 rounded-xl bg-emerald-100 text-emerald-700" title="Старт таймера" aria-label={`Старт таймера ${n.title}`}><Play size={16} /></button>
                )}
                <button onClick={() => n.text && speak(`${n.title}. ${n.text}`)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white" title="Озвучить целиком" aria-label={`Озвучить заметку ${n.title}`}><Volume2 size={16} /></button>
                <button onClick={() => remove(n.id)} className="p-2 rounded-xl bg-red-50 text-red-600" title="Удалить" aria-label={`Удалить заметку ${n.title}`}><Trash2 size={16} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
