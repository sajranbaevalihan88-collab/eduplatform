import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Общие pptx-примитивы для просмотра и редактора:
// - parseCssGradient: CSS linear-gradient -> SVG-градиент
//   (SVG не понимает fill="linear-gradient(...)" и рисует ЧЁРНЫМ)
// - SvgShape: векторный контур freeform с поддержкой градиента
// - PdfPage/PdfThumb: попиксельный PDF-двойник оригинала через pdf.js

export const parseCssGradient = (css: string) => {
  const m = /^linear-gradient\(\s*([\d.]+)deg\s*,(.+)\)\s*$/.exec(css||'')
  if (!m) return null
  const angle = parseFloat(m[1])
  const parts = (m[2]||'').split(/,(?![^(]*\))/).map(s=>s.trim()).filter(Boolean)
  const stops = parts.map(p=>{
    const cm = /^(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|\S+)\s+([\d.]+)%\s*$/.exec(p)
    if (!cm) return null
    let col = cm[1], op = 1
    const rm = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(col)
    if (rm) {
      col = '#'+[rm[1],rm[2],rm[3]].map(v=>Math.max(0,Math.min(255,Math.round(parseFloat(v)))).toString(16).padStart(2,'0')).join('')
      if (rm[4]!==undefined) op = Math.max(0,Math.min(1,parseFloat(rm[4])))
    }
    return {color: col, opacity: op, offset: Math.max(0,Math.min(100,parseFloat(cm[2])))}
  }).filter(Boolean) as {color:string,opacity:number,offset:number}[]
  if (!stops.length) return null
  const rad = angle*Math.PI/180
  const dx = Math.sin(rad), dy = -Math.cos(rad)
  return {x1: 0.5-dx/2, y1: 0.5-dy/2, x2: 0.5+dx/2, y2: 0.5+dy/2, stops}
}

export function SvgShape({st, gid, svgStyle}: any){
  const rawFill = st.fill && st.fill!=='transparent' ? st.fill : 'none'
  const grad = typeof rawFill==='string' ? parseCssGradient(rawFill) : null
  const id = grad ? (gid || ('sg-'+Math.random().toString(36).slice(2))) : undefined
  const fillOk = grad ? `url(#${id})` : rawFill
  return (
    <svg viewBox={`0 0 ${st.svgW||10000} ${st.svgH||10000}`} preserveAspectRatio={st.icon?"xMidYMid meet":"none"} style={{width:'100%', height:'100%', display:'block', overflow:'visible', ...(svgStyle||{})}}>
      {grad && <defs><linearGradient id={id} x1={grad.x1} y1={grad.y1} x2={grad.x2} y2={grad.y2}>{grad.stops.map((s:any,i:number)=><stop key={i} offset={`${s.offset}%`} stopColor={s.color} stopOpacity={s.opacity}/>)}</linearGradient></defs>}
      <path d={st.svgPath} fill={fillOk} stroke={st.stroke||'none'} strokeWidth={st.strokeWidth||0} strokeDasharray={st.dash==='dotted'?'2 3':st.dash==='dashed'?'7 4':undefined} strokeLinecap={st.dash&&st.dash!=='solid'?'round':undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
    </svg>
  )
}

// PDF-двойник оригинала: попиксельный рендер страницы через pdf.js (ленивый импорт,
// воркер локальный — работает офлайн; документ кэшируем на URL)
const _pdfDocs = new Map<string, Promise<any>>()
export const getPdfDoc = (url:string) => {
  let p = _pdfDocs.get(url)
  if(!p){
    p = (async()=>{
      const pdfjs:any = await import('pdfjs-dist')
      try{
        const w:any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = w.default || w
      }catch{}
      return pdfjs.getDocument({url, withCredentials:false}).promise
    })()
    _pdfDocs.set(url, p)
    p.catch(()=>{ _pdfDocs.delete(url) })
  }
  return p
}

export function PdfPage({url, page, scale=2, className, style, imgStyle, onError}: any){
  const ref = useRef<HTMLCanvasElement|null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(()=>{
    let dead=false; let task:any=null
    setFailed(false)
    getPdfDoc(url).then(async (doc:any)=>{
      if(dead) return
      try{
        const pg = await doc.getPage(page)
        if(dead) return
        const vp = pg.getViewport({scale})
        const cv = ref.current
        if(!cv) return
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height)
        const ctx = cv.getContext('2d')
        if(!ctx) return
        task = pg.render({canvasContext: ctx, viewport: vp})
        await task.promise
      }catch(e:any){
        if(dead) return
        if(e?.name==='RenderingCancelledException') return
        setFailed(true); onError && onError()
      }
    }).catch(()=>{ if(!dead){ setFailed(true); onError && onError() } })
    return ()=>{ dead=true; try{ task?.cancel() }catch{} }
  },[url, page, scale])
  if(failed) return null
  return <canvas ref={ref} className={className} style={{...style, ...(imgStyle||{})}}/>
}

// ленивая миниатюра PDF: рендерим только когда видна
export function PdfThumb({url, page}: any){
  const wrap = useRef<HTMLDivElement|null>(null)
  const [vis, setVis] = useState(false)
  useEffect(()=>{
    const el = wrap.current
    if(!el) return
    const io = new IntersectionObserver((es)=>{ if(es.some(e=>e.isIntersecting)){ setVis(true); io.disconnect() } }, {rootMargin:'200px'})
    io.observe(el)
    return ()=>io.disconnect()
  },[])
  return <div ref={wrap} className="h-full w-full relative overflow-hidden">{vis ? <PdfPage url={url} page={page} scale={0.4} className="w-full h-full object-contain"/> : null}</div>
}

// PowerPoint "shrink text on overflow": если текст не влезает в свой бокс —
// ужимаем zoom так, чтобы влез (иначе строки наползают на соседние блоки).
// Однострочным боксам подбираем ширину (nowrap-замер через класс), многострочным — высоту.
export function FitBox({boxStyle, innerStyle, hasH, paras, className, children, overlay, fit=true, ...rest}: any){
  const o = useRef<HTMLDivElement|null>(null)
  const el = useRef<HTMLDivElement|null>(null)
  const [,bump] = useState(0)
  const refont = useRef(false)
  useLayoutEffect(()=>{
    const box = o.current, inner = el.current
    if(!box || !inner || !hasH || !fit) return
    // веб-шрифт подменяется позже — пересчитать после его загрузки
    try{
      if(!refont.current && (document as any)?.fonts?.ready){
        refont.current = true
        ;(document as any).fonts.ready.then(()=>bump(x=>x+1))
      }
    }catch{}
    inner.style.zoom = '1'
    inner.classList.remove('nowrap-probe')
    const ch = box.clientHeight
    const shWrap = inner.scrollHeight
    if(!ch || shWrap <= ch + 3) return
    // высота одной строки (nowrap через класс — перебивает inline pre-wrap)
    inner.classList.add('nowrap-probe')
    const nw = inner.scrollWidth, cw = inner.clientWidth, lineH = inner.scrollHeight
    inner.classList.remove('nowrap-probe')
    let z = ch / shWrap
    // однострочный бокс (высота ~1 строка), текст вылез вширь: ужимаем по ширине
    if((paras||1) === 1 && ch <= lineH * 1.6 && nw > cw && cw > 0){
      z = cw / nw
    }
    z = Math.max(0.5, Math.min(1, z))
    if(z < 0.999) inner.style.zoom = String(z)
  })
  return <div ref={o} style={boxStyle} className={className} {...rest}><div style={innerStyle}><div ref={el} className="w-full" style={{width:'100%'}}>{children}</div></div>{overlay}</div>
}
