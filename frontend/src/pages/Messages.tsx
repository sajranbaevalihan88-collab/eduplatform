import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { MessageSquare, Send, Plus, ChevronLeft, Check, CheckCheck, Trash2 } from 'lucide-react'

type Thread = { user: number; username: string; role: string; last_text: string | null; last_at: string | null; unread: number }
type Contact = { id: number; username: string; role: string; first_name?: string; via_children?: string[] }
type Msg = { id: number; sender: number; sender_name: string; text: string; created_at: string; delivered_at: string | null; read_at: string | null; is_deleted: boolean }

// статус доставки:.sent → delivered → read (вычисляем по временным меткам бэка)
const msgStatus = (m: Msg): 'sent' | 'delivered' | 'read' =>
  m.read_at ? 'read' : m.delivered_at ? 'delivered' : 'sent'

const roleLabel = (role: string, t: (k: string) => string) =>
  role === 'teacher' ? t('msg_role_teacher') : role === 'parent' ? t('msg_role_parent') : t('msg_role_admin')

export default function Messages() {
  const { t } = useLang()
  const [threads, setThreads] = useState<Thread[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [peer, setPeer] = useState<{ id: number; username: string; role: string } | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [menuId, setMenuId] = useState<number | null>(null) // открытое меню удаления (одно одновременно)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const meId = (JSON.parse(localStorage.getItem('user') || '{}') as any).id as number | undefined

  const loadThreads = useCallback(() => {
    client.get('/messages/threads/').then(r => {
      setThreads(r.data.threads || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadThreads()
    client.get('/messages/contacts/').then(r => {
      setContacts(r.data || [])
    }).catch(() => setContacts([]))
  }, [loadThreads])

  const openPeer = useCallback((p: { id: number; username: string; role: string }) => {
    setPeer(p)
    setShowPicker(false)
  }, [])

  const loadMsgs = useCallback((pid: number) => {
    client.get('/messages/', { params: { with_user: pid } }).then(r => {
      setMsgs(r.data || [])
    }).catch(() => setMsgs([]))
  }, [])

  useEffect(() => {
    if (!peer) { setMsgs([]); return }
    loadMsgs(peer.id)
    // лёгкий поллинг: переписка учитель↔родитель обновляется, пока открыта
    const iv = setInterval(() => loadMsgs(peer.id), 6000)
    return () => clearInterval(iv)
  }, [peer, loadMsgs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const send = async () => {
    if (!peer) return
    const body = text.trim()
    if (!body) { toast(t('msg_err_empty'), 'error'); return }
    setSending(true)
    try {
      await client.post('/messages/', { recipient: peer.id, text: body })
      setText('')
      loadMsgs(peer.id)
      loadThreads()
    } catch { toast('Не отправилось', 'error') }
    setSending(false)
  }

  const roleCls = (r: string) => r === 'teacher' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
    : r === 'parent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'

  // закрытие меню удаления: клик вне / Esc
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
      if (peer) loadMsgs(peer.id)
      loadThreads()
      toast(t('msg_deleted_ok'), 'success')
    } catch { /* noop */ }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white mb-4">
        <MessageSquare className="text-indigo-600" />{t('msg_t')}
      </h1>

      <div className="rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[460px]">
        {/* Диалоги: на мобильном скрываем список, когда выбран активный чат */}
        <div className={`border-b md:border-b-0 md:border-r dark:border-slate-700 p-3 space-y-2 overflow-auto ${peer ? 'hidden md:block' : 'block'}`}>
          <button onClick={() => setShowPicker(v => !v)}
            data-testid="msg-new"
            className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold">
            <Plus size={16} />{t('msg_new_chat')}
          </button>

          {showPicker && (
            <div className="space-y-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700" data-testid="msg-picker">
              <div className="text-xs font-semibold text-slate-500 mb-1">{t('msg_pick_contact')}:</div>
              {contacts.map(c => (
                <button key={c.id} onClick={() => openPeer({ id: c.id, username: c.username, role: c.role })}
                  data-testid={`msg-contact-${c.id}`}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-sm dark:text-slate-100">
                  <b>{c.first_name || c.username}</b>
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${roleCls(c.role)}`}>{roleLabel(c.role, t)}</span>
                  {c.via_children && c.via_children.length > 0 && (
                    <div className="text-[10px] text-slate-400">{t('msg_parent_of')} {c.via_children.join(', ')}</div>
                  )}
                </button>
              ))}
              {contacts.length === 0 && <div className="text-xs text-slate-400 py-2">—</div>}
            </div>
          )}

          {threads.map(th => (
            <button key={th.user} onClick={() => openPeer({ id: th.user, username: th.username, role: th.role })}
              data-testid={`msg-thread-${th.user}`}
              className={`w-full text-left px-3 py-2.5 rounded-xl border dark:border-slate-700 ${peer?.id === th.user ? 'bg-indigo-50 dark:bg-blue-900/20 border-indigo-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <div className="flex items-center gap-2">
                <b className="text-sm dark:text-white truncate flex-1">{th.username}</b>
                {th.unread > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold" data-testid={`msg-unread-${th.user}`}>{th.unread}</span>}
              </div>
              <div className="text-xs text-slate-400 truncate">{roleLabel(th.role, t)} · {th.last_text || '…'}</div>
            </button>
          ))}
          {threads.length === 0 && !showPicker && (
            <div className="text-xs text-slate-400 px-2 py-3">{t('msg_no_dialogs')}</div>
          )}
        </div>

        {/* Переписка: на мобильном показываем только когда выбран peer */}
        <div className={`flex-col min-h-[420px] ${peer ? 'flex' : 'hidden md:flex'}`}>
          {!peer ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm px-8 text-center">
              Выберите диалог слева или создайте новый
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b dark:border-slate-700">
                <button
                  type="button"
                  className="md:hidden p-1.5 -ml-1 mr-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-xs font-semibold min-h-[36px]"
                  onClick={() => setPeer(null)}
                  aria-label="Назад к диалогам"
                >
                  <ChevronLeft size={18} />
                  <span>{t('back') || 'Назад'}</span>
                </button>
                <b className="dark:text-white truncate">{peer.username}</b>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${roleCls(peer.role)}`}>{roleLabel(peer.role, t)}</span>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-2.5">
                {msgs.map(m => {
                  const isMine = meId != null ? m.sender === meId : m.sender_name !== peer.username
                  const st = m.is_deleted ? null : msgStatus(m)
                  return (
                    <div key={m.id} className={`relative flex ${isMine ? 'justify-end' : 'justify-start'} group`} data-testid={`msg-${m.id}`}>
                      <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${isMine
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md'} ${m.is_deleted && !isMine ? 'italic' : ''}`}
                        data-testid={`msg-bubble-${m.id}`}>
                        {m.is_deleted ? (
                          <div className={`italic ${isMine ? 'text-indigo-200/90' : 'text-slate-400'}`} data-testid={`msg-deleted-${m.id}`}>{t('msg_deleted')}</div>
                        ) : (
                          <div className="whitespace-pre-wrap break-word">{m.text}</div>
                        )}
                        <div className={`flex items-center gap-1 text-[10px] mt-0.5 ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                          <span>{new Date(m.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          {isMine && st === 'sent' && <Check size={12} className="text-slate-400" data-testid={`msg-sent-${m.id}`}/>}
                          {isMine && st === 'delivered' && <CheckCheck size={12} className="text-slate-300" data-testid={`msg-delivered-${m.id}`}/>}
                          {isMine && st === 'read' && <CheckCheck size={12} className="text-sky-500" data-testid={`msg-read-${m.id}`}/>}
                        </div>
                      </div>
                      {!m.is_deleted && (
                        <button onClick={() => setMenuId(v => v === m.id ? null : m.id)} data-testid={`msg-del-${m.id}`}
                          className="self-center p-1 mr-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity print:hidden"
                          aria-label={t('msg_del_me')}>
                          <Trash2 size={14}/>
                        </button>
                      )}
                      {menuId === m.id && (
                        <div ref={menuRef} data-testid={`msg-del-menu-${m.id}`}
                          className={`absolute z-20 top-4 ${isMine ? 'right-10' : 'left-10'} rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 text-sm`}>
                          {isMine && (
                            <button onClick={() => delMsg(m.id, true)} data-testid="msg-del-all-btn"
                              className="w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800">{t('msg_del_all')}</button>
                          )}
                          <button onClick={() => delMsg(m.id, false)} data-testid="msg-del-me-btn"
                            className="w-full text-left px-3 py-1.5 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">{t('msg_del_me')}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {msgs.length === 0 && <div className="text-center text-sm text-slate-400 py-8">{t('msg_empty_chat')}</div>}
                <div ref={bottomRef}/>
              </div>

              <div className="flex items-end gap-2 p-3 border-t dark:border-slate-700">
                <textarea rows={1} value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder={t('msg_type_hint')}
                  data-testid="msg-input"
                  className="flex-1 px-3.5 py-2.5 min-h-[44px] max-h-28 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none resize-none text-sm"/>
                <button onClick={send} disabled={sending}
                  data-testid="msg-send"
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
                  <Send size={15}/>{t('msg_send')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Родитель ↔ учитель классов ребёнка ↔ админ. Ученикам этот раздел не показан.
      </p>
    </div>
  )
}
