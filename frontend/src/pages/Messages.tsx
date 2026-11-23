import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { sfx } from '../utils/sfx'
import {
  MessageSquare, Send, Plus, ChevronLeft, Check, CheckCheck, Trash2,
  Search, Smile, Zap, Reply, Pencil, Copy, X, ArrowDown, Users, RefreshCw
} from 'lucide-react'

type Thread = {
  user: number
  username: string
  first_name?: string
  role: string
  last_text: string | null
  last_sender?: number
  last_status?: 'sent' | 'delivered' | 'read'
  last_at: string | null
  unread: number
  via_children?: string[]
}
type Contact = {
  id: number
  username: string
  role: string
  first_name?: string
  via_children?: string[]
}
type Msg = {
  id: number
  sender: number
  sender_name: string
  text: string
  created_at: string
  delivered_at: string | null
  read_at: string | null
  is_deleted: boolean
}
type PeerInfo = {
  id: number
  username: string
  first_name?: string
  role: string
  via_children?: string[]
}

const msgStatus = (m: Msg): 'sent' | 'delivered' | 'read' =>
  m.read_at ? 'read' : m.delivered_at ? 'delivered' : 'sent'

const roleLabel = (role: string, t: (k: string) => string) =>
  role === 'teacher' ? t('msg_role_teacher') : role === 'parent' ? t('msg_role_parent') : t('msg_role_admin')

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
]
const avatarGrad = (id: number) => AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length]

const QUICK_EMOJIS = ['👍', '👏', '😊', '🙏', '❤️', '✅', '⭐', '🔥', '📚', '📝', '💡', '🏆', '🎉', '👋', '🤝', '⏰', '📅', '📌', '❗', '❓']

const TEACHER_TEMPLATES = [
  'Здравствуйте! Хочу поделиться успехами вашего ребёнка — сегодня отлично поработал на уроке! 👏',
  'Добрый день! Напоминаю о домашнем задании, срок сдачи — завтра. 📚',
  'Здравствуйте! Обратите, пожалуйста, внимание на текущую тему — рекомендую дополнительно повторить дома. 💡',
  'Добрый день! Приглашаю вас на родительское собрание. Подскажите, удобно ли вам время? 📅',
  'Здравствуйте! Сообщаю о замене/переносе урока в расписании. ⏰',
]

const PARENT_TEMPLATES = [
  'Здравствуйте! Ребёнок сегодня приболел и не сможет прийти на урок. 🙏',
  'Добрый день! Подскажите, пожалуйста, что задали на дом по сегодняшней теме? 📚',
  'Спасибо большое за обратную связь и внимание к ребёнку! 😊',
  'Здравствуйте! Когда вам удобно обсудить успеваемость и план подготовки? 📅',
]

const ADMIN_TEMPLATES = [
  'Здравствуйте! Напоминаем об обновлении расписания и заполнении журнала посещаемости. 📌',
  'Добрый день! Пожалуйста, проверьте отчёт по успеваемости класса до конца недели. ✅',
  'Спасибо за оперативную работу! 👍',
]

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function formatThreadTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
}

function parseQuote(raw: string): { quoteAuthor?: string; quoteText?: string; body: string } {
  const m = raw.match(/^↩\s*\[([^\]]+)\]:\s*([^\n]+)\n\n([\s\S]*)$/)
  if (m) return { quoteAuthor: m[1], quoteText: m[2], body: m[3] }
  return { body: raw }
}

function renderTextWithLinks(text: string, isMine: boolean) {
  const parts = text.split(/(https?:\/\/[^\s]+|\/(?:live|lessons|tests|classes|games)[^\s]*)/g)
  return parts.map((part, idx) => {
    if (/^(https?:\/\/|\/(?:live|lessons|tests|classes|games))/.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target={part.startsWith('http') ? '_blank' : undefined}
          rel={part.startsWith('http') ? 'noopener noreferrer' : undefined}
          className={`underline font-semibold break-all ${isMine ? 'text-amber-200 hover:text-white' : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-800'}`}
        >
          {part}
        </a>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

export default function Messages() {
  const { t } = useLang()
  const [threads, setThreads] = useState<Thread[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [peer, setPeer] = useState<PeerInfo | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [sideTab, setSideTab] = useState<'all' | 'unread' | 'contacts'>('all')
  const [searchSide, setSearchSide] = useState('')

  // Интерактивные функции чата
  const [menuId, setMenuId] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<Msg | null>(null)
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollBoxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const prevLastMsgIdRef = useRef<number | null>(null)

  const meObj = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') as any } catch { return {} }
  })()
  const meId = meObj.id as number | undefined
  const meRole = (meObj.role || '') as string

  const loadThreads = useCallback(() => {
    client.get('/messages/threads/').then(r => {
      setThreads(r.data.threads || [])
    }).catch(() => {})
  }, [])

  const loadContacts = useCallback(() => {
    client.get('/messages/contacts/').then(r => {
      setContacts(r.data || [])
    }).catch(() => setContacts([]))
  }, [])

  useEffect(() => {
    loadThreads()
    loadContacts()
    const iv = setInterval(loadThreads, 8000)
    return () => clearInterval(iv)
  }, [loadThreads, loadContacts])

  const openPeer = useCallback((p: PeerInfo) => {
    setPeer(p)
    setShowPicker(false)
    setReplyTo(null)
    setEditingMsg(null)
    setChatSearchOpen(false)
    setChatSearch('')
    prevLastMsgIdRef.current = null
    sfx('ui.click')
  }, [])

  const loadMsgs = useCallback((pid: number, silent = false) => {
    client.get('/messages/', { params: { with_user: pid } }).then(r => {
      const list: Msg[] = r.data || []
      setMsgs(list)
      const last = list[list.length - 1]
      if (last) {
        if (silent && prevLastMsgIdRef.current !== null && last.id !== prevLastMsgIdRef.current) {
          const isIncoming = meId != null ? last.sender !== meId : true
          if (isIncoming) sfx('ui.notify')
        }
        prevLastMsgIdRef.current = last.id
      }
    }).catch(() => { if (!silent) setMsgs([]) })
  }, [meId])

  useEffect(() => {
    if (!peer) { setMsgs([]); return }
    loadMsgs(peer.id, false)
    const iv = setInterval(() => loadMsgs(peer.id, true), 3500)
    return () => clearInterval(iv)
  }, [peer, loadMsgs])

  // Плавная прокрутка вниз при загрузке или новом сообщении (если пользователь уже внизу)
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (!showScrollBtn) {
      scrollToBottom(true)
    }
  }, [msgs.length, showScrollBtn, scrollToBottom])

  const onMessagesScroll = () => {
    const el = scrollBoxRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distFromBottom > 180)
  }

  // Авто-рост поля ввода
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(136, Math.max(44, ta.scrollHeight))}px`
  }, [text])

  const send = async () => {
    if (!peer) return
    const rawBody = text.trim()
    if (!rawBody) { toast(t('msg_err_empty'), 'error'); return }
    setSending(true)
    try {
      if (editingMsg) {
        await client.patch(`/messages/${editingMsg.id}/`, { text: rawBody })
        setEditingMsg(null)
        setText('')
        sfx('ui.success')
        toast('Сообщение обновлено', 'success')
      } else {
        let finalBody = rawBody
        if (replyTo) {
          const parsedR = parseQuote(replyTo.text)
          const snippet = parsedR.body.replace(/\n+/g, ' ').slice(0, 90)
          finalBody = `↩ [${replyTo.sender_name}]: ${snippet}\n\n${rawBody}`
        }
        await client.post('/messages/', { recipient: peer.id, text: finalBody })
        setText('')
        setReplyTo(null)
        setShowEmoji(false)
        setShowTemplates(false)
        sfx('ui.click')
      }
      loadMsgs(peer.id, false)
      loadThreads()
      setTimeout(() => scrollToBottom(true), 80)
    } catch {
      toast('Не удалось отправить сообщение', 'error')
    }
    setSending(false)
  }

  const startEdit = (m: Msg) => {
    setMenuId(null)
    setReplyTo(null)
    setEditingMsg(m)
    setText(m.text)
    inputRef.current?.focus()
  }

  const startReply = (m: Msg) => {
    setMenuId(null)
    setEditingMsg(null)
    setReplyTo(m)
    inputRef.current?.focus()
  }

  const copyMsgText = (m: Msg) => {
    setMenuId(null)
    const { body } = parseQuote(m.text)
    try {
      navigator.clipboard.writeText(body)
      toast('Текст скопирован', 'success')
    } catch {}
  }

  const roleCls = (r: string) => r === 'teacher' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
    : r === 'parent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'

  useEffect(() => {
    if (menuId === null) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuId(null) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [menuId])

  const delMsg = async (id: number, forAll: boolean) => {
    setMenuId(null)
    try {
      await client.delete(`/messages/${id}/`, { params: forAll ? { for_all: 1 } : {} })
      if (peer) loadMsgs(peer.id, false)
      loadThreads()
      toast(t('msg_deleted_ok'), 'success')
    } catch { /* noop */ }
  }

  const unreadTotal = useMemo(() => threads.reduce((acc, th) => acc + (th.unread || 0), 0), [threads])

  const filteredThreads = useMemo(() => {
    const q = searchSide.trim().toLowerCase()
    return threads.filter(th => {
      if (sideTab === 'unread' && th.unread <= 0) return false
      if (!q) return true
      return (
        th.username.toLowerCase().includes(q) ||
        (th.first_name || '').toLowerCase().includes(q) ||
        (th.last_text || '').toLowerCase().includes(q) ||
        (th.via_children || []).some(k => k.toLowerCase().includes(q))
      )
    })
  }, [threads, sideTab, searchSide])

  const filteredContacts = useMemo(() => {
    const q = searchSide.trim().toLowerCase()
    return contacts.filter(c => {
      if (!q) return true
      return (
        c.username.toLowerCase().includes(q) ||
        (c.first_name || '').toLowerCase().includes(q) ||
        (c.via_children || []).some(k => k.toLowerCase().includes(q))
      )
    })
  }, [contacts, searchSide])

  const visibleMsgs = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    if (!q) return msgs
    return msgs.filter(m => !m.is_deleted && m.text.toLowerCase().includes(q))
  }, [msgs, chatSearch])

  const templates = meRole === 'parent' ? PARENT_TEMPLATES : meRole === 'admin' ? ADMIN_TEMPLATES : TEACHER_TEMPLATES

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2.5 dark:text-white">
          <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
            <MessageSquare size={20} />
          </span>
          <span>{t('msg_t')}</span>
          {unreadTotal > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-xs font-extrabold">
              {unreadTotal} новых
            </span>
          )}
        </h1>
        <p className="text-xs text-slate-400">
          Быстрая связь: учитель ↔ родитель ↔ коллеги ↔ администрация
        </p>
      </div>

      <div className="rounded-2xl sm:rounded-3xl border dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-[310px_1fr] h-[calc(100dvh-215px)] min-h-[400px] md:h-[calc(100dvh-155px)] md:min-h-[540px] max-h-[820px]">
        {/* ЛЕВАЯ ПАНЕЛЬ: ДИАЛОГИ И КОНТАКТЫ */}
        <div className={`border-b md:border-b-0 md:border-r dark:border-slate-700/80 flex-col bg-slate-50/70 dark:bg-slate-950/60 overflow-hidden ${peer ? 'hidden md:block' : 'block'}`}>
          <div className="h-full flex flex-col">
            {/* Поиск + кнопка Нового чата */}
            <div className="p-3 space-y-2.5 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchSide}
                    onChange={e => setSearchSide(e.target.value)}
                    placeholder="Поиск чата, имени, ребёнка…"
                    className="w-full pl-9 pr-7 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {searchSide && (
                    <button type="button" onClick={() => setSearchSide('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowPicker(v => !v)}
                  data-testid="msg-new"
                  title={t('msg_new_chat')}
                  className="px-3 py-2 min-h-[36px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm"
                >
                  <Plus size={15} />
                  <span className="hidden sm:inline">Новый</span>
                </button>
              </div>

              {/* Фильтр-вкладки */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => { setSideTab('all'); setShowPicker(false) }}
                  className={`py-1.5 rounded-lg transition ${sideTab === 'all' && !showPicker ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Все ({threads.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setSideTab('unread'); setShowPicker(false) }}
                  className={`py-1.5 rounded-lg transition ${sideTab === 'unread' && !showPicker ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Новые {unreadTotal > 0 ? `(${unreadTotal})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => { setSideTab('contacts'); setShowPicker(false) }}
                  className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${sideTab === 'contacts' && !showPicker ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <Users size={12} /> Контакты
                </button>
              </div>
            </div>

            {/* Список диалогов или контактов */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {(showPicker || sideTab === 'contacts') && (
                <div className="space-y-1" data-testid="msg-picker">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {t('msg_pick_contact')} ({filteredContacts.length})
                  </div>
                  {filteredContacts.map(c => {
                    const disp = c.first_name || c.username
                    return (
                      <button
                        key={c.id}
                        onClick={() => openPeer({ id: c.id, username: c.username, first_name: c.first_name, role: c.role, via_children: c.via_children })}
                        data-testid={`msg-contact-${c.id}`}
                        className="w-full text-left p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition flex items-center gap-3"
                      >
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad(c.id)} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm`}>
                          {disp[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <b className="text-sm dark:text-white truncate">{disp}</b>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-semibold ${roleCls(c.role)}`}>
                              {roleLabel(c.role, t)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            @{c.username}
                            {c.via_children && c.via_children.length > 0 ? ` · ${c.via_children.join(', ')}` : ''}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {filteredContacts.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-8">Контакты не найдены</div>
                  )}
                </div>
              )}

              {!showPicker && sideTab !== 'contacts' && (
                <>
                  {filteredThreads.map(th => {
                    const disp = th.first_name || th.username
                    const active = peer?.id === th.user
                    const isLastMine = meId != null && th.last_sender === meId
                    const previewClean = th.last_text ? parseQuote(th.last_text).body.replace(/\n+/g, ' ') : 'Нет сообщений'
                    return (
                      <button
                        key={th.user}
                        onClick={() => openPeer({ id: th.user, username: th.username, first_name: th.first_name, role: th.role, via_children: th.via_children })}
                        data-testid={`msg-thread-${th.user}`}
                        className={`w-full text-left p-2.5 rounded-2xl transition flex items-center gap-3 ${
                          active
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'hover:bg-white dark:hover:bg-slate-800/90 dark:text-white'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGrad(th.user)} text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm ring-2 ${active ? 'ring-white/40' : 'ring-transparent'}`}>
                          {disp[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <b className={`text-sm truncate ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{disp}</b>
                            <span className={`text-[10px] shrink-0 ${active ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {formatThreadTime(th.last_at)}
                            </span>
                          </div>
                          {th.via_children && th.via_children.length > 0 && (
                            <div className={`text-[10px] truncate ${active ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>
                              {th.via_children.join(', ')}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1.5 mt-0.5">
                            <div className={`text-xs truncate flex items-center gap-1 ${active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                              {isLastMine && (
                                <span className="shrink-0">
                                  {th.last_status === 'read'
                                    ? <CheckCheck size={13} className={active ? 'text-sky-200' : 'text-sky-500'} />
                                    : th.last_status === 'delivered'
                                      ? <CheckCheck size={13} className="opacity-65" />
                                      : <Check size={13} className="opacity-65" />}
                                </span>
                              )}
                              <span className="truncate">{isLastMine ? `Вы: ${previewClean}` : previewClean}</span>
                            </div>
                            {th.unread > 0 && (
                              <span
                                className={`text-[10px] min-w-[20px] h-5 px-1.5 rounded-full font-extrabold flex items-center justify-center shrink-0 ${
                                  active ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                                }`}
                                data-testid={`msg-unread-${th.user}`}
                              >
                                {th.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {filteredThreads.length === 0 && (
                    <div className="text-center py-10 px-4 space-y-2">
                      <div className="text-3xl">💬</div>
                      <div className="text-xs text-slate-400">
                        {sideTab === 'unread' ? 'Все сообщения прочитаны!' : t('msg_no_dialogs')}
                      </div>
                      {sideTab === 'all' && (
                        <button
                          type="button"
                          onClick={() => setSideTab('contacts')}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-xs font-bold"
                        >
                          Открыть контакты
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ: АКТИВНЫЙ ЧАТ */}
        <div className={`flex-col h-full overflow-hidden relative bg-[#f4f6fb] dark:bg-slate-950 ${peer ? 'flex' : 'hidden md:flex'}`}>
          {!peer ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-8 text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-4xl shadow-inner">
                💬
              </div>
              <div className="font-display font-bold text-lg text-slate-700 dark:text-slate-200">
                Выберите диалог слева
              </div>
              <p className="text-xs max-w-xs">
                Или нажмите <b>«+ Новый»</b>, чтобы написать родителю, учителю или администратору школы.
              </p>
            </div>
          ) : (
            <>
              {/* Шапка чата */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 shadow-sm">
                <button
                  type="button"
                  className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-0.5 text-xs font-semibold min-h-[36px]"
                  onClick={() => setPeer(null)}
                  aria-label="Назад к диалогам"
                >
                  <ChevronLeft size={19} />
                  <span>{t('back') || 'Назад'}</span>
                </button>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad(peer.id)} text-white font-bold flex items-center justify-center shrink-0 shadow-sm`}>
                  {(peer.first_name || peer.username)[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <b className="dark:text-white truncate text-sm sm:text-base">{peer.first_name || peer.username}</b>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${roleCls(peer.role)}`}>
                      {roleLabel(peer.role, t)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    @{peer.username}
                    {peer.via_children && peer.via_children.length > 0 ? ` · ${peer.via_children.join(', ')}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setChatSearchOpen(v => !v); setChatSearch('') }}
                  className={`p-2 rounded-xl transition ${chatSearchOpen ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title="Поиск в переписке"
                >
                  <Search size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => { loadMsgs(peer.id, false); loadThreads(); sfx('ui.click') }}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Обновить чат"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              {/* Строка поиска внутри чата */}
              {chatSearchOpen && (
                <div className="px-4 py-2 bg-indigo-50/80 dark:bg-slate-900 border-b dark:border-slate-800 flex items-center gap-2">
                  <Search size={14} className="text-indigo-500" />
                  <input
                    autoFocus
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                    placeholder="Найти сообщение в этом диалоге…"
                    className="flex-1 bg-transparent text-xs dark:text-white outline-none"
                  />
                  <span className="text-[11px] text-slate-400 font-semibold">{visibleMsgs.length} сообщ.</span>
                  <button type="button" onClick={() => { setChatSearchOpen(false); setChatSearch('') }} className="text-slate-400 hover:text-slate-600">
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Лента сообщений */}
              <div
                ref={scrollBoxRef}
                onScroll={onMessagesScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2"
              >
                {visibleMsgs.map((m, idx) => {
                  const isMine = meId != null ? m.sender === meId : m.sender_name !== peer.username
                  const st = m.is_deleted ? null : msgStatus(m)
                  const dayLabel = formatDayLabel(m.created_at)
                  const prevDayLabel = idx > 0 ? formatDayLabel(visibleMsgs[idx - 1].created_at) : null
                  const showDay = dayLabel !== prevDayLabel
                  const parsed = m.is_deleted ? { body: '' } : parseQuote(m.text)

                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="flex justify-center my-3">
                          <span className="px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold shadow-xs">
                            {dayLabel}
                          </span>
                        </div>
                      )}

                      <div className={`relative flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} group`} data-testid={`msg-${m.id}`}>
                        {/* Панель быстрых действий слева для своих сообщений */}
                        {isMine && !m.is_deleted && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
                            <button type="button" onClick={() => startReply(m)} title="Ответить" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800">
                              <Reply size={13} />
                            </button>
                            <button type="button" onClick={() => startEdit(m)} title="Редактировать" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-800">
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => copyMsgText(m)} title="Копировать" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800">
                              <Copy size={13} />
                            </button>
                            <button onClick={() => setMenuId(v => v === m.id ? null : m.id)} data-testid={`msg-del-${m.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800"
                              aria-label={t('msg_del_me')}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}

                        <div
                          className={`max-w-[82%] sm:max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm shadow-xs ${
                            isMine
                              ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-br-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 rounded-bl-sm'
                          }`}
                          data-testid={`msg-bubble-${m.id}`}
                        >
                          {m.is_deleted ? (
                            <div className={`italic text-xs ${isMine ? 'text-indigo-200/90' : 'text-slate-400'}`} data-testid={`msg-deleted-${m.id}`}>
                              🚫 {t('msg_deleted')}
                            </div>
                          ) : (
                            <>
                              {parsed.quoteText && (
                                <div className={`mb-1.5 pl-2.5 py-1 pr-2 rounded-lg border-l-2 text-xs ${
                                  isMine
                                    ? 'bg-white/15 border-amber-300 text-indigo-100'
                                    : 'bg-indigo-50 dark:bg-slate-900/70 border-indigo-500 text-slate-600 dark:text-slate-300'
                                }`}>
                                  <div className="font-bold text-[10px] opacity-85">{parsed.quoteAuthor}</div>
                                  <div className="truncate">{parsed.quoteText}</div>
                                </div>
                              )}
                              <div className="whitespace-pre-wrap break-words leading-relaxed">
                                {renderTextWithLinks(parsed.body, isMine)}
                              </div>
                            </>
                          )}
                          <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMine ? 'text-indigo-200/90' : 'text-slate-400'}`}>
                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && st === 'sent' && <Check size={12} className="text-indigo-200" data-testid={`msg-sent-${m.id}`} />}
                            {isMine && st === 'delivered' && <CheckCheck size={12} className="text-indigo-200" data-testid={`msg-delivered-${m.id}`} />}
                            {isMine && st === 'read' && <CheckCheck size={12} className="text-sky-300" data-testid={`msg-read-${m.id}`} />}
                          </div>
                        </div>

                        {/* Панель быстрых действий справа для входящих сообщений */}
                        {!isMine && !m.is_deleted && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
                            <button type="button" onClick={() => startReply(m)} title="Ответить" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800">
                              <Reply size={13} />
                            </button>
                            <button type="button" onClick={() => copyMsgText(m)} title="Копировать" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800">
                              <Copy size={13} />
                            </button>
                            <button onClick={() => setMenuId(v => v === m.id ? null : m.id)} data-testid={`msg-del-${m.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800"
                              aria-label={t('msg_del_me')}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}

                        {menuId === m.id && (
                          <div ref={menuRef} data-testid={`msg-del-menu-${m.id}`}
                            className={`absolute z-30 bottom-8 ${isMine ? 'right-12' : 'left-12'} rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs font-semibold min-w-[160px]`}>
                            {isMine && (
                              <button onClick={() => delMsg(m.id, true)} data-testid="msg-del-all-btn"
                                className="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800">
                                🗑️ {t('msg_del_all')}
                              </button>
                            )}
                            <button onClick={() => delMsg(m.id, false)} data-testid="msg-del-me-btn"
                              className="w-full text-left px-3.5 py-2 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">
                              👁️ {t('msg_del_me')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {visibleMsgs.length === 0 && (
                  <div className="text-center py-14 space-y-2">
                    <div className="text-4xl">👋</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-semibold">
                      {chatSearch ? 'Совпадений в переписке не найдено' : t('msg_empty_chat')}
                    </div>
                    {!chatSearch && (
                      <div className="flex flex-wrap justify-center gap-1.5 pt-2 max-w-md mx-auto">
                        {templates.slice(0, 2).map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setText(tpl); inputRef.current?.focus() }}
                            className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition"
                          >
                            ⚡ {tpl.slice(0, 48)}…
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Плавающая кнопка «Вниз» */}
              {showScrollBtn && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="absolute right-5 bottom-24 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:scale-105 transition"
                  title="К последнему сообщению"
                >
                  <ArrowDown size={18} />
                </button>
              )}

              {/* Всплывающие панели: Шаблоны или Эмодзи */}
              {showTemplates && (
                <div className="px-3 py-2.5 bg-white dark:bg-slate-900 border-t dark:border-slate-800 space-y-1.5 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1"><Zap size={12} className="text-amber-500" /> Быстрые школьные шаблоны:</span>
                    <button type="button" onClick={() => setShowTemplates(false)}><X size={14} /></button>
                  </div>
                  <div className="grid gap-1">
                    {templates.map((tpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setText(tpl); setShowTemplates(false); inputRef.current?.focus() }}
                        className="text-left px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-xs dark:text-slate-200 transition"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showEmoji && (
                <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex flex-wrap gap-1.5 items-center">
                  {QUICK_EMOJIS.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => { setText(prev => prev + em); inputRef.current?.focus() }}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-lg flex items-center justify-center transition"
                    >
                      {em}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowEmoji(false)} className="ml-auto p-1 text-slate-400">
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Полоска цитаты (Ответ) или Редактирования */}
              {(replyTo || editingMsg) && (
                <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 border-t border-indigo-200 dark:border-indigo-800 flex items-center gap-2.5 text-xs">
                  {editingMsg ? <Pencil size={15} className="text-amber-600 shrink-0" /> : <Reply size={15} className="text-indigo-600 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-indigo-700 dark:text-indigo-300">
                      {editingMsg ? 'Редактирование сообщения' : `Ответ для ${replyTo?.sender_name}`}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 truncate">
                      {editingMsg ? editingMsg.text : parseQuote(replyTo?.text || '').body}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setReplyTo(null); if (editingMsg) { setEditingMsg(null); setText('') } }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Панель ввода сообщения */}
              <div className="flex items-end gap-1.5 sm:gap-2 p-2.5 sm:p-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => { setShowTemplates(v => !v); setShowEmoji(false) }}
                  title="Быстрые шаблоны"
                  className={`p-2.5 min-h-[44px] rounded-xl border transition shrink-0 ${
                    showTemplates
                      ? 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 dark:text-slate-400'
                  }`}
                >
                  <Zap size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEmoji(v => !v); setShowTemplates(false) }}
                  title="Эмодзи"
                  className={`p-2.5 min-h-[44px] rounded-xl border transition shrink-0 ${
                    showEmoji
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:text-slate-400'
                  }`}
                >
                  <Smile size={17} />
                </button>

                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    onChange={e => setText(e.target.value.slice(0, 3000))}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                    placeholder={t('msg_type_hint')}
                    data-testid="msg-input"
                    className="w-full px-3.5 py-2.5 min-h-[44px] max-h-36 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 resize-none text-sm leading-snug"
                  />
                  {text.length > 2200 && (
                    <span className="absolute right-2.5 bottom-1.5 text-[10px] text-amber-600 font-mono font-bold">
                      {text.length}/3000
                    </span>
                  )}
                </div>

                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  data-testid="msg-send"
                  className="px-4 py-2.5 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 shadow-sm shrink-0 transition"
                >
                  <Send size={16} />
                  <span className="hidden sm:inline">{editingMsg ? 'Сохранить' : t('msg_send')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
