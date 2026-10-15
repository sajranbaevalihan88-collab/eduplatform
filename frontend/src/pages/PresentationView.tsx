import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import client, { mediaUrl } from '../api/client'
import { Eye, Edit, Play, ChevronLeft, ChevronRight, Maximize2, Copy, Trash2 } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

const resolveSrc = (src?:string)=> src?.startsWith('/media') ? mediaUrl(src) : (src||'')

// Потерянный файл картинки: прячем битую иконку, показываем плейсхолдер (CSS .img-missing)
const imgMissing = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget
  t.style.display = 'none'
  t.parentElement?.classList.add('img-missing')
}


export default function PresentationView(){
  const {t}=useLang()
  const {id}=useParams()
  const nav=useNavigate()
  const [pres,setPres]=useState<any>(null)
  const [searchParams]=useSearchParams()
  const fromPath=searchParams.get('from') && searchParams.get('from')!.startsWith('/') ? searchParams.get('from')! : null
  const startSlide=Math.max(0, Math.min(200, parseInt(searchParams.get('slide')||'0',10)||0))
  const [slides,setSlides]=useState<any[]>([])
  const [idx,setIdx]=useState(startSlide)
  const [me,setMe]=useState<any>(null)
  const [slideshow,setSlideshow]=useState(false)

  useEffect(()=>{
    const raw=localStorage.getItem('user')
    if(raw) try{ setMe(JSON.parse(raw)) }catch{}
    client.get(`/presentations/${id}/`).then(r=>{
      setPres(r.data)
      const s=(r.data.slides||[]).sort((a:any,b:any)=>a.order-b.order)
      setSlides(s)
    }).catch(()=>{})
  },[id])

  if(!pres) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto"/></div>

  const cur=slides[idx]
  const isOwner = me && (String(pres.owner)===String(me.id) || String(pres.owner_id)===String(me.id) || me.role==='admin' || me.is_staff)
  const handleDelete=async()=>{
    if(!confirm(t('pv_del_confirm'))) return
    try{ await client.delete(`/presentations/${id}/`); toast(t('pres_deleted'),'success'); nav('/presentations') }catch(err:any){ toast(err?.response?.data?.detail||t('pv_del_err'),'error') }
  }
  const bgStyle = (s:any)=>{
    // senior: поддержка solid/gradient/image + legacy
    if(s.gradient) return {background:s.gradient}
    if(s.backgroundType==='gradient' && s.gradient) return {background:s.gradient}
    if(s.bg_image) return {backgroundImage:`url(${resolveSrc(s.bg_image)})`, backgroundSize:'cover', backgroundPosition:'center'}
    if(s.backgroundType==='image' && s.bgImage) return {backgroundImage:`url(${resolveSrc(s.bgImage)})`, backgroundSize:'cover', backgroundPosition:'center'}
    const bg = s.background||'#ffffff'
    if(bg.startsWith('linear-gradient')||bg.startsWith('radial-gradient')||bg.startsWith('url(')) return {background:bg}
    return {background: bg}
  }
  // точечная текстура тёмных слайдов как в PowerPoint
  const slideDotsCls = (s:any)=>{
    try{
      const bg = s?.background
      if(typeof bg==='string' && bg.startsWith('#') && !isLight(bg)) return 'slide-dots'
    }catch{}
    return ''
  }
  // aspect слайда из реальных размеров (EMU): 4:3 слайды не тянутся на 16:9
  const slideAspectStyle=(s:any)=>{ const w=s?.width, h=s?.height; if(w&&h&&w>0&&h>0) return {aspectRatio:`${w} / ${h}`} as any; return {aspectRatio:'16 / 9'} as any }

  const isLight = (c:string)=>{    if(!c||typeof c!=='string') return true
    const hex=c.replace('#','').trim().toUpperCase()
    if(hex.length===3) return true
    if(hex.length!==6) return false
    try{
      const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16)
      if(isNaN(r)||isNaN(g)||isNaN(b)) return false
      return 0.299*r+0.587*g+0.114*b > 200
    }catch{return false}
  }
  const textStyleWithBg = (b:any, isTitle=false, isSlideshow=false, slideBg?:string) => {
    // senior: не инвертировать белый текст на тёмном фоне
    const raw = b.style?.color
    let col = raw || (slideBg && !isLight(slideBg) ? '#ffffff' : '#1e293b')
    const slideIsLight = slideBg ? isLight(slideBg) : true
    const hasOwnBg = !!b.style?.background
    const isHighlight = !!b.style?.highlight
    // только белый-на-белом -> тёмный
    if(col && isLight(col) && slideIsLight && !hasOwnBg && !isHighlight){
      col = '#1e293b'
    }
    const s:any = {
      fontSize: (b.style?.fontSize||20)*(isSlideshow?1.08:1),
      fontFamily: b.style?.fontFamily ? `'${b.style.fontFamily}', 'Segoe UI', system-ui, 'Microsoft YaHei', 'Noto Sans SC', sans-serif` : 'Inter, system-ui, sans-serif',
      fontWeight: b.style?.bold?'700':'400',
      fontStyle: b.style?.italic?'italic':'normal',
      textDecoration: b.style?.underline?'underline':'none',
      textAlign: (b.style?.align|| (b.paragraphs?.[0]?.align||'left')),
      color: col,
      lineHeight: b.style?.lineHeight||1.35,
      wordBreak: 'break-word' as any,
    }
    if (b.style?.background) return {...s, background: b.style.background, padding:'5px 10px', borderRadius:'6px', display:'inline-block', color: raw||col}
    if (b.style?.highlight) return {...s, background: b.style?.highlightColor||'#fef08a', padding:'2px 6px', borderRadius:'4px', display:'inline-block', color: raw||'#1e293b'}
    return s
  }
  const renderRichText = (b:any, isTitle:boolean, isSlideshow:boolean, slideBg?:string)=>{
    // senior: paragraphs + runs
    if(b.paragraphs && Array.isArray(b.paragraphs) && b.paragraphs.length){
      return (
        <div className="w-full">
          {b.paragraphs.map((p:any, pi:number)=>{
            const align = p.align||b.style?.align||'left'
            const level = p.level||0
            const isBullet = level>0 || b.style?.bullet
            return (
              <div key={pi} style={{textAlign: align, marginBottom: '0.35em', marginLeft: isBullet? '1.1em' : 0, position:'relative', whiteSpace:'pre-wrap'}} className={isBullet? 'bullet-para':''}>
                {isBullet && <span style={{position:'absolute', left:'-1em', color:'#e11d48', fontWeight:700}}>•</span>}
                {p.runs ? p.runs.map((r:any, ri:number)=>{
                  const rs:any = r.style||{}
                  let col = rs.color || b.style?.color || (slideBg && !isLight(slideBg)? '#ffffff':'#1e293b')
                  // per-run light fix
                  if(col && isLight(col) && slideBg && isLight(slideBg) && !b.style?.background && !rs.highlight) col = '#1e293b'
                  return <span key={ri} style={{
                    fontSize: rs.fontSize? (rs.fontSize*(isSlideshow?1.08:1)): undefined,
                    fontFamily: rs.fontFamily||undefined,
                    fontWeight: rs.bold?'700': rs.fontWeight||undefined,
                    fontStyle: rs.italic?'italic':undefined,
                    textDecoration: rs.underline?'underline':undefined,
                    color: col,
                    background: rs.highlight ? (rs.highlightColor||'#fef08a') : undefined,
                    padding: rs.highlight? '1px 4px': undefined,
                    borderRadius: rs.highlight? '3px': undefined,
                    textShadow: rs.textShadow || undefined,
                  }}>{r.text}</span>
                }) : <span style={textStyleWithBg(b,isTitle,isSlideshow,slideBg)}>{p.runs?.map((r:any)=>r.text).join('')||''}</span>}
              </div>
            )
          })}
        </div>
      )
    }
    // fallback simple
    const hasBullet = b.style?.bullet
    return <div style={{...textStyleWithBg(b,isTitle,isSlideshow,slideBg), textAlign: b.style?.align||'left', width:'100%'}} className={hasBullet? 'pl-4 relative':''}>{hasBullet && <span style={{position:'absolute', left:0, color:'#e11d48'}}>• </span>}{b.content}</div>
  }

  const renderBlocks = (blocks:any[], isSlideshow=false, slide?:any) => {
    if(!blocks||blocks.length===0) return <div className="flex-1 flex items-center justify-center text-slate-400">{t('pv_empty_slide')}</div>
    const slideBg = slide?.background||slide?.gradient||'#ffffff'
    const hasGeometry = blocks.some((b:any)=> b.style && (b.style.x!==undefined || b.style.w!==undefined))
    // legacy rebus/title fallback только для старых импортов без геометрии
    if(!hasGeometry){
      const hasRebus = blocks.filter((b:any)=>b.type==='image').length>=1 && (blocks.some((b:any)=>b.content?.trim()==='+') || blocks.some((b:any)=>b.content?.trim()==='='))
      const hasTwoImages = blocks.filter((b:any)=>b.type==='image').length>=2
      if (hasRebus && hasTwoImages) {
        const title = blocks.find((b:any)=>b.type==='text' && (b.content?.trim().startsWith('Ребус #') || b.content?.trim()==='РЕБУСЫ'))
        const images = blocks.filter((b:any)=>b.type==='image')
        const plus = blocks.find((b:any)=>b.content?.trim()==='+')
        const equal = blocks.find((b:any)=>b.content?.trim()==='=')
        const bigAnswer = blocks.find((b:any)=>b.type==='text' && (b.style?.fontSize||0)>=36 && b.style?.color==='#FF6B35' && !b.content?.trim().startsWith('Ребус'))
        const hints = blocks.filter((b:any)=>b.type==='text' && (b.style?.fontSize||0)===20 && b.content?.trim()!=='+' && b.content?.trim()!=='=' && !b.content?.trim().startsWith('Ребус') && b.id!==bigAnswer?.id)
        return (
          <div className="flex flex-col items-center gap-4 w-full py-2">
            {title && <div style={textStyleWithBg(title, true, isSlideshow, slideBg)}>{title.content}</div>}
            <div className="flex items-center justify-center gap-4 md:gap-6">
              {images[0] && <img src={resolveSrc(images[0].src)} className={`${isSlideshow?'w-[260px] h-[220px]':'w-[200px] h-[170px]'} object-contain rounded-xl shadow-sm bg-white`} alt=""/>}
              {plus && <span style={{fontSize:isSlideshow?56:44, fontWeight:'800', color:'#2C1810'}}>+</span>}
              {images[1] && <img src={resolveSrc(images[1].src)} className={`${isSlideshow?'w-[260px] h-[220px]':'w-[200px] h-[170px]'} object-contain rounded-xl shadow-sm bg-white`} alt=""/>}
              {equal && <span style={{fontSize:isSlideshow?56:44, fontWeight:'800', color:'#2C1810'}}>=</span>}
            </div>
            {bigAnswer && <div style={textStyleWithBg(bigAnswer, true, isSlideshow, slideBg)}>{bigAnswer.content}</div>}
            {hints.length>0 && <div className="flex gap-6 text-sm text-slate-600"><span>{hints[0]?.content}</span>{hints[1] && <span>• {hints[1]?.content}</span>}</div>}
          </div>
        )
      }
      if (hasRebus && !hasTwoImages) {
        const title = blocks.find((b:any)=>b.type==='text' && b.content?.trim().startsWith('Ребус'))
        const img = blocks.find((b:any)=>b.type==='image')
        const eq = blocks.find((b:any)=>b.content?.trim()==='=')
        const answer = blocks.find((b:any)=>b.type==='text' && (b.style?.fontSize||0)>=30 && b.content?.trim().toUpperCase()===b.content?.trim() && !b.content?.trim().startsWith('Ребус'))
        const subs = blocks.filter((b:any)=>b.type==='text' && b.id!==title?.id && b.id!==eq?.id && b.id!==answer?.id && b.content?.trim()!=='' && b.content?.trim()!=='=')
        return (
          <div className="flex flex-col items-center gap-4 w-full py-4">
            {title && <div style={textStyleWithBg(title, true, isSlideshow, slideBg)}>{title.content}</div>}
            {img && <img src={resolveSrc(img.src)} className={`${isSlideshow?'max-h-[280px]':'max-h-[240px]'} max-w-[70%] object-contain rounded-xl mx-auto`} alt=""/>}
            {eq && <span style={{fontSize:isSlideshow?44:32, fontWeight:'800'}}> = </span>}
            {answer && <div style={textStyleWithBg(answer, true, isSlideshow, slideBg)}>{answer.content}</div>}
            {subs.length>0 && <div className="flex gap-4 text-sm text-slate-500">{subs.slice(0,2).map((b:any)=><span key={b.id} style={textStyleWithBg(b, false, isSlideshow, slideBg)}>{b.content}</span>)}</div>}
          </div>
        )
      }
      const isTitleSlide = blocks.some((b:any)=>b.content?.trim()==='РЕБУСЫ' || b.content?.trim()==='Акционерное Общество')
      if (isTitleSlide) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 w-full py-6">
            {blocks.map((b:any)=>(
              <div key={b.id} style={textStyleWithBg(b, b.content?.trim()==='РЕБУСЫ' || b.content?.trim()==='Акционерное Общество', isSlideshow, slideBg)} className="max-w-[92%] text-center">{b.content}</div>
            ))}
          </div>
        )
      }
      return blocks.map((b:any)=>(
        <div key={b.id} className="w-full flex justify-center">
          {b.type==='text' && <div className="max-w-[90%] text-center w-full">{renderRichText(b,false,isSlideshow,slideBg)}</div>}
          {b.type==='image' && <img onError={imgMissing} src={resolveSrc(b.src)} className={`${isSlideshow?'max-h-[360px]':'max-h-[300px]'} max-w-[80%] object-contain rounded-xl mx-auto`} alt=""/>}
          {b.type==='shape' && null}
          {b.type==='table' && <div className="border rounded-lg overflow-hidden w-full max-w-[90%] mx-auto"><div className="grid gap-px bg-slate-200" style={{gridTemplateColumns:`repeat(${b.table?.cols||3},1fr)`}}>{Array.from({length:(b.table?.rows||3)*(b.table?.cols||3)}).map((_,k)=><div key={k} className="bg-white p-2 text-sm">{t('pv_cell')}</div>)}</div></div>}
        </div>
      ))
    }
    // senior: absolute layout 1:1 как в PowerPoint — проценты от slideWidth/slideHeight
    const hasShape = blocks.some((b:any)=>b.type==='shape')
    const isCardBg = (slideBg||'').toString().toUpperCase()==='#F8F9FA'
    return (
      <div className="absolute inset-0">
        {blocks
          .slice()
          .sort((a:any,b:any)=> (a.style?.z||0)-(b.style?.z||0))
          .map((b:any)=>{
          const s = b.style||{}
          const left = s.x!=null? `${s.x}%` : undefined
          const top = s.y!=null? `${s.y}%` : undefined
          const width = s.w!=null? `${s.w}%` : undefined
          const height = s.h!=null? `${s.h}%` : undefined
          const rot = s.rotation? `rotate(${s.rotation}deg)` : undefined
          // fallback карточка для Фирма когда подложки не были импортированы (старые презентации p16)
          const needCard = !hasShape && isCardBg && !s.background && (s.fontSize||16) < 24 && blocks.length>12 && (s.w||0) < 60
          const common: any = {
            position:'absolute',
            left, top, width, height,
            transform: rot,
            zIndex: s.z||0,
            overflow: s.h? 'hidden' : undefined,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: s.verticalAlign==='middle'? 'center' : s.verticalAlign==='bottom'? 'flex-end' : 'flex-start',
            padding: s.paddingPct ? `${s.paddingPct[0]}% ${s.paddingPct[1]}% ${s.paddingPct[2]}% ${s.paddingPct[3]}%` : needCard ? '8px 10px' : s.background? '6px 8px' : undefined,
            background: needCard ? '#ffffff' : s.background||undefined,
            borderRadius: needCard ? '8px' : s.background? '6px': undefined,
            boxShadow: needCard ? '0 2px 10px rgba(0,0,0,0.06)' : undefined,
            border: needCard ? '1px solid #f1f5f9' : undefined,
          }
          const animClass = b.animation && b.animation!=='нет' ? `animate-${b.animation}` : ''
          if(b.type==='text'){
            const isTitle = (s.fontSize||0)>=32
            const va = s.verticalAlign||'top', hasH = s.h!=null
            const innerAnchor:any = !hasH ? {position:'relative'} : va==='middle' ? {position:'absolute', left:0, right:0, top:'50%', transform:'translateY(-50%)'} : va==='bottom' ? {position:'absolute', left:0, right:0, bottom:0} : {position:'absolute', left:0, right:0, top:0}
            // дефолтные внутренние отступы PowerPoint (~0.1in ≈ 7px), иначе текст липнет к краю бокса/декору
            const defPad = s.paddingPct ? undefined : '1px 7px'
            return <div key={b.id} style={{...common, height: hasH ? `${s.h}%` : 'auto', overflow:'visible', display:'block', padding: common.padding || defPad, border: s.stroke ? `${s.strokeWidth||1}px ${s.dash||'solid'} ${s.stroke}` : undefined}} className={animClass}><div style={innerAnchor}><div className="w-full" style={{...textStyleWithBg(b,isTitle,isSlideshow,isCardBg && needCard ? '#ffffff' : slideBg), textAlign: s.align||'left', width:'100%'}}>{renderRichText(b,isTitle,isSlideshow,isCardBg && needCard ? '#ffffff' : slideBg)}</div></div></div>
          }
          if(b.type==='image'){
            if(b.unrenderable) return <div key={b.id} style={{...common, padding:0, background:'transparent'}} className={animClass}><div className="w-full h-full rounded flex flex-col items-center justify-center bg-slate-100/80 border border-dashed border-slate-300 text-slate-500 text-xs p-2 text-center">{t('pv_img_na_a')}.{b.origExt||'emf'}{t('pv_img_na_b')}</div></div>
            return <div key={b.id} style={{...common, padding:0, background:'transparent'}} className={animClass}><img onError={imgMissing} src={resolveSrc(b.src)} style={{width:'100%', height:'100%', objectFit: s.objectFit||'contain', borderRadius: s.borderRadius||4, opacity: s.opacity||1, boxShadow: s.shadow? '0 4px 16px rgba(0,0,0,0.15)':'none'}} alt=""/></div>
          }
          if(b.type==='shape'){
            // скрываем декоративные прямоугольники импорта (угловые #FF8C69/#7EDBD5) — новые фигуры показываем
            const isDecorative = s.fill && ['#FF8C69','#7EDBD5','#FFE66D','#FF6B35'].includes(s.fill.toUpperCase()) && s.x!==undefined && (s.x<15 || s.x>75) && s.y<20
            if(isDecorative) return null
            // freeform из pptx: рисуем настоящий векторный контур, а не бокс
            if(s.svgPath){
              const fillOk = s.fill && s.fill!=='transparent' ? s.fill : 'none'
              return <div key={b.id} style={{...common, background:'transparent', border:'none', boxShadow:'none', padding:0, alignItems:'stretch', justifyContent:'stretch', overflow:'visible'}} className={animClass}>
                <svg viewBox={`0 0 ${s.svgW||10000} ${s.svgH||10000}`} preserveAspectRatio={s.icon?"xMidYMid meet":"none"} style={{width:'100%', height:'100%', display:'block', overflow:'visible'}}>
                  <path d={s.svgPath} fill={fillOk} stroke={s.stroke||'none'} strokeWidth={s.strokeWidth||0} strokeDasharray={s.dash==='dotted'?'2 3':s.dash==='dashed'?'7 4':undefined} strokeLinecap={s.dash&&s.dash!=='solid'?'round':undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
                </svg>
              </div>
            }
            const isEllipse = s.preset==='ellipse' || b.shape==='ellipse' || b.shape==='circle'
            // радиус из оригинала (adj): 0 = острые углы; своё дефолтное не выдумываем поверх svg-контура
            const radiusCss = s.svgPath ? 0 : (s.radiusPct!=null ? (s.radiusPct<=0 ? 0 : '12px') : 6)
            const dashCss = s.dash && s.dash!=='solid' ? (s.dash==='dotted' ? 'dotted' : 'dashed') : 'solid'
            return <div key={b.id} style={{...common, background: s.fill||'#f1f5f9', borderColor: s.stroke||'transparent', borderWidth: s.strokeWidth||0, borderStyle: dashCss, opacity: s.opacity||1, borderRadius: isEllipse ? '50%' : radiusCss, alignItems:'center', justifyContent:'center', boxShadow: s.shadow ? '0 2px 10px rgba(0,0,0,0.07)' : undefined, border: s.shadow ? '1px solid #f1f5f9' as any : undefined}} className={`flex ${animClass}`}></div>
          }
          if(b.type==='table'){
            const cells = b.table?.cells
            const rows = b.table?.rows||3, cols=b.table?.cols||3
            const hasFill = (cells||[]).some((row:any)=>row.some((c:any)=>c?.style?.background))
            return (
              <div key={b.id} style={{...common, overflow:'hidden', borderRadius:8, border:'1px solid #e2e8f0'}}>
                <div className={`grid gap-px w-full h-full ${hasFill?'bg-slate-200':'bg-transparent'}`} style={{gridTemplateColumns:`repeat(${cols},1fr)`, gridTemplateRows:`repeat(${rows},1fr)`}}>
                  {(cells||[]).flatMap((rrow:any)=>rrow.filter((cell:any)=>!cell?.merged).map((cell:any,k:number)=>{
                    const txt = cell?.text ?? '—'
                    const cstyle:any = cell?.style||{}
                    return <div key={k} className="p-1.5 flex items-center text-xs leading-tight overflow-hidden" style={{gridColumn:`span ${cell?.colspan||1}`, gridRow:`span ${cell?.rowspan||1}`, background: cstyle.background||'transparent', color: cstyle.color||'#1e293b', fontWeight: cstyle.bold?'700':'400', justifyContent:'flex-start'}}>{txt}</div>
                  }))}
                </div>
              </div>
            )
          }
          return <div key={b.id} style={common}>{b.content||''}</div>
        })}
      </div>
    )
  }

  const curIsAbsolute = cur && (cur.content?.blocks||[]).some((b:any)=> b.style && b.style.x!==undefined)
  const getTransitionClass=(t:string)=>{ const m:any={fade:'animate-enter', slide:'animate-slide', zoom:'animate-zoom', wipe:'animate-wipe', split:'animate-split', random:'animate-random', 'нет':''}; return m[t]||'' }
  if(slideshow && cur){
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div key={`${idx}-${cur.transition}`} className={`w-[960px] max-w-[95vw] aspect-video shrink-0 rounded-xl overflow-hidden shadow-2xl relative ${getTransitionClass(cur.transition||'fade')} ${slideDotsCls(cur)} ${curIsAbsolute?'':'bg-white p-6 md:p-10 flex flex-col items-center justify-center gap-3 overflow-auto'}`} style={{...bgStyle(cur), ...slideAspectStyle(cur)}}>
            {curIsAbsolute ? <div className="absolute inset-0">{renderBlocks(cur.content?.blocks||[], true, cur)}</div> : renderBlocks(cur.content?.blocks||[], true, cur)}
          </div>
        </div>
        <div className="h-14 bg-white/10 backdrop-blur flex items-center justify-center gap-3 text-white">
          <button onClick={()=>setIdx(i=>Math.max(0,i-1))} className="px-4 py-2 rounded-lg bg-white text-slate-900">{t('pv_back')}</button>
          <span>{idx+1} / {slides.length}</span>
          <button onClick={()=>setIdx(i=>Math.min(slides.length-1,i+1))} className="px-4 py-2 rounded-lg bg-white text-slate-900">{t('pv_next')}</button>
          <button onClick={()=>setSlideshow(false)} className="ml-4 px-4 py-2 rounded-lg bg-red-600">{t('pv_exit')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {fromPath ? (
          <Link to={fromPath} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">{t('tt_back_lesson')}</Link>
        ) : (
          <Link to="/presentations" className="hover:text-blue-600">{t('presentations')}</Link>
        )}
        <span>›</span>
        <span className="text-slate-900 font-medium truncate">{pres.title}</span>
      </div>

      <div className="bg-white rounded-2xl border p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold dark:text-white">{pres.title}</h1>
          <p className="text-slate-500 mt-1">{pres.description||t('pres_no_desc')}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="px-2 py-1 rounded-full bg-slate-100">{slides.length} {t('pres_slides')}</span>
            <span>• {new Date(pres.updated_at).toLocaleDateString()}</span>
            {pres.is_public ? <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{t('pv_public')}</span> : pres.is_lesson_private ? <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title={t('pv_lesson_only_hint')}>{t('pv_lesson_only')}</span> : <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">{t('pv_private')}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setSlideshow(true)} className="px-4 py-2 rounded-xl bg-blue-700 text-white flex items-center gap-2 text-sm"><Play size={16}/> {t('pv_slideshow')}</button>
          {isOwner ? (
            <Link to={`/presentations/${id}/edit`} className="px-4 py-2 rounded-xl bg-blue-600 text-white flex items-center gap-2 text-sm"><Edit size={16}/> {t('edit')}</Link>
          ) : (
            <span className="px-4 py-2 rounded-xl bg-slate-100 text-slate-400 text-sm" title={t('lessons_edit_lock')}>{t('pv_readonly')}</span>
          )}
          {isOwner && <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center gap-2 text-sm hover:bg-red-100" title={t('pv_del_title')}><Trash2 size={16}/>{t('delete')}</button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0} className="p-2 rounded-xl bg-slate-100 disabled:opacity-40"><ChevronLeft size={18}/></button>
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border text-sm font-medium">{idx+1} / {slides.length}</span>
            <button onClick={()=>setIdx(i=>Math.min(slides.length-1,i+1))} disabled={idx===slides.length-1} className="p-2 rounded-xl bg-slate-100 disabled:opacity-40"><ChevronRight size={18}/></button>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setSlideshow(true)} className="px-3 py-1.5 rounded-xl bg-white border flex items-center gap-1.5 text-sm"><Maximize2 size={14}/> {t('pv_fullscreen')}</button>
            {isOwner && <Link to={`/presentations/${id}/edit`} className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm flex items-center gap-1"><Edit size={14}/> {t('edit')}</Link>}
          </div>
        </div>

        {cur ? (
          <div key={`${idx}-${cur.transition}`} className={`aspect-video shrink-0 rounded-xl border shadow-lg overflow-hidden relative ${getTransitionClass(cur.transition||'fade')} ${curIsAbsolute?'':'flex flex-col'}`} style={{...bgStyle(cur), ...slideAspectStyle(cur)}}>
            {curIsAbsolute ? (
              <>
                <div className="absolute inset-0">
                  {renderBlocks(cur.content?.blocks||[], false, cur)}
                </div>
                {(!cur.content?.blocks || cur.content.blocks.length===0) && <div className="absolute inset-0 flex items-center justify-center text-slate-400">{t('pv_empty_slide')}</div>}
              </>
            ) : (
              <div className="flex-1 p-6 flex flex-col items-center justify-center gap-3 overflow-auto">
                {renderBlocks(cur.content?.blocks||[], false, cur)}
                {(!cur.content?.blocks || cur.content.blocks.length===0) && <div className="flex-1 flex items-center justify-center text-slate-400">{t('pv_empty_slide')}</div>}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-slate-50/95 backdrop-blur border-t flex items-center justify-between px-3 text-xs text-slate-500 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity" title={t('pv_slide_info')}>
              <span>{t('pv_slide')} {idx+1} • {cur.layout||'blank'} {cur.transition && `• ${cur.transition}`}</span>
              <span className="truncate max-w-[50%]">{cur.background?.slice(0,60)}</span>
            </div>
          </div>
        ) : (
          <div className="aspect-video shrink-0 rounded-xl border flex items-center justify-center text-slate-400">{t('pv_no_slides')}</div>
        )}

        <div className="mt-4 flex gap-2 overflow-auto pb-2">
          {slides.map((s:any,i:number)=>{
            const thumbBg = s.background||'#ffffff'
            const thumbIsDark = thumbBg && !isLight(thumbBg) && !thumbBg.startsWith('linear-gradient')
            const thumbHasGeom = (s.content?.blocks||[]).some((b:any)=> b.style?.x!==undefined)
            return (
            <button key={i} onClick={()=>setIdx(i)} className={`shrink-0 w-32 aspect-video rounded-lg border-2 overflow-hidden text-left relative ${i===idx?'border-blue-600 ring-2 ring-blue-100':'border-slate-200 hover:border-slate-300'}`}>
              <div className="h-full w-full relative overflow-hidden" style={bgStyle(s)}>
                {thumbHasGeom ? (
                  <div className="absolute inset-0 scale-[0.18] origin-top-left w-[555%] h-[555%]">
                    {s.content?.blocks?.slice(0,6).map((b:any)=>(
                      <div key={b.id} style={{
                        position:'absolute',
                        left: b.style?.x!=null? `${b.style.x}%`:undefined,
                        top: b.style?.y!=null? `${b.style.y}%`:undefined,
                        width: b.style?.w!=null? `${b.style.w}%`: '90%',
                        height: b.style?.h!=null? `${b.style.h}%`: undefined,
                        fontSize: '6px',
                        color: b.style?.color || (thumbIsDark? '#fff':'#1e293b'),
                        overflow:'hidden',
                        lineHeight:1.2
                      }} className="truncate">
                        {b.type==='text'? (b.content?.slice(0,40)||'') : b.type==='image'? '🖼' : '⬜'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full p-1.5 flex flex-col gap-0.5 overflow-hidden">
                    {s.content?.blocks?.slice(0,2).map((b:any,bi:number)=>(
                      <div key={bi} className="text-[7px] leading-tight truncate" style={{color:b.style?.color || (thumbIsDark? '#fff':'#1e293b')}}>{b.type==='text'? b.content?.slice(0,28) : b.type==='image'? '🖼' : '⬜'}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-slate-900/70 text-white text-[8px] text-center">{t('pv_slide')} {i+1}</div>
            </button>
            )
          })}
        </div>
      </div>

      {cur?.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="text-xs font-bold text-amber-800">{t('pv_notes')}</div>
          <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{cur.notes}</div>
        </div>
      )}
    </div>
  )
}
