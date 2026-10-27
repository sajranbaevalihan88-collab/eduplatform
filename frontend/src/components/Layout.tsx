import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, LayoutDashboard, Layers, PenTool, Presentation, FlaskConical, LogOut, Menu, X, User, ChevronLeft, PanelLeftClose, PanelLeft, Sun, Moon, Languages, Sparkles, Code2, FileText, Gamepad2, Accessibility, GraduationCap, Info, Database } from 'lucide-react'
import A11yPanel from './A11yPanel'
import InstallPWA from './InstallPWA'
import { useState, useEffect, useRef } from 'react'
import client from '../api/client'
import { useTheme, useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [me,setMe]=useState<any>(null)
  const [hideSidebar,setHideSidebar]=useState(false)
  const [showLang,setShowLang]=useState(false)
  const [showA11y,setShowA11y]=useState(false)
  const drawerRef=useRef<HTMLDivElement>(null)
  const menuOpenerRef=useRef<HTMLElement | null>(null)
  const isGameFull = /^\/games\/.+/.test(loc.pathname)
  const {theme,toggle:toggleTheme}=useTheme()
  const {lang,t,setLang}=useLang()
  const {poor}=useAccessibility()
  const isActive = (p: string) => loc.pathname === p || loc.pathname.startsWith(p + '/')
  const student = me?.role === 'student'
  const items = [
    { to: '/', label: t('home'), icon: Sparkles },
    { to: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { to: '/subjects', label: t('subjects'), icon: BookOpen },
    { to: '/lessons', label: t('lessons'), icon: Layers },
    { to: '/presentations', label: t('presentations'), icon: Presentation },
    { to: '/tests', label: t('tests'), icon: FlaskConical },
    { to: '/classes', label: t('classes'), icon: GraduationCap },
    // доска — только учителям (у ученика её нет)
    ...(!student ? [{ to: '/board', label: t('board'), icon: PenTool }] : []),
    { to: '/word', label: 'Word', icon: FileText },
    { to: '/games', label: t('games'), icon: Gamepad2 },
    { to: '/editor', label: t('editor'), icon: Code2 },
    { to: '/sql', label: t('sql_lab'), icon: Database },
    { to: '/about', label: t('ab_menu'), icon: Info },
  ]
  // Нижняя навигация телефона: 5 самых нужных разделов крупным тапом
  const bottomItems = [
    { to: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { to: '/lessons', label: t('lessons'), icon: Layers },
    { to: '/tests', label: t('tests'), icon: FlaskConical },
    { to: '/classes', label: t('classes'), icon: GraduationCap },
    { to: '/games', label: t('games'), icon: Gamepad2 },
  ]
  useEffect(()=>{
    const token=localStorage.getItem('token')
    if(token){
      client.get('/auth/me/').then(r=>setMe(r.data)).catch(()=>{
        const raw=localStorage.getItem('user')
        if(raw) try{ setMe(JSON.parse(raw)) }catch{}
      })
    } else {
      setMe(null)
    }
    const onStorage=()=> {
      const t=localStorage.getItem('token')
      if(!t) setMe(null)
      else {
        const raw=localStorage.getItem('user')
        if(raw) try{ setMe(JSON.parse(raw)) }catch{}
      }
    }
    const onToggleSidebar=(e:any)=>{
      if(e.detail?.hide!==undefined) setHideSidebar(e.detail.hide)
      else setHideSidebar(v=>!v)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('auth-change', onStorage as any)
    window.addEventListener('toggle-sidebar', onToggleSidebar as any)
    // авто-скрывать на доске если ранее скрыли
    if(loc.pathname.startsWith('/board') && localStorage.getItem('board-hide-sidebar')==='1'){
      setHideSidebar(true)
    }
    return ()=> { window.removeEventListener('storage', onStorage); window.removeEventListener('auth-change', onStorage as any); window.removeEventListener('toggle-sidebar', onToggleSidebar as any) }
  },[loc.pathname])
  // Слепой режим: при смене страницы — фокус в контент + нативное объявление
  // заголовка скринридеру (без нашего голоса — так правильно для NVDA/JAWS).
  const [announce, setAnnounce] = useState('')
  useEffect(()=>{
    // Новый раздел всегда открывается с начала, а не с позиции прокрутки прошлой страницы.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    try{
      // SPA-практика: фокус на первый заголовок страницы, чтобы NVDA/JAWS/VoiceOver
      // прочитали, куда попал пользователь. Если заголовка нет — фокус на main.
      const h = document.querySelector<HTMLElement>('#main-content h1')
      const target = h ?? document.getElementById('main-content')
      if(h) h.setAttribute('tabindex','-1')
      target?.focus({preventScroll:true} as any)
    }catch{}
    const timer = setTimeout(()=>{
      try{
        const h = document.querySelector('#main-content h1')
        const title = (h?.textContent || document.title || loc.pathname).replace(/\s+/g,' ').trim().slice(0,120)
        document.title = title ? `${title} — ${t('platform_title')}` : t('platform_title')
        setAnnounce(title ? `${t('page_opened_prefix')}${title}` : t('page_opened'))
      }catch{}
    }, 120)
    return ()=>clearTimeout(timer)
  },[loc.pathname])
  const logout = async () => {
    const refresh = localStorage.getItem('refresh')
    if (refresh) {
      try { await client.post('/auth/logout/', {refresh}) } catch {}
    }
    // Выход не должен удалять локальные документы Word, черновики и настройки доступности.
    ;['access', 'refresh', 'token', 'user'].forEach(key => localStorage.removeItem(key))
    setMe(null); window.dispatchEvent(new Event('auth-change')); nav('/login')
  }
  const toggleSidebar = () => {
    const newVal = !hideSidebar
    setHideSidebar(newVal)
    localStorage.setItem('board-hide-sidebar', newVal ? '1' : '0')
  }

  // Мобильное меню — модальный диалог для TalkBack/VoiceOver: Esc, Tab-цикл и возврат фокуса.
  useEffect(()=>{
    if(!open) return
    menuOpenerRef.current=document.activeElement as HTMLElement | null
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    const id=setTimeout(()=>document.getElementById('mobile-navigation')?.focus(),70)
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){ e.preventDefault(); setOpen(false); return }
      if(e.key!=='Tab'||!drawerRef.current) return
      const focusables=Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if(!focusables.length) return
      const first=focusables[0], last=focusables[focusables.length-1]
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus() }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return ()=>{
      window.removeEventListener('keydown', onKey)
      clearTimeout(id)
      document.body.style.overflow=previousOverflow
    }
  },[open])
  useEffect(()=>{
    if(open) return
    menuOpenerRef.current?.focus?.()
    menuOpenerRef.current=null
  },[open])

  // Режим слабовидящих и быстрая клавиатурная навигация:
  // Alt+A — панель доступности, Alt+1..9 — прямое переключение разделов.
  useEffect(()=>{
    const targets = items.map(i=>i.to)
    const onKey=(e:KeyboardEvent)=>{
      if(!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const k=e.key.toLowerCase()
      if(k==='a'){ e.preventDefault(); setShowA11y(v=>!v) }
      const n=Number(e.key)
      if(Number.isInteger(n) && n>=1 && n<=Math.min(9, targets.length)){
        e.preventDefault(); setShowA11y(false); nav(targets[n-1])
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=>window.removeEventListener('keydown', onKey)
  },[items, nav])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex overflow-x-clip">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-blue-700 focus:text-white">{t('skip_content')}</a>
      <a
        href="#main-navigation"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:mt-10 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-blue-700 focus:text-white"
        onClick={e => {
          if (window.innerWidth >= 1024) return
          e.preventDefault()
          setOpen(true)
          setTimeout(() => document.getElementById('mobile-navigation')?.focus(), 80)
        }}
      >{t('skip_navigation')}</a>
      <div aria-live="assertive" aria-atomic="true" role="status" className="sr-only">{announce}</div>
      {/* Sidebar desktop */}
      {(!isGameFull && !hideSidebar) ? (
      <aside aria-label={t('main_navigation')} className="hidden lg:flex w-[280px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-700/60 flex-col sticky top-0 h-screen shadow-sm animate-slideIn">
        <div className="h-[64px] flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-700">
          <img src="/logo.svg" alt="EduPlatform AI" className="w-10 h-10 shrink-0 drop-shadow-md" />
          <div className="flex-1 min-w-0"><div className="font-display font-bold leading-tight dark:text-white text-[15px]">EduPlatform <span className="brand-ai">AI</span></div><div className="text-xs text-slate-500 dark:text-slate-400">{t('tagline')}</div></div>
          <button onClick={toggleSidebar} aria-label={t('hide_tabs')} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 btn-hover" title={t('hide_tabs')}><PanelLeftClose size={18}/></button>
        </div>
        <nav id="main-navigation" aria-label={t('main_navigation')} className="flex-1 p-3 space-y-1.5 overflow-auto scrollbar-thin stagger">
          {items.map(it => (
            <Link key={it.to} to={it.to} aria-current={isActive(it.to) ? 'page' : undefined} aria-label={it.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isActive(it.to) ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30 scale-[1.02]' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:scale-[1.01] border border-transparent hover:border-slate-100 dark:hover:border-slate-700'}`}>
              <span className={`p-1.5 rounded-lg ${isActive(it.to) ? 'bg-white/15' : 'bg-slate-50 dark:bg-slate-800'}`}><it.icon size={16} /></span> {it.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-t from-slate-50/50 dark:from-slate-800/50 to-transparent space-y-2">
          {me ? (
            <Link to="/profile" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium card-hover ${isActive('/profile') ? 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm' : 'bg-white dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 dark:text-white'}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-md">{(me.username||'U')[0].toUpperCase()}</div>
              <div className="flex-1 min-w-0"><div className="font-semibold line-clamp-1">{me.username}</div><div className="text-xs text-slate-500 dark:text-slate-400 truncate">{me.email||`ID ${me.id}`}</div></div>
            </Link>
          ) : (
            <div className="text-xs text-slate-400 text-center py-2 animate-pulseSoft">{t('login_to_create')}</div>
          )}
          {me ? (
            <button onClick={logout} className="w-full flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 btn-hover"><LogOut size={16}/> {t('logout')}</button>
          ) : (
            <Link to="/login" className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold shadow-md btn-hover"><User size={16}/> {t('login')}</Link>
          )}
        </div>
      </aside>
      ) : (!isGameFull ? (
        <button onClick={toggleSidebar} className="hidden lg:flex fixed left-4 top-4 z-30 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 animate-scaleIn" title={t('show_tabs')}><PanelLeft size={18}/></button>
      ) : null)}

      {/* Mobile drawer */}
      {open && (
        <div id="mobile-drawer" ref={drawerRef} className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={t('main_navigation')}>
          <div className="absolute inset-0 bg-black/60 motion-safe:animate-fadeIn" onClick={()=>setOpen(false)} />
          <div className="absolute left-0 top-0 w-[85%] max-w-[320px] h-[100dvh] bg-white dark:bg-slate-900 flex flex-col motion-safe:animate-drawer shadow-2xl overscroll-contain">
            <div className="h-[64px] flex items-center justify-between px-6 border-b dark:border-slate-700 shrink-0">
              <span className="font-bold dark:text-white flex items-center gap-2"><img src="/logo.svg" alt="EduPlatform AI" className="w-8 h-8" />EduPlatform <span className="brand-ai">AI</span></span>
              <button onClick={()=>setOpen(false)} className="dark:text-white p-2" aria-label={t('close_menu')}><X size={20}/></button>
            </div>
            <nav id="mobile-navigation" tabIndex={-1} aria-label={t('main_navigation')} className="flex-1 p-3 space-y-1 overflow-auto outline-none">
              {items.map(it=>(
                <Link key={it.to} to={it.to} onClick={()=>setOpen(false)} aria-current={isActive(it.to) ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-3 rounded-xl min-h-[48px] ${isActive(it.to)?'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30':'text-slate-600 dark:text-slate-300'}`}><it.icon size={18}/>{it.label}</Link>
              ))}
            </nav>
            <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom))] border-t dark:border-slate-700 shrink-0">
              {me ? (<>
                <Link to="/profile" onClick={()=>setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-amber-400 flex items-center justify-center text-white font-bold text-xs">{(me.username||'U')[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm line-clamp-1">{me.username}</div></div>
                </Link>
                <button onClick={()=>{ setOpen(false); logout() }} className="mt-2 w-full flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 px-3 py-2"><LogOut size={16}/> {t('logout')}</button>
              </>) : (
                <Link to="/login" onClick={()=>setOpen(false)} className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold"><User size={16}/> {t('login')}</Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 min-w-0 ${loc.pathname.startsWith('/board') ? 'flex flex-col h-screen' : ''}`}>
        {!loc.pathname.startsWith('/board') && !isGameFull && (
        <header className="h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 px-4 lg:px-8 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden shrink-0 p-2 rounded-xl bg-slate-100 hover:bg-white hover:shadow-md transition-all" onClick={()=>setOpen(true)} aria-label={t('open_menu')} aria-expanded={open} aria-controls="mobile-drawer"><Menu size={18}/></button>
            <p className="font-display font-bold text-lg hidden md:block gradient-text truncate" aria-label={t('platform_title')}>{t('platform_title')}</p>
            {hideSidebar && <button onClick={toggleSidebar} className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-white border border-slate-200 text-xs font-medium btn-hover" aria-label={t('show_tabs')}><PanelLeft size={14}/> {t('menu')}</button>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={toggleTheme} aria-label={theme==='dark' ? t('theme_light') : t('theme_dark')} className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:border-slate-600 hover:shadow-md transition-all flex items-center justify-center" title={theme==='dark'?t('light'):t('dark')}>{theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button>
            <div className="relative">
              <button onClick={()=>setShowLang(v=>!v)} aria-label={t('change_lang')} aria-expanded={showLang} className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:border-slate-600 flex items-center justify-center gap-1 text-xs font-bold">{lang.toUpperCase()} <Languages size={12}/></button>
              {showLang && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-1 z-50 min-w-[160px]">
                  {(['ru','en','kg'] as const).map(l=>(
                    <button key={l} onClick={()=>{setLang(l); setShowLang(false); setTimeout(()=>window.location.reload(), 150)}} className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg text-sm flex items-center justify-between ${lang===l?'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold':'hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white'}`}>{l==='ru'?'🇷🇺 Русский':l==='en'?'🇬🇧 English':'🇰🇬 Кыргызча'} {lang===l && '✓'}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={()=>setShowA11y(true)} aria-label={t('a11y_settings')} aria-expanded={showA11y} className={`p-2.5 min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center gap-1 text-xs font-bold ${poor?'bg-amber-400 border-amber-500 text-slate-900':'bg-slate-100 dark:bg-slate-800 dark:text-white hover:bg-white dark:hover:bg-slate-700 border-transparent hover:border-slate-200 dark:border-slate-600'}`} title={t('a11y_settings')}><Accessibility size={16}/><span className="hidden lg:inline">{t('a11y')}{poor?' •':' '}</span></button>
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"/>
            {!student && (
            <Link to="/lessons/new" className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold shadow-md hover:shadow-lg btn-hover hidden sm:flex items-center gap-1.5">✨ {t('create_lesson')}</Link>
            )}
            {me ? (
              <Link to="/profile" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-700 dark:bg-white dark:text-slate-900 text-white text-sm font-semibold shadow-md btn-hover">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-amber-400 flex items-center justify-center text-xs font-bold">{(me.username||'U')[0].toUpperCase()}</div>
                {me.username}
              </Link>
            ) : (
              <Link to="/login" className="hidden sm:inline px-4 py-2 rounded-xl bg-slate-100 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 text-sm font-medium transition-all">{t('login')}</Link>
            )}
          </div>
        </header>
        )}
        <main id="main-content" tabIndex={-1} key={loc.pathname} className={loc.pathname.startsWith('/board') ? 'flex-1 min-h-0 w-full page-enter' : isGameFull ? 'w-full min-h-screen pb-24 lg:pb-0 page-enter relative' : 'p-4 pb-28 lg:p-8 max-w-[1400px] mx-auto page-enter'}>{children}</main>
        {!loc.pathname.startsWith('/board') && !isGameFull && (
          <nav id="bottom-navigation" aria-label={t('mobile_navigation')} className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-around bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-700/60 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
            {bottomItems.map(it => (
              <Link key={it.to} to={it.to} aria-current={isActive(it.to) ? 'page' : undefined}
                className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${isActive(it.to) ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800'}`}>
                <it.icon size={22} />
                {it.label}
              </Link>
            ))}
          </nav>
        )}
        {isGameFull && (
          <button onClick={() => nav('/games')} aria-label={t('games')}
            className="fixed left-3 bottom-3 z-30 p-3 rounded-full bg-slate-900/80 dark:bg-white/90 text-white dark:text-slate-900 shadow-xl hover:scale-110 active:scale-95 transition-transform backdrop-blur-sm">
            <ChevronLeft size={20} />
          </button>
        )}
      </div>
      {/* Панель доступности — вне шапки: родитель с backdrop-blur создаёт containing block
          для position:fixed и overflow-hidden режет панель до 64px (казалось «не нажимается») */}
      <A11yPanel open={showA11y} onClose={()=>setShowA11y(false)} items={items.map(({to,label})=>({to,label}))} />
      {/* PWA: карточка «Установить приложение», когда браузер это разрешает */}
      <InstallPWA />
    </div>
  )
}
