import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client, { WS_BASE } from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { sfx } from '../utils/sfx'
import { Zap, CheckCircle2, XCircle, Trophy, Flame, Loader2 } from 'lucide-react'

const AVATARS = ['🦅', '🐺', '🐆', '🦊', '🐴', '🦁', '🐼', '🚀']
const BTN_STYLES = [
  { bg: 'bg-rose-600 hover:bg-rose-500', shape: '▲' },
  { bg: 'bg-blue-600 hover:bg-blue-500', shape: '◆' },
  { bg: 'bg-amber-500 hover:bg-amber-400 text-slate-950', shape: '●' },
  { bg: 'bg-emerald-600 hover:bg-emerald-500', shape: '■' },
]

export default function LiveQuizPlay() {
  const { t } = useLang()
  const [params] = useSearchParams()
  const [pin, setPin] = useState(() => (params.get('pin') || '').replace(/\D/g, '').slice(0, 6))
  const [name, setName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null')
      return u?.first_name || u?.username || ''
    } catch { return '' }
  })
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [joining, setJoining] = useState(false)

  const [phase, setPhase] = useState<'join' | 'lobby' | 'question' | 'answered' | 'reveal' | 'podium'>('join')
  const [roomMeta, setRoomMeta] = useState<any>(null)
  const [curQ, setCurQ] = useState<any>(null)
  const [remSec, setRemSec] = useState(0)
  const [pickedOpt, setPickedOpt] = useState<number | null>(null)
  const [myRes, setMyRes] = useState<any>(null)
  const [podium, setPodium] = useState<any>(null)
  const [myId, setMyId] = useState('')

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => () => { try { wsRef.current?.close() } catch {} }, [])

  useEffect(() => {
    if (phase !== 'question' || remSec <= 0) return
    const id = window.setInterval(() => setRemSec(s => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [phase, remSec > 0])

  const joinRoom = async () => {
    const cleanPin = pin.replace(/\D/g, '')
    if (cleanPin.length !== 6) { toast('Введи 6 цифр PIN-кода с экрана учителя', 'error'); return }
    if (!name.trim()) { toast('Введи своё имя', 'error'); return }
    setJoining(true)
    try {
      await client.get(`/live-quiz/check/${cleanPin}/`)
    } catch {
      toast('Комната с таким PIN не найдена', 'error')
      setJoining(false)
      return
    }

    const ws = new WebSocket(`${WS_BASE}/ws/quiz/${cleanPin}/`)
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'player_join', name: name.trim(), avatar }))
    }
    ws.onmessage = (ev) => {
      let m: any = null
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'joined') {
        setJoining(false)
        setMyId(m.player_id || '')
        setRoomMeta(m)
        setPhase('lobby')
        sfx('fb.level')
      } else if (m.type === 'question') {
        setCurQ(m)
        setRemSec(m.time_limit || 20)
        setPickedOpt(null)
        setMyRes(null)
        setPhase('question')
        sfx('fb.plant')
      } else if (m.type === 'answer_ack') {
        setPhase('answered')
        sfx('fb.chip')
      } else if (m.type === 'reveal') {
        setMyRes(m.me || { correct: false, points_gained: 0, total_score: 0, rank: 1, streak: 0 })
        setPhase('reveal')
        sfx(m.me?.correct ? 'fb.big' : 'cm.wrong')
      } else if (m.type === 'podium') {
        setPodium(m)
        setPhase('podium')
        sfx('fb.level')
      } else if (m.type === 'error') {
        setJoining(false)
        toast(m.message || 'Ошибка подключения', 'error')
      }
    }
    ws.onerror = () => { setJoining(false); toast('Не удалось подключиться к комнате', 'error') }
  }

  const sendAnswer = (optIdx: number) => {
    if (pickedOpt !== null) return
    setPickedOpt(optIdx)
    try { wsRef.current?.send(JSON.stringify({ type: 'answer', option: optIdx })) } catch {}
  }

  const myFinalRow = (podium?.leaderboard || []).find((r: any) => r.id === myId)

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-indigo-950 via-violet-950 to-slate-950 px-3 py-6 text-white flex flex-col items-center justify-center" data-testid="live-play-page">
      <div className="w-full max-w-md space-y-5">
        {/* 1. ВХОД ПО PIN */}
        {phase === 'join' && (
          <div className="bg-slate-900/90 border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="text-4xl">⚡</div>
              <h1 className="text-2xl font-display font-black">{t('games_livequiz')}</h1>
              <p className="text-xs text-indigo-200">Введи PIN-код с проектора учителя — можно играть без входа в аккаунт!</p>
            </div>

            <div className="space-y-3">
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="PIN-код (6 цифр)"
                data-testid="lqp-pin"
                className="w-full text-center text-3xl font-mono font-black tracking-[0.2em] py-3.5 rounded-2xl bg-slate-950 border-2 border-indigo-400/50 focus:border-amber-400 outline-none text-amber-300"
              />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinRoom()}
                maxLength={24}
                placeholder="Твоё имя"
                data-testid="lqp-name"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-white/15 focus:border-indigo-400 outline-none text-base font-bold text-center"
              />
              <div>
                <div className="text-xs text-center text-indigo-300 mb-1.5 font-semibold">Выбери аватар:</div>
                <div className="grid grid-cols-8 gap-1">
                  {AVATARS.map(av => (
                    <button key={av} type="button" onClick={() => setAvatar(av)}
                      className={`h-10 rounded-xl text-xl flex items-center justify-center transition ${avatar === av ? 'bg-amber-400 scale-110 shadow' : 'bg-white/10 hover:bg-white/20'}`}>
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={joinRoom}
                disabled={joining}
                data-testid="lqp-join-btn"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-black text-lg shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {joining ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} className="fill-slate-950" />} ВОЙТИ В ИГРУ
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-between text-xs text-indigo-300">
              <Link to="/games" className="hover:text-white">← К играм</Link>
              <Link to="/live/host" className="hover:text-amber-300 font-bold">Я учитель (создать PIN) →</Link>
            </div>
          </div>
        )}

        {/* 2. ОЖИДАНИЕ В ЛОББИ */}
        {phase === 'lobby' && (
          <div className="bg-slate-900/90 border border-indigo-400/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl" data-testid="lqp-lobby">
            <div className="text-6xl fb-hop">{avatar}</div>
            <div className="text-2xl font-black">{name}</div>
            <div className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-sm">
              ✓ Ты в игре! {roomMeta?.title}
            </div>
            <p className="text-sm text-indigo-200 animate-pulse">Смотри на экран проектора — учитель скоро нажмёт «Старт» 👀</p>
          </div>
        )}

        {/* 3. ВОПРОС — 4 ГИГАНТСКИЕ ЦВЕТНЫЕ КНОПКИ */}
        {phase === 'question' && curQ && (
          <div className="space-y-4" data-testid="lqp-question">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="px-3 py-1 rounded-xl bg-white/10">Вопрос {curQ.q_index + 1}/{curQ.total}</span>
              {curQ.is_double && <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">⚡ ×2</span>}
              <span className={`px-3 py-1 rounded-xl font-mono font-black ${remSec <= 5 ? 'bg-rose-600 animate-pulse' : 'bg-indigo-600'}`}>⏱ {remSec}с</span>
            </div>

            <div className="p-4 rounded-2xl bg-white text-slate-900 font-extrabold text-center text-base sm:text-lg shadow-xl">
              {curQ.text}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(curQ.options || []).map((o: any, idx: number) => {
                const st = BTN_STYLES[idx % 4]
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendAnswer(idx)}
                    data-testid={`lqp-opt-${idx}`}
                    className={`${st.bg} min-h-[78px] px-5 py-4 rounded-2xl font-extrabold text-lg flex items-center gap-4 text-left shadow-xl active:scale-95 transition`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-2xl shrink-0">{st.shape}</span>
                    <span className="leading-tight">{o.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 4. ОТВЕТ ОТПРАВЛЕН */}
        {phase === 'answered' && (
          <div className="bg-slate-900/90 border border-white/15 rounded-3xl p-8 text-center space-y-3 shadow-2xl">
            <Loader2 size={44} className="animate-spin text-amber-400 mx-auto" />
            <div className="text-xl font-black">Ответ отправлен!</div>
            <p className="text-sm text-indigo-200">Ждём остальных игроков и проверяем результат…</p>
          </div>
        )}

        {/* 5. РЕЗУЛЬТАТ ВОПРОСА */}
        {phase === 'reveal' && myRes && (
          <div className={`rounded-3xl p-7 text-center space-y-4 shadow-2xl border-2 ${
            myRes.correct ? 'bg-emerald-600/90 border-emerald-300' : 'bg-rose-600/90 border-rose-300'
          }`} data-testid="lqp-reveal">
            {myRes.correct
              ? <CheckCircle2 size={56} className="mx-auto text-white" />
              : <XCircle size={56} className="mx-auto text-white" />}
            <div className="text-3xl font-black">{myRes.correct ? 'ВЕРНО!' : 'НЕВЕРНО'}</div>
            {myRes.points_gained > 0 && (
              <div className="inline-block px-4 py-1.5 rounded-2xl bg-black/25 font-mono font-black text-2xl text-amber-300">
                +{myRes.points_gained}
              </div>
            )}
            {myRes.streak >= 2 && (
              <div className="flex items-center justify-center gap-1 text-amber-200 font-bold text-sm">
                <Flame size={16} /> Огненная серия ×{myRes.streak}!
              </div>
            )}
            <div className="pt-2 border-t border-white/25 text-sm font-bold">
              Твоё место: <b>#{myRes.rank}</b> · Всего: <b>{myRes.total_score}</b> очков
            </div>
          </div>
        )}

        {/* 6. ФИНАЛ */}
        {phase === 'podium' && (
          <div className="bg-slate-900/90 border-2 border-amber-400/50 rounded-3xl p-7 text-center space-y-4 shadow-2xl" data-testid="lqp-podium">
            <Trophy size={54} className="mx-auto text-amber-400 fb-hop" />
            <h2 className="text-2xl font-black">Игра завершена!</h2>
            {myFinalRow && (
              <div className="p-4 rounded-2xl bg-white/10 space-y-1">
                <div className="text-3xl">{myFinalRow.avatar}</div>
                <div className="font-extrabold text-lg">Твоё место: #{myFinalRow.rank}</div>
                <div className="font-mono font-black text-2xl text-amber-300">{myFinalRow.score} очков</div>
                <div className="text-xs text-indigo-200">Верных ответов: {myFinalRow.correct}</div>
              </div>
            )}
            <button type="button" onClick={() => { try { wsRef.current?.close() } catch {}; setPhase('join'); setPin('') }}
              className="w-full py-3.5 rounded-2xl bg-amber-400 text-slate-950 font-black">
              Войти в новую игру
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
