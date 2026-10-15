import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client, { mediaUrl } from '../api/client'
const resolveSrc = (src?:string)=> src?.startsWith('/media') ? mediaUrl(src) : (src||'')
import { Plus, Trash2, Save, Eye, Play, Type, Image as ImgIcon, Square, Circle, Triangle, Star, Table, BarChart3, Video, Palette, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Copy, Layers, Maximize2, ZoomIn, ZoomOut, List, ListOrdered, Highlighter, WrapText, RotateCw, Move, Sparkles, Layout, Paintbrush, Wand2, Film, FileImage, Shapes, Hexagon, Diamond, Pentagon, BookOpen } from 'lucide-react'

// Потерянный файл картинки: прячем битую иконку, показываем плейсхолдер (CSS .img-missing)
const imgMissing = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const t = e.currentTarget
  t.style.display = 'none'
  t.parentElement?.classList.add('img-missing')
}


type Block = { id:string, type:'text'|'image'|'shape'|'table'|'chart'|'video'|'icon', content?:string, src?:string, shape?:string, style?:any, table?:any, chartData?:any, animation?:string, paragraphs?:any }
type Slide = { id?:number, order:number, background:string, backgroundType?:'solid'|'gradient'|'image', gradient?:string, bgImage?:string, content:{blocks:Block[]}, notes?:string, layout?:string, transition?:string, width?:number, height?:number }

const SHAPES = [
  {k:'rect', label:'Прямоугольник', icon:Square},
  {k:'rounded', label:'Скругл', icon:Square},
  {k:'circle', label:'Круг', icon:Circle},
  {k:'ellipse', label:'Эллипс', icon:Circle},
  {k:'triangle', label:'Треугольник', icon:Triangle},
  {k:'rightTriangle', label:'Прям.треуг', icon:Triangle},
  {k:'diamond', label:'Ромб', icon:Diamond},
  {k:'pentagon', label:'Пятиугольник', icon:Pentagon},
  {k:'hexagon', label:'Шестиугольник', icon:Hexagon},
  {k:'star', label:'Звезда', icon:Star},
  {k:'arrow', label:'Стрелка', icon:Move},
  {k:'line', label:'Линия', icon:WrapText},
  {k:'parallelogram', label:'Параллелограмм', icon:Square},
  {k:'trapezoid', label:'Трапеция', icon:Square},
]

const FONTS = ['Inter','Manrope','Arial','Times New Roman','Courier New','Georgia','Verdana']
const TRANSITIONS = ['нет','fade','slide','zoom','wipe','split','random']
const ANIMATIONS = ['нет','fadeIn','slideIn','zoomIn','bounce','flip','float']

function slideDotsCls(bg:any){
  // точечная текстура тёмных слайдов как в PowerPoint (едва заметная)
  try{
    if(typeof bg==='string' && bg.startsWith('#') && isDarkColor(bg)) return 'slide-dots'
  }catch{}
  return ''
}
function isDarkColor(hex:string){
  try{
    if(!hex||typeof hex!=='string') return false
    const h=hex.trim().toUpperCase()
    if(h.startsWith('LINEAR-GRADIENT')||h.startsWith('RADIAL')) return false
    let c=h.replace('#','')
    if(c.length===3) c=c.split('').map(ch=>ch+ch).join('')
    if(c.length!==6) return false
    const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16)
    if(isNaN(r)||isNaN(g)||isNaN(b)) return false
    return 0.299*r+0.587*g+0.114*b < 128
  }catch{ return false }
}

  // PowerPoint overflow model: text box keeps fixed geometry, content is anchored
  // (top/middle/bottom) and spills symmetrically instead of pushing siblings down.
  // НЕ ставить overflow:hidden — PowerPoint по умолчанию показывает выплёскивающийся текст, а не обрезает его
  function anchoredInner(s:any){
    const va=s.verticalAlign||'top', hasH=s.h!=null
    if(!hasH) return {position:'relative' as any}
    if(va==='middle') return {position:'absolute' as any, left:0, right:0, top:'50%', transform:'translateY(-50%)'}
    if(va==='bottom') return {position:'absolute' as any, left:0, right:0, bottom:0}
    return {position:'absolute' as any, left:0, right:0, top:0}
  }

export default function PresentationEditor(){
  const {id}=useParams()
  const nav=useNavigate()
  const isNew=!id
  const [title,setTitle]=useState('Новая презентация')
  const [desc,setDesc]=useState('')
  const [subject,setSubject]=useState<any>(null)
  const [subjects,setSubjects]=useState<any[]>([])
  const [slides,setSlides]=useState<Slide[]>([{order:0, background:'#ffffff', backgroundType:'solid', layout:'title', transition:'fade', content:{blocks:[
    {id:'b1', type:'text', content:'Заголовок презентации', style:{fontSize:36, bold:true, align:'center', color:'#1e293b', fontFamily:'Manrope', x:5, y:15, w:90, h:20, z:1, unit:'%'}},
    {id:'b2', type:'text', content:'Подзаголовок — идея урока, класс, цель', style:{fontSize:18, align:'center', color:'#64748b', fontFamily:'Inter', x:5, y:38, w:90, h:12, z:2, unit:'%'}},
  ]}}])
  const [active,setActive]=useState(0)
  const [selectedBlock,setSelectedBlock]=useState<string|null>(null)
  const [showPreview,setShowPreview]=useState(false)
  const [slideshow,setSlideshow]=useState(false)
  const [zoom,setZoom]=useState(100)
  const [ribbonTab,setRibbonTab]=useState<'home'|'insert'|'design'|'transitions'|'animations'>('home')
  const [history,setHistory]=useState<Slide[][]>([])
  const fileInputRef=useRef<HTMLInputElement>(null)
  const bgImageRef=useRef<HTMLInputElement>(null)
  const pptxInputRef=useRef<HTMLInputElement>(null)
  const [importing,setImporting]=useState(false)
  const canvasRef=useRef<HTMLDivElement>(null)
  const fullscreenRef=useRef<HTMLDivElement>(null)
  const [isEditFullscreen,setIsEditFullscreen]=useState(false)
  const [dragging,setDragging]=useState<{id:string, startX:number, startY:number, origX:number, origY:number}|null>(null)
  const [resizing,setResizing]=useState<{id:string, handle:string, startX:number, startY:number, origX:number, origY:number, origW:number, origH:number}|null>(null)
  const [showGrid,setShowGrid]=useState(true)
  const [importedId,setImportedId]=useState<number|null>(null)

  useEffect(()=>{
    client.get('/subjects/').then(r=>{
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setSubjects(arr)
    }).catch(()=>{})
    if(!isNew){
      client.get(`/presentations/${id}/`).then(r=>{
        setTitle(r.data.title); setDesc(r.data.description||'')
        setSubject(r.data.subject?? r.data.subject_id ?? null)
        if(r.data.slides?.length){
          const s=r.data.slides.sort((a:any,b:any)=>a.order-b.order).map((s:any,idx:number)=>({
            id:s.id, order:idx, background:s.background||'#ffffff', backgroundType:s.backgroundType||s.background_type||'solid', gradient:s.gradient, bgImage:s.bgImage||s.bg_image, layout:s.layout||'blank', transition:s.transition||'fade', width:s.width, height:s.height,
            content: s.content?.blocks ? s.content : {blocks:[{id:'b'+idx, type:'text', content:'Слайд '+(idx+1)}]},
            notes:s.notes||''
          }))
          setSlides(s)
        }
      })
    }
    const sp = new URLSearchParams(window.location.search)
    const subjFromUrl = sp.get('subject')
    if(subjFromUrl && isNew){
      // если пришли из урока с ?subject=slug
      client.get('/subjects/').then(r=>{
        const arr=Array.isArray(r.data)?r.data:r.data.results||[]
        const found=arr.find((x:any)=> String(x.slug)===String(subjFromUrl) || String(x.id)===String(subjFromUrl))
        if(found) setSubject(found.id)
      }).catch(()=>{})
    }
  },[id])

  const cur=slides[active]
  const curSelected = cur?.content.blocks.find(b=>b.id===selectedBlock)

  const pushHistory=()=> setHistory(h=>[...h.slice(-19), JSON.parse(JSON.stringify(slides))])
  const undo=()=>{
    if(!history.length) return
    const prev=history[history.length-1]
    setSlides(prev); setHistory(h=>h.slice(0,-1))
  }
  const handleDragStart=(e:React.MouseEvent, blockId:string)=>{
    const block = cur?.content.blocks.find(b=>b.id===blockId)
    if(!block || block.style?.x===undefined) return
    e.preventDefault()
    setDragging({id:blockId, startX:e.clientX, startY:e.clientY, origX:block.style.x, origY:block.style.y})
  }
  const handleDragMove=(e:React.MouseEvent | MouseEvent)=>{
    if(!dragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    const w = rect?.width || 960
    const h = rect?.height || 540
    const scale = zoom/100
    const dx = ((e.clientX - dragging.startX) / (w/scale)) * 100
    const dy = ((e.clientY - dragging.startY) / (h/scale)) * 100
    const block = cur?.content.blocks.find(b=>b.id===dragging.id)
    const bw = block?.style?.w || 30
    const bh = block?.style?.h || 20
    const newX = Math.max(0, Math.min(100 - bw, dragging.origX + dx))
    const newY = Math.max(0, Math.min(100 - bh, dragging.origY + dy))
    setSlides(sl=>sl.map((s,i)=> i!==active ? s : {...s, content:{...s.content, blocks:s.content.blocks.map(b=> b.id===dragging.id ? {...b, style:{...b.style, x: parseFloat(newX.toFixed(2)), y: parseFloat(newY.toFixed(2))}} : b)}}))
  }
  const handleDragEnd=()=>{
    if(dragging){
      pushHistory()
      setDragging(null)
    }
  }
  const handleResizeStart=(e:React.MouseEvent, blockId:string, handle:string)=>{
    const block = cur?.content.blocks.find(b=>b.id===blockId)
    if(!block) return
    e.preventDefault()
    e.stopPropagation()
    setResizing({id:blockId, handle, startX:e.clientX, startY:e.clientY, origX:block.style?.x||10, origY:block.style?.y||10, origW:block.style?.w||30, origH:block.style?.h||20})
  }
  const handleResizeMove=(e:MouseEvent)=>{
    if(!resizing) return
    const rect = canvasRef.current?.getBoundingClientRect()
    const w = rect?.width || 960
    const h = rect?.height || 540
    const scale = zoom/100
    const dx = ((e.clientX - resizing.startX) / (w/scale)) * 100
    const dy = ((e.clientY - resizing.startY) / (h/scale)) * 100
    let newW = resizing.origW
    let newH = resizing.origH
    let newX = resizing.origX
    let newY = resizing.origY
    const handle = resizing.handle
    if(handle.includes('e')) newW = Math.max(5, resizing.origW + dx)
    if(handle.includes('s')) newH = Math.max(5, resizing.origH + dy)
    if(handle.includes('w')) { newW = Math.max(5, resizing.origW - dx); newX = resizing.origX + dx }
    if(handle.includes('n')) { newH = Math.max(5, resizing.origH - dy); newY = resizing.origY + dy }
    const snap = showGrid ? 2 : 0
    if(snap){
      newX = Math.round(newX/snap)*snap
      newY = Math.round(newY/snap)*snap
      newW = Math.round(newW/snap)*snap
      newH = Math.round(newH/snap)*snap
    }
    newX = Math.max(0, Math.min(100 - newW, newX))
    newY = Math.max(0, Math.min(100 - newH, newY))
    setSlides(sl=>sl.map((s,i)=> i!==active ? s : {...s, content:{...s.content, blocks:s.content.blocks.map(b=> b.id===resizing.id ? {...b, style:{...b.style, x: parseFloat(newX.toFixed(2)), y: parseFloat(newY.toFixed(2)), w: parseFloat(newW.toFixed(2)), h: parseFloat(newH.toFixed(2))}} : b)}}))
  }
  const handleResizeEnd=()=>{
    if(resizing){
      pushHistory()
      setResizing(null)
    }
  }
  const handleCancel=()=>{
    const hasAnyBlock = slides.some(s=> s.content.blocks.some((b:any)=> b.type!=='text' || b.content?.trim() || b.src || b.table || b.shape))
    const hasContent = title.trim()!=='Новая презентация' || desc.trim() || subject || slides.length>1 || hasAnyBlock
    if(importedId){
      // уже создан черновик на сервере — остаётся в профиле как черновик (видно только владельцу)
      if(hasContent && !confirm('Отменить? Презентация сохранена как черновик в профиле (видно только вам) — можно вернуться и доделать.')) return
      nav('/profile?tab=draft')
      return
    }
    if(hasContent && !confirm('Отменить создание презентации? Чёрновик не сохранялся — данные будут потеряны.')) return
    if(window.history.length>2) nav(-1)
    else nav('/presentations')
  }
  const toggleEditFullscreen=async()=>{
    const el = fullscreenRef.current as any
    try{
      if(!document.fullscreenElement){
        if(el?.requestFullscreen) await el.requestFullscreen()
        else setIsEditFullscreen(v=>!v)
      } else {
        if(document.exitFullscreen) await document.exitFullscreen()
        else setIsEditFullscreen(false)
      }
    }catch{
      setIsEditFullscreen(v=>!v)
    }
  }
  useEffect(()=>{
    const onFs=()=> setIsEditFullscreen(!!document.fullscreenElement)
    const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape' && document.fullscreenElement) setIsEditFullscreen(false) }
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('keydown', onKey)
    return ()=>{ document.removeEventListener('fullscreenchange', onFs); window.removeEventListener('keydown', onKey)}
  },[])
  useEffect(()=>{
    if(!dragging) return
    const mm=(e:MouseEvent)=> handleDragMove(e as any)
    const mu=()=> handleDragEnd()
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    return ()=>{ window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu)}
  },[dragging, cur, zoom])
  useEffect(()=>{
    if(!resizing) return
    const mm=(e:MouseEvent)=> handleResizeMove(e as any)
    const mu=()=> handleResizeEnd()
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    return ()=>{ window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu)}
  },[resizing, cur, zoom, showGrid])

  const addSlide=(layout='blank')=>{
    pushHistory()
    const genId=()=> 'b'+Date.now().toString().slice(-6)+Math.random().toString(36).slice(2,4)
    const layouts:any={
      blank:{blocks:[{id:genId(), type:'text', content:'Новый слайд', style:{fontSize:28, bold:true, fontFamily:'Manrope', x:5, y:40, w:90, h:20, z:1, unit:'%'}}]},
      title:{blocks:[
        {id:genId(), type:'text', content:'Заголовок слайда', style:{fontSize:32, bold:true, align:'center', fontFamily:'Manrope', x:5, y:20, w:90, h:18, z:1, unit:'%'}},
        {id:genId(), type:'text', content:'Подзаголовок', style:{fontSize:18, align:'center', color:'#64748b', x:5, y:42, w:90, h:12, z:2, unit:'%'}},
      ]},
      content:{blocks:[
        {id:genId(), type:'text', content:'Заголовок раздела', style:{fontSize:24, bold:true, fontFamily:'Manrope', x:5, y:10, w:90, h:15, z:1, unit:'%'}},
        {id:genId(), type:'text', content:'• Пункт 1\n• Пункт 2\n• Пункт 3', style:{fontSize:16, bullet:true, x:5, y:30, w:90, h:40, z:2, unit:'%'}},
      ]},
      image:{blocks:[
        {id:genId(), type:'text', content:'Слайд с картинкой', style:{fontSize:24, bold:true, x:5, y:10, w:90, h:12, z:1, unit:'%'}},
        {id:genId(), type:'image', src:'https://picsum.photos/800/400', style:{x:10, y:25, w:80, h:55, z:2, unit:'%'}},
      ]},
      table:{blocks:[
        {id:genId(), type:'text', content:'Таблица данных', style:{fontSize:20, bold:true, x:5, y:10, w:90, h:12, z:1, unit:'%'}},
        {id:genId(), type:'table', table:{rows:3, cols:3, cells: Array.from({length:3},()=>Array.from({length:3},()=>({text:'',style:{}})))}, style:{x:5, y:25, w:90, h:55, z:2, unit:'%'}},
      ]},
      chart:{blocks:[
        {id:genId(), type:'text', content:'Диаграмма', style:{fontSize:20, bold:true, x:5, y:10, w:90, h:12, z:1, unit:'%'}},
        {id:genId(), type:'chart', style:{chartType:'bar', x:10, y:25, w:80, h:55, z:2, unit:'%'}, chartData:{labels:['A','B','C','D','E'], values:[40,70,50,80,60]}},
      ]},
    }
    const base=layouts[layout]||layouts.blank
    // ensure all blocks have z
    base.blocks.forEach((b:any,i:number)=>{ if(!b.style) b.style={}; if(b.style.z===undefined) b.style.z=i+1; if(!b.style.unit) b.style.unit='%' })
    setSlides(s=>[...s,{order:s.length, background:'#ffffff', backgroundType:'solid', layout, transition:'fade', content: base}])
    setActive(slides.length)
  }
  const duplicateSlide=()=>{
    pushHistory()
    const copy={...cur, id:undefined, order:slides.length, content: JSON.parse(JSON.stringify(cur.content))}
    setSlides(s=>[...s, copy]); setActive(slides.length)
  }
  const deleteSlide=()=>{
    if(slides.length<=1) return
    pushHistory()
    setSlides(s=>s.filter((_,i)=>i!==active)); setActive(a=>Math.max(0,a-1))
  }

  const addBlock=(type:Block['type'], extra:any={})=>{
    pushHistory()
    const nid='b'+Date.now()
    const baseGeom = {x: 10+Math.random()*20, y: 15+Math.random()*20, w: type==='table'? 55 : type==='chart'? 45 : type==='shape'? 28 : 48, h: type==='table'? 28 : type==='chart'? 32 : type==='shape'? 18 : 14, z: (cur?.content.blocks.length||0)+1, unit:'%'}
    let block:Block={id:nid, type} as any
    if(type==='text') block={id:nid, type, content:'Новый текст — выдели чтобы форматировать', style:{fontSize:18, color:'#1e293b', align:'left', fontFamily:'Inter', lineHeight:1.4, ...baseGeom}}
    if(type==='image') block={id:nid, type, src: extra.src||'https://picsum.photos/800/400', style:{borderRadius:8, shadow:false, ...baseGeom, w: (baseGeom as any).w||35, h: (baseGeom as any).h||30}}
    if(type==='shape') block={id:nid, type, shape: extra.shape||'rect', style:{fill:'#3B82F6', stroke:'#1e40af', strokeWidth:2, opacity:1, ...baseGeom}}
    if(type==='table') block={id:nid, type, table:{rows:3, cols:3, cells: Array.from({length:3},()=>Array.from({length:3},()=>({text:'',style:{}})))}, style:{...baseGeom}}
    if(type==='chart') block={id:nid, type, content:'chart', style:{chartType: extra.chartType||'bar', ...baseGeom}, chartData:{labels:['A','B','C','D','E'], values:[40,70,50,80,60]} as any}
    if(type==='video') block={id:nid, type, src:'https://www.youtube.com/embed/dQw4w9WgXcQ', style:{...baseGeom}}
    if(type==='icon') block={id:nid, type, content: extra.icon||'⭐', style:{fontSize:32, ...baseGeom}}
    setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:[...s.content.blocks, block]}}))
    setSelectedBlock(nid)
  }

  const updateSelected=(patch:any)=>{
    if(!selectedBlock) return
    pushHistory()
    setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:s.content.blocks.map(b=>b.id===selectedBlock? {...b, ...patch, style:{...b.style, ...patch.style}}: b)}}))
  }
  const updateSelectedStyle=(patch:any)=>{
    if(!selectedBlock) return
    setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:s.content.blocks.map(b=>b.id===selectedBlock? {...b, style:{...b.style, ...patch}}: b)}}))
  }
  const deleteSelected=()=>{
    if(!selectedBlock) return
    pushHistory()
    setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:s.content.blocks.filter(b=>b.id!==selectedBlock)}}))
    setSelectedBlock(null)
  }

  const handleImageUpload=(e:any)=>{
    const file=e.target.files?.[0]
    if(!file) return
    if(file.size>8*1024*1024){ alert('Макс 8MB'); return }
    const reader=new FileReader()
    reader.onload=()=>{
      pushHistory()
      const nid='b'+Date.now()
      const block:Block={id:nid, type:'image', src: reader.result as string, style:{borderRadius:8}}
      setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:[...s.content.blocks, block]}}))
      setSelectedBlock(nid)
    }
    reader.readAsDataURL(file)
  }

  const handleBgImage=(e:any)=>{
    const file=e.target.files?.[0]
    if(!file) return
    const reader=new FileReader()
    reader.onload=()=>{
      setSlides(sl=>sl.map((s,i)=>i!==active? s: {...s, backgroundType:'image', bgImage: reader.result as string}))
    }
    reader.readAsDataURL(file)
  }

  const save=async()=>{
    const token=localStorage.getItem('token')
    if(!token){ alert('Войди чтобы сохранить'); nav('/login'); return }
    if(!title.trim()){ alert('Название обязательно'); return }
    if(!subject){ alert('Выбери предмет — без него презентация не сохранится'); return }
    try{
      if(isNew){
        if(importedId){
          // публикация черновика
          await client.patch(`/presentations/${importedId}/`,{title:title.trim(),description:desc.trim(), subject: subject||null, is_public:true})
          const existing=await client.get(`/presentations/${importedId}/`).then(r=>r.data.slides||[])
          for(const s of existing) await client.delete(`/slides/${s.id}/`).catch(()=>{})
          for(let i=0;i<slides.length;i++) await client.post(`/presentations/${importedId}/slides/`,{order:i, background:slides[i].background, backgroundType:slides[i].backgroundType, gradient:slides[i].gradient, bgImage:slides[i].bgImage, content:slides[i].content, notes:slides[i].notes||'', layout:slides[i].layout, transition:slides[i].transition})
          nav(`/presentations/${importedId}`)
          alert('Презентация опубликована')
        } else {
          const r=await client.post('/presentations/',{title:title.trim(),description:desc.trim(), subject: subject||null, is_public:true})
          const pid=r.data.id
          for(let i=0;i<slides.length;i++) await client.post(`/presentations/${pid}/slides/`,{order:i, background:slides[i].background, backgroundType:slides[i].backgroundType, gradient:slides[i].gradient, bgImage:slides[i].bgImage, content:slides[i].content, notes:slides[i].notes||'', layout:slides[i].layout, transition:slides[i].transition})
          nav(`/presentations/${pid}`)
          alert('Презентация создана')
        }
      } else {
        await client.patch(`/presentations/${id}/`,{title:title.trim(),description:desc.trim(), subject: subject||null})
        const existing=await client.get(`/presentations/${id}/`).then(r=>r.data.slides||[])
        for(const s of existing) await client.delete(`/slides/${s.id}/`).catch(()=>{})
        for(let i=0;i<slides.length;i++) await client.post(`/presentations/${id}/slides/`,{order:i, background:slides[i].background, backgroundType:slides[i].backgroundType, gradient:slides[i].gradient, bgImage:slides[i].bgImage, content:slides[i].content, notes:slides[i].notes||'', layout:slides[i].layout, transition:slides[i].transition})
        alert('Сохранено')
      }
    }catch(e:any){
      alert(e.response?.data?.detail||JSON.stringify(e.response?.data)||'Ошибка сохранения')
    }
  }

  const [showIdx,setShowIdx]=useState(0)
  useEffect(()=>{ if(slideshow) setShowIdx(active) },[slideshow])

  const getSlideBgStyle=(s:Slide)=>{
    const g = (s as any).gradient || (s as any).bg_image || (s as any).bgImage
    const bg = (s as any).background
    if(g && (g.startsWith('linear-gradient')||g.startsWith('radial-gradient')) ) return {background: g} as any
    if(s.backgroundType==='gradient' && s.gradient) return {background: s.gradient} as any
    if(s.backgroundType==='image' && s.bgImage) return {backgroundImage:`url(${s.bgImage})`, backgroundSize:'cover', backgroundPosition:'center'} as any
    if(s.bgImage && s.bgImage.startsWith('data:image')) return {backgroundImage:`url(${s.bgImage})`, backgroundSize:'cover', backgroundPosition:'center'} as any
    if(bg && (bg.startsWith('linear-gradient')||bg.startsWith('radial-gradient')||bg.startsWith('url('))) return {background: bg} as any
    return {background: bg||'#ffffff'} as any
  }

  const isAbsolute = cur && (cur.content.blocks||[]).some((b:any)=> b.style && b.style.x!==undefined)
  const getTransitionClass=(t:string)=>{ const m:any={fade:'animate-enter', slide:'animate-slide', zoom:'animate-zoom', wipe:'animate-wipe', split:'animate-split', random:'animate-random', 'нет':''}; return m[t]||'' }
  const getAnimationClass=(a:string)=>{ const m:any={fadeIn:'animate-fadeIn', slideIn:'animate-slideIn', zoomIn:'animate-zoomIn', bounce:'animate-bounce', flip:'animate-flip', float:'animate-float', 'нет':''}; return m[a]||'' }
  // aspect слайда из реальных размеров (EMU): 4:3 слайды больше не тянутся на 16:9 канвас
  const slideAspectStyle=(s:any)=>{ const w=s?.width, h=s?.height; if(w&&h&&w>0&&h>0) return {aspectRatio:`${w} / ${h}`} as any; return {aspectRatio:'16 / 9'} as any }
  // lineHeight из оригинала (PowerPoint single ≈ 1.0–1.2), иначе многострочный текст разъезжается
  const textLineHeight=(st:any)=> st.lineHeight&&st.lineHeight>=0.5&&st.lineHeight<=3 ? st.lineHeight : 1.25
  // шрифт из оригинала + системные фолбэки (MiSans и др. обычно не стоят в системе)
  const fontStack=(f?:string)=> f ? `'${f}', 'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', 'Noto Sans SC', sans-serif` : undefined

  if(showPreview){
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
        <div className="h-12 bg-slate-800 flex items-center justify-between px-4 text-white">
          <span className="font-bold">{title} — предпросмотр • {slides.length} слайдов</span>
          <button onClick={()=>setShowPreview(false)} className="px-4 py-1.5 rounded-lg bg-white text-slate-900 font-semibold">✕ Закрыть</button>
        </div>
        <div className="flex-1 overflow-auto p-8 bg-slate-800 flex flex-col items-center gap-6">
          {slides.map((s,i)=>{
            const hasG = (s.content.blocks||[]).some((b:any)=>b.style?.x!==undefined)
            return (
              <div key={`${i}-${s.transition}`} className={`w-[900px] max-w-[90vw] aspect-video shrink-0 rounded-xl border-4 border-white shadow-2xl overflow-hidden relative ${getTransitionClass(s.transition||'нет')} ${slideDotsCls((s as any).background)} ${hasG?'':'p-10 flex flex-col gap-4'}`} style={{...getSlideBgStyle(s), ...slideAspectStyle(s)}}>
                {hasG ? (
                  <div className="absolute inset-0">
                    {s.content.blocks.map((b:any)=>{
                      const st=b.style||{}
                      const anim = getAnimationClass(b.animation||'нет')
                      if(b.type==='text'){
                        return <div key={b.id} className={anim} style={{position:'absolute', left: st.x!=null?`${st.x}%`:'0%', top: st.y!=null?`${st.y}%`:'0%', width: st.w!=null?`${st.w}%`:'90%', height: st.h!=null?`${st.h}%`:'auto', zIndex: st.z||0, transform: st.rotation?`rotate(${st.rotation}deg)`:undefined, overflow:'visible', display:'block', padding: st.background?'4px 6px':'1px 7px', background: st.background||'transparent', border: st.stroke?`${st.strokeWidth||1}px ${st.dash||'solid'} ${st.stroke}`:undefined}}><div style={anchoredInner(st)}><div style={{fontSize:st.fontSize||16, fontFamily:fontStack(st.fontFamily), lineHeight:textLineHeight(st), color:st.color||'#1e293b', textAlign:st.align||'left'}}>{b.paragraphs? b.paragraphs.map((p:any,pi:number)=><div key={pi} style={{textAlign:p.align||st.align||'left', marginBottom:'0.2em', lineHeight:p.lineHeight||textLineHeight(st)}}>{p.runs? p.runs.map((r:any,ri:number)=><span key={ri} style={{fontFamily:fontStack(r.style?.fontFamily), fontSize:r.style?.fontSize, fontWeight:r.style?.bold?'700':undefined, fontStyle:r.style?.italic?'italic':undefined, textDecoration:r.style?.underline?'underline':undefined, color:r.style?.color, background:r.style?.highlight?'#fef08a':undefined, textShadow:r.style?.textShadow||undefined}}>{r.text}</span>): p.text}</div>): b.content}</div></div></div>
                      }
                       if(b.type==='image') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||30}%`, height:`${st.h||30}%`, zIndex:st.z||0, transform: st.rotation?`rotate(${st.rotation}deg)`:undefined}}>{b.unrenderable ? <div className="w-full h-full rounded flex flex-col items-center justify-center bg-slate-100 border border-dashed border-slate-300 text-slate-500 text-xs p-1 text-center">{b.brokenLink ? '🖼 Картинка повреждена в исходном файле' : <>🖼 Картинка .{b.origExt||'emf'} не поддерживается браузером</>}</div> : <img onError={imgMissing} src={resolveSrc(b.src)} style={{width:'100%', height:'100%', objectFit: st.objectFit||'contain'}} alt=""/>}</div>
                      if(b.type==='shape' && st.svgPath) return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||20}%`, height:`${st.h||15}%`, zIndex:st.z||0}}><svg viewBox={`0 0 ${st.svgW||10000} ${st.svgH||10000}`} preserveAspectRatio={st.icon?"xMidYMid meet":"none"} style={{width:'100%', height:'100%', display:'block'}}><path d={st.svgPath} fill={st.fill && st.fill!=='transparent' ? st.fill : 'none'} stroke={st.stroke||'none'} strokeWidth={st.strokeWidth||0} strokeDasharray={st.dash==='dotted'?'2 3':st.dash==='dashed'?'7 4':undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/></svg></div>
                      if(b.type==='shape') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||20}%`, height:`${st.h||15}%`, zIndex:st.z||0, transform: st.rotation?`rotate(${st.rotation}deg)`:undefined, background: st.fill||'#3B82F6', border: st.stroke?`${st.strokeWidth||1}px ${st.dash||'solid'} ${st.stroke}`:undefined, borderRadius: st.shape==='circle'||st.shape==='ellipse'?'50%':(st.radiusPct!=null?(st.radiusPct<=0?0:'12px'):6)}}></div>
                      if(b.type==='table') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||40}%`, height:`${st.h||25}%`, zIndex:st.z||0}}><div className={`grid gap-px w-full h-full ${((b.table?.cells||[]).some((row:any)=>row.some((c:any)=>c?.style?.background)))?'bg-slate-200':'bg-transparent'}`} style={{gridTemplateColumns:`repeat(${b.table?.cols||3},1fr)`}}>{(b.table?.cells||[]).flatMap((row:any)=>row.filter((c:any)=>!c?.merged).map((c:any,k:number)=><div key={k} className="p-1 text-xs flex items-center justify-center overflow-hidden" style={{gridColumn:`span ${c?.colspan||1}`, gridRow:`span ${c?.rowspan||1}`}}>{c?.text||'—'}</div>))}</div></div>
                      if(b.type==='chart') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||40}%`, height:`${st.h||30}%`, zIndex:st.z||0}}><div className="w-full h-full bg-white rounded-lg border flex flex-col items-center justify-center p-1"><BarChart3 size={14}/><span className="text-xs">{b.style?.chartType||'bar'}</span></div></div>
                      return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||30}%`, zIndex:st.z||0}}>{b.content}</div>
                    })}
                  </div>
                ) : (
                  s.content.blocks.map((b:any)=>(
                    <div key={b.id} className={getAnimationClass(b.animation||'нет')}>
                      {b.type==='text' && <div style={{fontSize:b.style?.fontSize||20, fontWeight:b.style?.bold?'700':'400', textAlign:b.style?.align||'left', color:b.style?.color||'#1e293b'}}>{b.style?.bullet? '• '+b.content : b.content}</div>}
                      {b.type==='image' && (b.unrenderable ? <div className="rounded-lg bg-slate-100 border border-dashed border-slate-300 text-slate-500 text-xs p-2 text-center">{b.brokenLink ? '🖼 Картинка повреждена в исходном файле' : <>🖼 Картинка .{b.origExt||'emf'} не поддерживается браузером</>}</div> : <img onError={imgMissing} src={resolveSrc(b.src)} className="rounded-lg max-h-[300px] w-full object-contain" alt=""/>)}
                      {b.type==='shape' && <div className="h-12 rounded-lg border-2 flex items-center justify-center" style={{background:b.style?.fill||'#3B82F6', borderRadius: b.shape==='circle'?'50%':6}}></div>}
                      {b.type==='table' && <div className="border rounded-lg overflow-hidden"><div className="grid gap-px bg-slate-300" style={{gridTemplateColumns:`repeat(${b.table?.cols||3},1fr)`}}>{(b.table?.cells||[]).flatMap((row:any)=>row.filter((c:any)=>!c?.merged).map((c:any,k:number)=><div key={k} className="bg-white p-2 text-xs flex items-center justify-center" style={{gridColumn:`span ${c?.colspan||1}`, gridRow:`span ${c?.rowspan||1}`}}>{c?.text||'—'}</div>))}</div></div>}
                      {b.type==='chart' && <div className="h-20 bg-white rounded-lg border flex flex-col items-center justify-center"><BarChart3 size={16}/><span className="text-xs">{b.style?.chartType||'bar'}</span></div>}
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if(slideshow){
    const s=slides[showIdx]
    const hasGShow = (s.content.blocks||[]).some((b:any)=>b.style?.x!==undefined)
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div key={`${showIdx}-${s.transition}`} className={`w-[960px] max-w-[95vw] aspect-video shrink-0 rounded-xl overflow-hidden shadow-2xl relative ${getTransitionClass(s.transition||'нет')} ${slideDotsCls((s as any).background)} ${hasGShow?'':'bg-white p-12 flex flex-col gap-4 overflow-auto'}`} style={{...getSlideBgStyle(s), ...slideAspectStyle(s)}}>
            {hasGShow ? (
              <div className="absolute inset-0">
                {s.content.blocks.map((b:any)=>{
                  const st=b.style||{}
                  const anim=getAnimationClass(b.animation||'нет')
                  if(b.type==='text'){
                    return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||80}%`, height: st.h!=null?`${st.h}%`:'auto', zIndex:st.z||0, transform: st.rotation?`rotate(${st.rotation}deg)`:undefined, display:'block', overflow:'visible', padding: st.background?'4px 6px':'1px 7px', background: st.background||'transparent', border: st.stroke?`${st.strokeWidth||1}px ${st.dash||'solid'} ${st.stroke}`:undefined}}><div style={anchoredInner(st)}><div style={{fontSize:(st.fontSize||20)*1.08, fontFamily:fontStack(st.fontFamily), lineHeight:textLineHeight(st), color:st.color||'#1e293b', textAlign:st.align||'left'}}>{b.paragraphs? b.paragraphs.map((p:any,pi:number)=><div key={pi} style={{textAlign:p.align||st.align||'left', lineHeight:p.lineHeight||textLineHeight(st)}}>{p.runs? p.runs.map((r:any,ri:number)=><span key={ri} style={{fontFamily:fontStack(r.style?.fontFamily), fontSize:r.style?.fontSize, fontWeight:r.style?.bold?'700':undefined, fontStyle:r.style?.italic?'italic':undefined, textDecoration:r.style?.underline?'underline':undefined, color:r.style?.color, background:r.style?.highlight?'#fef08a':undefined, textShadow:r.style?.textShadow||undefined}}>{r.text}</span>): p.text}</div>): b.content}</div></div></div>
                  }
                  if(b.type==='image') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||30}%`, height:`${st.h||30}%`, zIndex:st.z||0, transform: st.rotation?`rotate(${st.rotation}deg)`:undefined}}>{b.unrenderable ? <div className="w-full h-full rounded flex flex-col items-center justify-center bg-white/10 border border-dashed border-white/40 text-white/80 text-xs p-1 text-center">{b.brokenLink ? '🖼 Картинка повреждена в исходном файле' : <>🖼 Картинка .{b.origExt||'emf'} не поддерживается браузером</>}</div> : <img onError={imgMissing} src={resolveSrc(b.src)} style={{width:'100%', height:'100%', objectFit: st.objectFit||'contain'}} alt=""/>}</div>
                  if(b.type==='shape' && st.svgPath) return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||20}%`, height:`${st.h||15}%`, zIndex:st.z||0}}><svg viewBox={`0 0 ${st.svgW||10000} ${st.svgH||10000}`} preserveAspectRatio={st.icon?"xMidYMid meet":"none"} style={{width:'100%', height:'100%', display:'block'}}><path d={st.svgPath} fill={st.fill && st.fill!=='transparent' ? st.fill : 'none'} stroke={st.stroke||'none'} strokeWidth={st.strokeWidth||0} strokeDasharray={st.dash==='dotted'?'2 3':st.dash==='dashed'?'7 4':undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/></svg></div>
                  if(b.type==='shape') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||20}%`, height:`${st.h||15}%`, zIndex:st.z||0, transform: st.rotation?`rotate(${st.rotation}deg)`:undefined, background: st.fill||'#3B82F6', border: st.stroke?`${st.strokeWidth||1}px ${st.dash||'solid'} ${st.stroke}`:undefined, borderRadius: b.shape==='circle'||b.shape==='ellipse'?'50%':(st.radiusPct!=null?(st.radiusPct<=0?0:'12px'):6)}}></div>
                  if(b.type==='table') return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, width:`${st.w||40}%`, height:`${st.h||25}%`, zIndex:st.z||0}}><div className={`grid gap-px w-full h-full ${((b.table?.cells||[]).some((row:any)=>row.some((c:any)=>c?.style?.background)))?'bg-slate-200':'bg-transparent'}`} style={{gridTemplateColumns:`repeat(${b.table?.cols||3},1fr)`}}>{(b.table?.cells||[]).flatMap((row:any)=>row.filter((c:any)=>!c?.merged).map((c:any,k:number)=><div key={k} className="p-1 text-xs flex items-center justify-center overflow-hidden" style={{gridColumn:`span ${c?.colspan||1}`, gridRow:`span ${c?.rowspan||1}`}}>{c?.text||'—'}</div>))}</div></div>
                  return <div key={b.id} className={anim} style={{position:'absolute', left:`${st.x||0}%`, top:`${st.y||0}%`, zIndex:st.z||0}}>{b.content}</div>
                })}
              </div>
            ) : (
              s.content.blocks.map((b:any)=>(
                <div key={b.id} className={getAnimationClass(b.animation||'нет')}>
                  {b.type==='text' && <div style={{fontSize:(b.style?.fontSize||24)*1.1, color:b.style?.color||'#0f172a', textAlign:b.style?.align||'left'}}>{b.content}</div>}
                  {b.type==='image' && <img onError={imgMissing} src={resolveSrc(b.src)} className="max-h-[400px] w-full object-contain rounded-xl" alt=""/>}
                  {b.type==='shape' && <div className="h-12 rounded-lg border-2 flex items-center justify-center" style={{background:b.style?.fill||'#3B82F6', borderRadius: b.shape==='circle'?'50%':6}}></div>}
                  {b.type==='table' && <div className="border rounded-lg overflow-hidden"><div className="grid gap-px bg-slate-200" style={{gridTemplateColumns:`repeat(${b.table?.cols||3},1fr)`}}>{Array.from({length:(b.table?.rows||3)*(b.table?.cols||3)}).map((_,k)=><div key={k} className="bg-white p-2 text-xs flex items-center justify-center">{b.table?.cells?.[Math.floor(k/(b.table?.cols||3))]?.[k%(b.table?.cols||3)]?.text||'—'}</div>)}</div></div>}
                  {b.type==='chart' && <div className="h-20 bg-white rounded-lg border flex flex-col items-center justify-center"><BarChart3 size={16}/><span className="text-xs">{b.style?.chartType||'bar'}</span></div>}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="h-14 bg-white/10 backdrop-blur flex items-center justify-center gap-3 text-white">
          <button onClick={()=>setShowIdx(i=>Math.max(0,i-1))} className="px-4 py-2 rounded-lg bg-white text-slate-900">‹ Назад</button>
          <span>{showIdx+1} / {slides.length} {s.transition && s.transition!=='нет' && `• ${s.transition}`}</span>
          <button onClick={()=>setShowIdx(i=>Math.min(slides.length-1,i+1))} className="px-4 py-2 rounded-lg bg-white text-slate-900">Вперед ›</button>
          <button onClick={()=>setSlideshow(false)} className="ml-6 px-4 py-2 rounded-lg bg-red-600">Выйти Esc</button>
        </div>
      </div>
    )
  }

  const handlePptxImport=async(e:any)=>{
    const file=e.target.files?.[0]
    if(!file) return
    if(file.size>100*1024*1024){ alert('Файл >100MB'); return}
    const ext='.'+file.name.split('.').pop()?.toLowerCase()
    if(!['.pptx','.ppt','.pdf'].includes(ext)){ alert('Только .pptx/.ppt/.pdf'); return}
    setImporting(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      fd.append('title', file.name.replace(/\.[^/.]+$/,''))
      if(subject) fd.append('subject', String(subject))
      // черновик только владельцу — не попадает в общую ленту
      fd.append('is_public','false')
      if(isNew){
        const r=await client.post('/presentations/import/', fd, {headers:{'Content-Type':'multipart/form-data'}})
        const imported = (r.data.slides||[]).sort((a:any,b:any)=>a.order-b.order).map((s:any,idx:number)=>({
          id: s.id, order: idx, background: s.background||'#ffffff', backgroundType: s.backgroundType||s.background_type||'solid', gradient: s.gradient, bgImage: s.bgImage||s.bg_image, layout: s.layout||'blank', transition: s.transition||'fade', width: s.width, height: s.height, content: s.content, notes: s.notes||''
        }))
        if(imported.length){
          setSlides(imported)
          setTitle(r.data.title)
          setDesc(r.data.description||'')
        }
        setImportedId(r.data.id)
        alert(`Импортировано ${imported.length} слайдов из ${file.name} — сохранено как черновик (видно только вам). Нажмите Сохранить чтобы опубликовать.`)
      } else {
        const r=await client.post('/presentations/import/', fd, {headers:{'Content-Type':'multipart/form-data'}})
        const imported = (r.data.slides||[]).sort((a:any,b:any)=>a.order-b.order)
        for(const s of imported){
          await client.post(`/presentations/${id}/slides/`, {order: slides.length, background: s.background, content: s.content, notes: s.notes||''})
        }
        const fresh=await client.get(`/presentations/${id}/`)
        const s=fresh.data.slides.sort((a:any,b:any)=>a.order-b.order).map((x:any,idx:number)=>({id:x.id, order:idx, background:x.background||'#ffffff', content:x.content, notes:x.notes||''}))
        setSlides(s)
        alert(`Добавлено ${imported.length} слайдов из ${file.name}`)
        try{ await client.delete(`/presentations/${r.data.id}/`)}catch{}
      }
    }catch(err:any){
      alert(err?.response?.data?.detail||'Ошибка импорта')
    }finally{
      setImporting(false)
      if(pptxInputRef.current) pptxInputRef.current.value=''
    }
  }

  return (
    <div ref={fullscreenRef} className={`${isEditFullscreen ? 'fixed inset-0 z-50 bg-[#e9e9e9] flex flex-col' : 'flex flex-col h-[calc(100vh-64px)] -m-4 lg:-m-8'}`}>
      <h1 className="sr-only">Редактор презентаций</h1>
      <div className="h-14 bg-[#f3f3f3] border-b flex items-center gap-2 px-3 overflow-hidden">
        <div className="w-8 h-8 rounded bg-[#d24726] flex items-center justify-center text-white font-bold text-sm shrink-0">P</div>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="flex-1 min-w-[140px] max-w-[280px] px-3 py-1.5 rounded border bg-white font-semibold text-sm truncate" title={title}/>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Описание" className="hidden xl:block flex-1 min-w-[160px] max-w-[260px] px-3 py-1.5 rounded border bg-white text-sm truncate" title={desc}/>
        <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap shrink-0">{slides.length} слайдов</span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button onClick={()=>pptxInputRef.current?.click()} disabled={importing} className="px-2.5 py-1.5 rounded-lg bg-white border border-orange-200 text-orange-700 flex items-center gap-1 text-xs font-medium hover:bg-orange-50 whitespace-nowrap" title="Загрузить готовый .pptx/.pdf как слайды">{importing ? '⏳' : '⬆'}<span className="hidden lg:inline">Импорт</span></button>
          <input ref={pptxInputRef} type="file" accept=".pptx,.ppt,.pdf" className="hidden" onChange={handlePptxImport}/>
          <button onClick={undo} disabled={!history.length} className="p-2 rounded-lg bg-white border disabled:opacity-30 shrink-0"><RotateCw size={14}/></button>
          <button onClick={()=>setShowPreview(true)} className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white border items-center gap-1.5 text-sm whitespace-nowrap"><Eye size={14}/> <span className="hidden lg:inline">Предпросмотр</span></button>
          <button onClick={()=>setSlideshow(true)} className="hidden sm:flex px-3 py-1.5 rounded-lg bg-slate-900 text-white items-center gap-1.5 text-sm whitespace-nowrap"><Play size={14}/> <span className="hidden lg:inline">Слайд-шоу</span></button>
          <button onClick={toggleEditFullscreen} className="hidden sm:flex px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 items-center gap-1.5 text-sm whitespace-nowrap" title="Полный экран редактирования (F)"><Maximize2 size={14}/> <span className="hidden lg:inline">{isEditFullscreen?'Выйти':'На весь'}</span></button>
          <button onClick={handleCancel} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold flex items-center gap-1.5 text-sm whitespace-nowrap hover:bg-slate-50">Отмена</button>
          <button onClick={save} className="px-3 py-1.5 rounded-lg bg-[#d24726] text-white font-semibold flex items-center gap-1.5 text-sm whitespace-nowrap"><Save size={14}/> <span className="hidden sm:inline">Сохранить</span></button>
        </div>
      </div>
      <div className="px-3 py-2 bg-white border-b flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium flex items-center gap-1"><BookOpen size={14}/> Предмет:</span>
        <select value={subject||''} onChange={e=>setSubject(e.target.value?Number(e.target.value):null)} className="px-3 py-1.5 rounded-lg border bg-slate-50 text-sm min-w-[180px]">
          <option value="">Без предмета</option>
          {subjects.map((s:any)=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
        {subject ? (
          <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">Выбран: {subjects.find((x:any)=>String(x.id)===String(subject))?.icon} {subjects.find((x:any)=>String(x.id)===String(subject))?.name}</span>
        ) : (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">Выбери предмет — презентация будет видна в уроке по этому предмету</span>
        )}
      </div>

      <div className="bg-white border-b">
        <div className="flex gap-1 px-2 py-1 border-b overflow-auto">
          {(['home','insert','design','transitions','animations'] as const).map(t=>(
            <button key={t} onClick={()=>setRibbonTab(t)} className={`px-4 py-1.5 rounded text-sm font-medium capitalize whitespace-nowrap ${ribbonTab===t?'bg-slate-900 text-white':'hover:bg-slate-100'}`}>{t==='home'?'Главная':t==='insert'?'Вставка':t==='design'?'Дизайн':t==='transitions'?'Переходы':'Анимации'}</button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <ZoomOut size={14}/> <input type="range" min={60} max={140} value={zoom} onChange={e=>setZoom(parseInt(e.target.value))} className="w-20"/> <ZoomIn size={14}/> {zoom}%
          </div>
        </div>
        <div className="px-3 py-2 flex flex-wrap items-center gap-2 min-h-[56px]">
          {ribbonTab==='home' && (
            <>
              <div className="flex items-center gap-1 pr-3 border-r">
                <select value={curSelected?.style?.fontFamily||'Inter'} onChange={e=>selectedBlock && updateSelectedStyle({fontFamily:e.target.value})} className="px-2 py-1.5 rounded border bg-white text-xs w-[110px]">
                  {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
                <button onClick={()=>selectedBlock && updateSelectedStyle({bold:!curSelected?.style?.bold})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.bold?'bg-slate-900 text-white':''}`}><Bold size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({italic:!curSelected?.style?.italic})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.italic?'bg-slate-900 text-white':''}`}><Italic size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({underline:!curSelected?.style?.underline})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.underline?'bg-slate-900 text-white':''}`}><Underline size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({highlight:!curSelected?.style?.highlight})} className={`p-1.5 rounded hover:bg-amber-100 ${curSelected?.style?.highlight?'bg-amber-400':''}`}><Highlighter size={16}/></button>
              </div>
              <div className="flex items-center gap-1 pr-3 border-r">
                <button onClick={()=>selectedBlock && updateSelectedStyle({align:'left'})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.align==='left'?'bg-slate-200':''}`}><AlignLeft size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({align:'center'})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.align==='center'?'bg-slate-200':''}`}><AlignCenter size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({align:'right'})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.align==='right'?'bg-slate-200':''}`}><AlignRight size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({bullet:!curSelected?.style?.bullet})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.bullet?'bg-blue-200':''}`}><List size={16}/></button>
                <button onClick={()=>selectedBlock && updateSelectedStyle({numbered:!curSelected?.style?.numbered})} className={`p-1.5 rounded hover:bg-slate-100 ${curSelected?.style?.numbered?'bg-blue-200':''}`}><ListOrdered size={16}/></button>
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={curSelected?.style?.color||'#1e293b'} onChange={e=>selectedBlock && updateSelectedStyle({color:e.target.value})} className="w-8 h-8 rounded border" title="Цвет текста"/>
                <input type="color" value={curSelected?.style?.highlight? '#fef08a' : '#ffffff'} onChange={e=>selectedBlock && updateSelectedStyle({highlight:true, highlightColor:e.target.value})} className="w-8 h-8 rounded border" title="Маркер"/>
                <select value={curSelected?.style?.fontSize||18} onChange={e=>selectedBlock && updateSelectedStyle({fontSize: parseInt(e.target.value)})} className="px-2 py-1.5 rounded border bg-white text-sm">
                  {[10,12,14,16,18,20,24,28,32,36,44,54].map(s=><option key={s} value={s}>{s}pt</option>)}
                </select>
              </div>
            </>
          )}
          {ribbonTab==='insert' && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={()=>addBlock('text')} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white flex items-center gap-1.5 text-sm"><Type size={14}/> Текст</button>
              <button onClick={()=>fileInputRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-white border flex items-center gap-1.5 text-sm"><ImgIcon size={14}/> Картинка</button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
              <div className="flex gap-1 p-1 rounded-lg bg-slate-100">
                {SHAPES.slice(0,8).map(s=>(
                  <button key={s.k} onClick={()=>addBlock('shape',{shape:s.k})} className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300" title={s.label}><s.icon size={16}/></button>
                ))}
                <div className="w-px bg-slate-300 mx-1"/>
                {SHAPES.slice(8).map(s=>(
                  <button key={s.k} onClick={()=>addBlock('shape',{shape:s.k})} className="p-1.5 rounded hover:bg-white border border-transparent hover:border-slate-300" title={s.label}><s.icon size={16}/></button>
                ))}
              </div>
              <button onClick={()=>addBlock('table')} className="px-3 py-1.5 rounded-lg bg-white border flex items-center gap-1.5 text-sm"><Table size={14}/> Таблица</button>
              <button onClick={()=>addBlock('chart')} className="px-3 py-1.5 rounded-lg bg-white border flex items-center gap-1.5 text-sm"><BarChart3 size={14}/> Диаграмма</button>
            </div>
          )}
          {ribbonTab==='design' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Фон:</span>
              {['#ffffff','#f8fafc','#fef3c7','#dbeafe','#fde68a','#fecaca','#dcfce7','#e0e7ff','#ddd6fe','#fce7f3'].map(c=>(
                <button key={c} onClick={()=>setSlides(sl=>sl.map((s,i)=>i===active?{...s,background:c, backgroundType:'solid'}:s))} className={`w-7 h-7 rounded-full border-2 ${cur.background===c && cur.backgroundType==='solid'?'border-blue-600':'border-white shadow'}`} style={{background:c}}/>
              ))}
              <button onClick={()=>setSlides(sl=>sl.map((s,i)=>i===active?{...s, backgroundType:'gradient', gradient:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)'}:s))} className="px-2 py-1 rounded bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs">Градиент</button>
              <label className="px-2 py-1 rounded bg-white border text-xs cursor-pointer">Картинка <input ref={bgImageRef} type="file" accept="image/*" className="hidden" onChange={handleBgImage}/></label>
              <input type="color" value={cur.background.startsWith('#')? cur.background:'#ffffff'} onChange={e=>setSlides(sl=>sl.map((s,i)=>i===active?{...s,background:e.target.value, backgroundType:'solid'}:s))} className="w-8 h-8 rounded-full border"/>
            </div>
          )}
          {ribbonTab==='transitions' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Переход слайда:</span>
              {TRANSITIONS.map(t=>(
                <button key={t} onClick={()=>setSlides(sl=>sl.map((s,i)=>i===active?{...s,transition:t}:s))} className={`px-3 py-1.5 rounded-lg border text-sm capitalize ${cur.transition===t?'bg-blue-600 text-white border-blue-600':'bg-white hover:bg-slate-50'}`}>{t}</button>
              ))}
            </div>
          )}
          {ribbonTab==='animations' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Анимация блока:</span>
              {ANIMATIONS.map(a=>(
                <button key={a} onClick={()=>selectedBlock && updateSelected({animation:a})} className={`px-3 py-1.5 rounded-lg border text-sm capitalize ${curSelected?.animation===a?'bg-blue-600 text-white':'bg-white'}`}>{a}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 bg-[#e9e9e9]">
        <div className="w-[200px] bg-[#f5f5f5] border-r p-2 flex flex-col gap-2 overflow-auto">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold tracking-widest text-slate-500">СЛАЙДЫ {slides.length}</span>
            <button onClick={()=>addSlide('blank')} className="p-1 rounded bg-white border"><Plus size={14}/></button>
          </div>
          <div className="grid gap-2">
            {slides.map((s,i)=>{
              const hasG = (s.content.blocks||[]).some((b:any)=>b.style?.x!==undefined)
              const sBg = (s as any).background||'#ffffff'
              const isDark = isDarkColor(sBg)
              return (
                <div key={i} onClick={()=>{setActive(i); setSelectedBlock(null)}} className={`text-left rounded-lg border-2 overflow-hidden bg-white relative cursor-pointer group ${i===active?'border-[#d24726] shadow':'border-slate-200 hover:border-slate-300'}`}>
                  <div className="aspect-video shrink-0 overflow-hidden relative" style={{...getSlideBgStyle(s), ...slideAspectStyle(s)}}>
                    {hasG ? (
                      <div className="absolute inset-0 scale-[0.22] origin-top-left w-[454%] h-[454%]">
                        {s.content.blocks.slice(0,6).map((b:any)=>(
                          <div key={b.id} style={{position:'absolute', left:b.style?.x!=null?`${b.style.x}%`:'2%', top:b.style?.y!=null?`${b.style.y}%`:'2%', width:b.style?.w!=null?`${b.style.w}%`:'96%', fontSize:'5px', lineHeight:1.2, color:b.style?.color|| (isDark?'#fff':'#1e293b'), overflow:'hidden'}} className="truncate">
                            {b.type==='text'? (b.content?.slice(0,36)||'') : b.type==='image'? '🖼' : '⬜'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-1.5 flex flex-col gap-0.5 overflow-hidden h-full">
                        {s.content.blocks.slice(0,3).map((b:any,bi:number)=>(
                          <div key={bi} className="truncate text-[9px] leading-tight" style={{fontWeight:b.style?.bold?'700':'400', color:b.style?.color|| (isDark?'#fff':'#1e293b')}}>
                            {b.type==='text' ? b.content?.slice(0,32) : b.type==='image' ? '🖼' : '⬜'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1 flex items-center justify-between bg-slate-50 border-t">
                    <span className="text-[11px] font-medium">{i+1} {s.transition!=='нет' && s.transition ? `• ${s.transition}` : ''}</span>
                    <span className="text-[10px] text-slate-500">{s.layout}</span>
                  </div>
                  <button onClick={(e)=>{e.stopPropagation(); if(slides.length<=1){ alert('Должен остаться хотя бы один слайд'); return; } if(!confirm(`Удалить слайд ${i+1}?`)) return; pushHistory(); setSlides(s=>s.filter((_,idx)=>idx!==i)); setActive(prev=> i<=prev ? Math.max(0, prev-1) : prev); if(active===i) setSelectedBlock(null)}} disabled={slides.length<=1} title={slides.length<=1? 'Минимум один слайд':'Удалить слайд'} className={`absolute top-1 right-1 w-6 h-6 rounded-full bg-white border shadow flex items-center justify-center ${slides.length<=1? 'opacity-30 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600'} transition-opacity`}><Trash2 size={12}/></button>
                </div>
              )
            })}
          </div>
          <div className="flex gap-1 mt-2">
            <button onClick={()=>addSlide('blank')} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 text-sm"><Plus size={14}/> Новый слайд</button>
            <button onClick={deleteSlide} disabled={slides.length<=1} title={slides.length<=1? 'Минимум один слайд':'Удалить текущий слайд'} className={`px-3 py-2 rounded-xl border font-bold flex items-center justify-center gap-1 text-sm ${slides.length<=1? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}><Trash2 size={14}/></button>
          </div>
        </div>

        <div className="flex-1 p-4 lg:p-6 flex flex-col items-center overflow-auto bg-[#e9e9e9]">
          <div className="flex items-center gap-2 mb-3 text-xs text-slate-600">
            <Layers size={14}/> Слайд {active+1} из {slides.length} • {cur.layout} • {cur.transition} • <span className="px-2 py-0.5 rounded bg-white border">{zoom}%</span>
            <button onClick={()=>setZoom(z=>Math.max(60,z-10))} className="p-1 rounded bg-white border"><ZoomOut size={12}/></button>
            <button onClick={()=>setZoom(z=>Math.min(140,z+10))} className="p-1 rounded bg-white border"><ZoomIn size={12}/></button>
            <button onClick={undo} className="ml-2 p-1 rounded bg-white border text-xs flex items-center gap-1"><RotateCw size={12}/> Отменить</button>
            <button onClick={()=>setShowGrid(v=>!v)} className={`ml-2 p-1 rounded border text-xs flex items-center gap-1 ${showGrid?'bg-blue-600 text-white border-blue-600':'bg-white'}`}>{showGrid?'⊞ Сетка вкл':'⊞ Сетка'}</button>
          </div>

          {isAbsolute ? (
            <div ref={canvasRef} className="w-full max-w-[960px] aspect-video shrink-0 rounded-lg shadow-xl border overflow-hidden relative flex flex-col" style={{...getSlideBgStyle(cur), ...slideAspectStyle(cur), transform:`scale(${zoom/100})`, transformOrigin:'top center'}} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
              <div className="flex-1 relative overflow-hidden" onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
                <div className="absolute inset-0" onMouseMove={handleDragMove} onMouseUp={handleDragEnd}>
                  {showGrid && <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{backgroundImage:'radial-gradient(circle, #94a3b8 1.5px, transparent 1.5px)', backgroundSize:'24px 24px'}}></div>}
                  {(() => {
                    const hasShape = cur.content.blocks.some((x:any)=>x.type==='shape')
                    const isCardBg = (cur.background||'').toUpperCase()==='#F8F9FA'
                    return cur.content.blocks.map((b:any)=>{
                    const s=b.style||{}
                    const isSelected = selectedBlock===b.id
                    const needCard = !hasShape && isCardBg && !s.background && (s.fontSize||16) < 24 && (cur.content.blocks.length||0)>12 && (s.w||0) < 60
                    const common:any = {
                      position:'absolute' as any,
                      left: s.x!=null? `${s.x}%`: '0%',
                      top: s.y!=null? `${s.y}%`: '0%',
                      width: s.w!=null? `${s.w}%`: '90%',
                      height: s.h!=null? `${s.h}%`: 'auto',
                      transform: s.rotation? `rotate(${s.rotation}deg)`: undefined,
                      zIndex: s.z||0,
                      overflow: 'hidden' as any,
                      cursor:'pointer' as any,
                    }
                    const animCls = getAnimationClass(b.animation||'нет')
                    const selCls = isSelected ? 'border-[#d24726] bg-orange-50/20 shadow-[0_0_0_2px_rgba(211,71,38,0.15)]' : 'border-transparent hover:border-white/40'
                    if(b.type==='text'){
                      return (
                        <div key={b.id} onClick={()=>setSelectedBlock(b.id)} onMouseDown={(e)=>handleDragStart(e,b.id)} style={{...common, height: s.h!=null? `${s.h}%`:'auto', overflow:'visible', display:'block', padding: needCard ? '8px 10px' : s.background?'6px 8px': '2px 7px', background: needCard ? '#ffffff' : s.background&& !['#FFE66D','#FF8C69','#FFE600'].includes(s.background) ? s.background : 'transparent', borderRadius: needCard ? '8px' : s.background?'6px':0, boxShadow: needCard ? '0 2px 10px rgba(0,0,0,0.06)' as any : undefined, border: needCard ? '1px solid #f1f5f9' as any : (s.stroke ? `${s.strokeWidth||1}px ${s.dash||'solid'} ${s.stroke}` as any : undefined), cursor:'move'}} className={`group p-1 border-2 ${selCls} rounded-lg ${animCls}`}>
                          <div style={anchoredInner(s)}><div contentEditable suppressContentEditableWarning onBlur={e=>{
                            const val=(e.target as HTMLElement).innerText
                            setSlides(sl=>sl.map((si,i)=>i!==active?si:{...si, content:{...si.content, blocks:si.content.blocks.map(x=>x.id===b.id? {...x, content:val}:x)}}))
                          }} onFocus={()=>setSelectedBlock(b.id)} className="w-full bg-transparent focus:outline-none min-h-[1em] whitespace-pre-wrap outline-none">
                            {b.paragraphs ? b.paragraphs.map((p:any,pi:number)=><div key={pi} style={{textAlign:p.align||s.align||'left', marginBottom:'0.2em', paddingLeft: p.level? '1em':0, position:'relative', fontSize: s.fontSize||16, fontFamily:fontStack(s.fontFamily), lineHeight:p.lineHeight||textLineHeight(s), color: s.color||'#1e293b'}}>{(p.level||s.bullet)&&<span style={{position:'absolute', left:0, color:'#e11d48'}}>•</span>}{p.runs? p.runs.map((r:any,ri:number)=><span key={ri} style={{fontSize:r.style?.fontSize, fontFamily:fontStack(r.style?.fontFamily), fontWeight:r.style?.bold?'700':undefined, fontStyle:r.style?.italic?'italic':undefined, textDecoration:r.style?.underline?'underline':undefined, color:r.style?.color, background:r.style?.highlight?'#fef08a':undefined, textShadow:r.style?.textShadow||undefined}}>{r.text}</span>): p.text}</div>) : <div style={{fontSize:s.fontSize||18, fontFamily:fontStack(s.fontFamily), lineHeight:textLineHeight(s), fontWeight:s.bold?'700':'400', color:s.color||'#1e293b', textAlign:s.align||'left'}}>{b.content}</div>}</div></div>
                          <button onClick={(e)=>{e.stopPropagation(); setSelectedBlock(b.id); deleteSelected()}} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 size={9}/></button>
                          {isSelected && ['nw','n','ne','e','se','s','sw','w'].map((h:any)=>(
                            <div key={h} onMouseDown={(e)=>handleResizeStart(e,b.id,h)} className="absolute w-2.5 h-2.5 bg-white border border-[#d24726] rounded-sm" style={{
                              cursor: h==='nw'||h==='se' ? 'nwse-resize' : h==='ne'||h==='sw' ? 'nesw-resize' : h==='n'||h==='s' ? 'ns-resize' : 'ew-resize',
                              left: h.includes('w') ? -5 : h.includes('e') ? '100%' : '50%',
                              top: h.includes('n') ? -5 : h.includes('s') ? '100%' : '50%',
                              transform: h==='n'||h==='s' ? 'translateX(-50%)' : h==='e'||h==='w' ? 'translateY(-50%)' : h==='nw' ? 'translate(0,0)' : h==='ne' ? 'translate(-100%,0)' : h==='sw' ? 'translate(0,-100%)' : 'translate(-100%,-100%)',
                              marginLeft: h==='e' ? -5 : h==='w' ? 0 : undefined,
                              marginTop: h==='s' ? -5 : h==='n' ? 0 : undefined,
                            }}/>
                          ))}
                        </div>
                      )
                    }
                    if(b.type==='image'){
                      return (
                        <div key={b.id} onClick={()=>setSelectedBlock(b.id)} onMouseDown={(e)=>handleDragStart(e,b.id)} style={{...common, cursor:'move'}} className={`group border-2 ${selCls} rounded-lg overflow-hidden bg-transparent ${animCls}`}>
                          {b.unrenderable ? <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 border border-dashed border-slate-300 text-slate-500 text-xs p-2 text-center">{b.brokenLink ? '🖼 Картинка повреждена в исходном файле' : <>🖼 Картинка .{b.origExt||'emf'} не поддерживается браузером</>}</div> : <img onError={imgMissing} src={resolveSrc(b.src)} style={{width:'100%', height:'100%', objectFit:(b.style?.objectFit)||'contain'}} alt=""/>}
                          <button onClick={(e)=>{e.stopPropagation(); deleteSelected()}} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 text-white hidden group-hover:flex items-center justify-center"><Trash2 size={9}/></button>
                          {isSelected && ['nw','n','ne','e','se','s','sw','w'].map((h:any)=>(
                            <div key={h} onMouseDown={(e)=>handleResizeStart(e,b.id,h)} className="absolute w-2.5 h-2.5 bg-white border border-[#d24726] rounded-sm" style={{
                              cursor: h==='nw'||h==='se' ? 'nwse-resize' : h==='ne'||h==='sw' ? 'nesw-resize' : h==='n'||h==='s' ? 'ns-resize' : 'ew-resize',
                              left: h.includes('w') ? -5 : h.includes('e') ? '100%' : '50%',
                              top: h.includes('n') ? -5 : h.includes('s') ? '100%' : '50%',
                              transform: h==='n'||h==='s' ? 'translateX(-50%)' : h==='e'||h==='w' ? 'translateY(-50%)' : h==='nw' ? 'translate(0,0)' : h==='ne' ? 'translate(-100%,0)' : h==='sw' ? 'translate(0,-100%)' : 'translate(-100%,-100%)',
                            }}/>
                          ))}
                        </div>
                      )
                    }
                    if(b.type==='shape'){
                      const shapeStyle:any={background: s.fill||'#3B82F6', borderColor: s.stroke||'#1e40af', borderWidth: s.strokeWidth||2, opacity: s.opacity||1, cursor:'move', boxShadow: s.shadow ? '0 2px 10px rgba(0,0,0,0.07)' : undefined, border: s.shadow ? '1px solid #f1f5f9' as any : undefined}
                      if(s.svgPath){ shapeStyle.background='transparent'; shapeStyle.border='none'; shapeStyle.boxShadow='none' }
                      else if(b.shape==='circle' || b.shape==='ellipse') shapeStyle.borderRadius='50%'
                      else if(b.shape==='triangle') shapeStyle.clipPath='polygon(50% 0%, 0% 100%, 100% 100%)'
                      else if(b.shape==='rightTriangle') shapeStyle.clipPath='polygon(0 0, 0 100%, 100% 100%)'
                      else if(b.shape==='diamond') shapeStyle.transform=(shapeStyle.transform? shapeStyle.transform+' ' : '')+'rotate(45deg) scale(0.7)'
                      else if(b.shape==='pentagon') shapeStyle.clipPath='polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)'
                      else if(b.shape==='hexagon') shapeStyle.clipPath='polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
                      else if(b.shape==='star') shapeStyle.clipPath='polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                      else if(b.shape==='arrow') shapeStyle.clipPath='polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)'
                      else if(b.shape==='line') { shapeStyle.height='4px'; shapeStyle.borderWidth=0; }
                      else if(b.shape==='parallelogram') shapeStyle.transform=(shapeStyle.transform? shapeStyle.transform+' ' : '')+'skew(-12deg)'
                      else if(b.shape==='trapezoid') shapeStyle.clipPath='polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'
                      else if(b.shape==='rounded') shapeStyle.borderRadius='12px'
                      return <div key={b.id} onClick={()=>setSelectedBlock(b.id)} onMouseDown={(e)=>handleDragStart(e,b.id)} style={{...common, ...shapeStyle}} className={`group flex items-center justify-center border-2 ${selCls} ${animCls}`}>
                        {s.svgPath ? (<svg viewBox={`0 0 ${s.svgW||10000} ${s.svgH||10000}`} preserveAspectRatio={s.icon?"xMidYMid meet":"none"} style={{width:'100%', height:'100%', display:'block', pointerEvents:'none'}}><path d={s.svgPath} fill={s.fill && s.fill!=='transparent' ? s.fill : 'none'} stroke={s.stroke||'none'} strokeWidth={s.strokeWidth||0} strokeDasharray={s.dash==='dotted'?'2 3':s.dash==='dashed'?'7 4':undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/></svg>) : null}
                        {isSelected && ['nw','n','ne','e','se','s','sw','w'].map((h:any)=>(
                          <div key={h} onMouseDown={(e)=>handleResizeStart(e,b.id,h)} className="absolute w-2.5 h-2.5 bg-white border border-[#d24726] rounded-sm" style={{
                            cursor: h==='nw'||h==='se' ? 'nwse-resize' : h==='ne'||h==='sw' ? 'nesw-resize' : h==='n'||h==='s' ? 'ns-resize' : 'ew-resize',
                            left: h.includes('w') ? -5 : h.includes('e') ? '100%' : '50%',
                            top: h.includes('n') ? -5 : h.includes('s') ? '100%' : '50%',
                            transform: h==='n'||h==='s' ? 'translateX(-50%)' : h==='e'||h==='w' ? 'translateY(-50%)' : h==='nw' ? 'translate(0,0)' : h==='ne' ? 'translate(-100%,0)' : h==='sw' ? 'translate(0,-100%)' : 'translate(-100%,-100%)',
                          }}/>
                        ))}
                      </div>
                    }
                    if(b.type==='table'){
                      const rows=b.table?.rows||3, cols=b.table?.cols||3, cells=b.table?.cells
                      const updateCell=(r:number,c:number,val:string)=>{
                        const newCells = (cells ? JSON.parse(JSON.stringify(cells)) : Array.from({length:rows},()=>Array.from({length:cols},()=>({text:'', style:{}})))) as any[][]
                        if(!newCells[r]) newCells[r]=[]
                        newCells[r][c]={text:val, style: newCells[r][c]?.style||{}}
                        const newRows=Math.max(rows, r+1), newCols=Math.max(cols, c+1)
                        setSlides(sl=>sl.map((s,i)=> i!==active ? s : {...s, content:{...s.content, blocks:s.content.blocks.map(bb=> bb.id===b.id ? {...bb, table:{rows:newRows, cols:newCols, cells:newCells}} : bb)}}))
                      }
                      return (
                        <div key={b.id} onClick={()=>setSelectedBlock(b.id)} onMouseDown={(e)=>handleDragStart(e,b.id)} style={{...common, borderRadius:8, overflow:'hidden', border:'1px solid #e2e8f0', cursor:'move'}} className={`group border-2 ${selCls} ${getAnimationClass(b.animation||'нет')}`}>
                          <div className={`grid gap-px w-full h-full ${((cells||[]).some((row:any)=>row.some((c:any)=>c?.style?.background)))?'bg-slate-200':'bg-transparent'}`} style={{gridTemplateColumns:`repeat(${cols},1fr)`, gridTemplateRows:`repeat(${rows},1fr)`}}>
                            {(cells||[]).flatMap((row:any[],ri:number)=>row.filter((cell:any)=>!cell?.merged).map((cell:any,ki:number)=>{
                              const k=`${ri}-${ki}`
                              return <div key={k} contentEditable suppressContentEditableWarning onBlur={e=>updateCell(ri,ki,(e.target as HTMLElement).innerText)} onMouseDown={e=>e.stopPropagation()} className="p-1 text-[11px] leading-tight flex items-center overflow-hidden outline-none focus:bg-blue-50 min-h-[24px]" style={{gridColumn:`span ${cell?.colspan||1}`, gridRow:`span ${cell?.rowspan||1}`, background: cell?.style?.background||'transparent', color: cell?.style?.color||'#1e293b'}}>{cell?.text||''}</div>
                            }))}
                          </div>
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex gap-1 bg-white border rounded-full shadow px-1 py-1">
                            <button onMouseDown={e=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation(); const nr=rows+1; const newCells=cells? [...cells, Array.from({length:cols},()=>({text:'',style:{}}))] : Array.from({length:nr},()=>Array.from({length:cols},()=>({text:'',style:{}}))); setSlides(sl=>sl.map((s,i)=> i!==active? s: {...s, content:{...s.content, blocks:s.content.blocks.map(bb=> bb.id===b.id? {...bb, table:{rows:nr, cols, cells:newCells}}:bb)}}))}} className="px-2 py-0.5 text-xs bg-slate-100 rounded-full hover:bg-slate-200">+ Строка</button>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation(); const nc=cols+1; const newCells=(cells||Array.from({length:rows},()=>Array.from({length:cols},()=>({text:'',style:{}})))).map((row:any)=>[...row, {text:'',style:{}}]); setSlides(sl=>sl.map((s,i)=> i!==active? s: {...s, content:{...s.content, blocks:s.content.blocks.map(bb=> bb.id===b.id? {...bb, table:{rows, cols:nc, cells:newCells}}:bb)}}))}} className="px-2 py-0.5 text-xs bg-slate-100 rounded-full hover:bg-slate-200">+ Столбец</button>
                            <button onMouseDown={e=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation(); if(rows<=1) return; const newCells=cells?.slice(0,rows-1); setSlides(sl=>sl.map((s,i)=> i!==active? s: {...s, content:{...s.content, blocks:s.content.blocks.map(bb=> bb.id===b.id? {...bb, table:{rows:rows-1, cols, cells:newCells}}:bb)}}))}} className="px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded-full">- Строка</button>
                          </div>
                        </div>
                      )
                    }
                    if(b.type==='chart'){
                      const chartType=b.style?.chartType||'bar'
                      return <div key={b.id} onClick={()=>setSelectedBlock(b.id)} onMouseDown={(e)=>handleDragStart(e,b.id)} style={{...common, cursor:'move'}} className={`group border-2 ${selCls} rounded-lg bg-white flex flex-col items-center justify-center p-2 overflow-hidden ${getAnimationClass(b.animation||'нет')}`}>
                        <div className="flex items-center gap-1 text-xs font-bold text-blue-700"><BarChart3 size={14}/> {chartType}</div>
                        <div className="mt-1 w-full flex-1 flex items-end justify-center gap-1 min-h-[60px]">
                          {chartType==='pie' ? (
                            <div className="w-16 h-16 rounded-full border-4 border-blue-500 relative overflow-hidden" style={{background:`conic-gradient(#8b5cf6 0% 40%, #f59e0b 40% 70%, #10b981 70% 100%)`}}><div className="absolute inset-2 bg-white rounded-full flex items-center justify-center text-xs font-bold">pie</div></div>
                          ) : chartType==='line' ? (
                            <svg className="w-full h-12" viewBox="0 0 100 40"><polyline points="0,30 20,10 40,25 60,5 80,20 100,10" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : (
                            [40,70,50,80,60].map((h,i)=><div key={i} className="flex-1 bg-blue-500 rounded-t" style={{height:`${h}%`, background: '#8b5cf6'}}></div>)
                          )}
                        </div>
                        <select value={chartType} onChange={e=>{e.stopPropagation(); setSlides(sl=>sl.map((s,i)=> i!==active? s: {...s, content:{...s.content, blocks:s.content.blocks.map(bb=> bb.id===b.id? {...bb, style:{...bb.style, chartType:e.target.value}}:bb)}}))}} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="mt-1 text-xs border rounded px-1 py-0.5 bg-white">
                          <option value="bar">Столбцы</option><option value="pie">Круг</option><option value="line">Линия</option>
                        </select>
                        <div className="mt-1 w-full">
                          <div className="text-xs font-medium text-slate-600">Данные (через запятую):</div>
                          <input value={(b as any).chartData?.values?.join(',')||'40,70,50,80,60'} onChange={e=>{
                            const vals=e.target.value.split(',').map(v=>parseInt(v.trim())||0)
                            setSlides(sl=>sl.map((s,i)=> i!==active? s: {...s, content:{...s.content, blocks:s.content.blocks.map(bb=> bb.id===b.id? {...bb, chartData:{labels: vals.map((_,i)=>'A'+(i+1)), values: vals}}:bb)}}))
                          }} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="w-full mt-1 px-2 py-1 rounded border text-xs" placeholder="40,70,50,80,60"/>
                        </div>
                        {isSelected && ['nw','n','ne','e','se','s','sw','w'].map((h:any)=>(<div key={h} onMouseDown={(e)=>handleResizeStart(e,b.id,h)} className="absolute w-2.5 h-2.5 bg-white border border-[#d24726] rounded-sm" style={{cursor: h==='nw'||h==='se' ? 'nwse-resize' : h==='ne'||h==='sw' ? 'nesw-resize' : h==='n'||h==='s' ? 'ns-resize' : 'ew-resize', left: h.includes('w') ? -5 : h.includes('e') ? '100%' : '50%', top: h.includes('n') ? -5 : h.includes('s') ? '100%' : '50%', transform: h==='n'||h==='s' ? 'translateX(-50%)' : h==='e'||h==='w' ? 'translateY(-50%)' : h==='nw' ? 'translate(0,0)' : h==='ne' ? 'translate(-100%,0)' : h==='sw' ? 'translate(0,-100%)' : 'translate(-100%,-100%)'}}/>))}
                      </div>
                    }
                    return <div key={b.id} onClick={()=>setSelectedBlock(b.id)} onMouseDown={(e)=>handleDragStart(e,b.id)} style={{...common, cursor:'move'}} className={`group border-2 ${selCls} p-1`}>{b.content||''}</div>
                  })})()}
                  {cur.content.blocks.length===0 && <div className="absolute inset-0 flex items-center justify-center text-slate-400 border-2 border-dashed m-4 rounded-xl">Пустой слайд</div>}
                </div>
              </div>
              <div className="h-7 bg-slate-50 border-t flex items-center justify-between px-3 text-[11px] text-slate-500 shrink-0">
                <span className="flex items-center gap-2"><FileImage size={12}/> Заметки: <input value={cur.notes||''} onChange={e=>setSlides(sl=>sl.map((s,i)=>i===active?{...s, notes:e.target.value}:s))} placeholder="Подсказки докладчику..." className="bg-transparent border-none focus:outline-none w-[300px]"/></span>
                <span className="flex items-center gap-1"><Palette size={12}/> Фон: <input type="color" value={cur.background.startsWith('#')? cur.background:'#ffffff'} onChange={e=>setSlides(sl=>sl.map((s,i)=>i===active?{...s,background:e.target.value, backgroundType:'solid'}:s))} className="w-5 h-5 rounded border ml-1 align-middle"/></span>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[960px] aspect-video shrink-0 bg-white rounded-lg shadow-xl border flex flex-col overflow-hidden" style={{...getSlideBgStyle(cur), ...slideAspectStyle(cur), zoom: `${zoom}%` as any}}>
              <div className="flex-1 p-6 lg:p-8 flex flex-col gap-3 overflow-auto">
                {cur.content.blocks.map((b:any)=>(
                  <div key={b.id} onClick={()=>setSelectedBlock(b.id)} className={`group relative p-1 rounded-lg border-2 cursor-pointer ${selectedBlock===b.id ? 'border-[#d24726] bg-orange-50/30' : 'border-transparent hover:border-slate-200'}`}>
                    {b.type==='text' && (
                      <div contentEditable suppressContentEditableWarning onBlur={e=>{
                        const val=(e.target as HTMLElement).innerText
                        setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:s.content.blocks.map(x=>x.id===b.id? {...x, content:val}:x)}}))
                      }} onFocus={()=>setSelectedBlock(b.id)} className="w-full bg-transparent border-none focus:outline-none min-h-[1.5em] whitespace-pre-wrap" style={{fontSize:b.style?.fontSize||20, fontFamily:b.style?.fontFamily||'Inter', fontWeight:b.style?.bold?'700':b.style?.italic?'400':'400', fontStyle:b.style?.italic?'italic':'normal', textDecoration: b.style?.underline?'underline': b.style?.highlight?'none':'none', textAlign:b.style?.align||'left', color:b.style?.color||'#1e293b', lineHeight:b.style?.lineHeight||1.4}} >{b.content}</div>
                    )}
                    {b.type==='image' && (
                      <div className="relative">
                        <img onError={imgMissing} src={resolveSrc(b.src)} className="rounded-lg max-h-[260px] w-full object-contain border" style={{borderRadius:b.style?.borderRadius||8}} alt=""/>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                          <label className="px-2 py-1 rounded bg-white border text-xs cursor-pointer shadow">Замени <input type="file" accept="image/*" className="hidden" onChange={e=>{
                            const f=e.target.files?.[0]; if(!f) return
                            const r=new FileReader(); r.onload=()=> setSlides(sl=>sl.map((s,i)=>i!==active?s:{...s, content:{...s.content, blocks:s.content.blocks.map(x=>x.id===b.id? {...x, src:r.result as string}:x)}})); r.readAsDataURL(f)
                          }}/></label>
                        </div>
                      </div>
                    )}
                    {b.type==='shape' && (
                      <div className="h-20 rounded-lg border-2 flex items-center justify-center text-sm font-bold" style={{background:b.style?.fill||'#3B82F6', borderColor:b.style?.stroke||'#1e40af', borderWidth:b.style?.strokeWidth||2, borderRadius: b.shape==='circle'||b.shape==='ellipse'?'50%': b.shape==='rounded'?'16px':'8px'}}>{b.shape||'rect'}</div>
                    )}
                    {b.type==='table' && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="grid gap-px bg-slate-300" style={{gridTemplateColumns:`repeat(${b.table?.cols||3},1fr)`}}>
                          {Array.from({length:(b.table?.rows||3)*(b.table?.cols||3)}).map((_,k)=>{
                            const r=Math.floor(k/(b.table?.cols||3)), c=k%(b.table?.cols||3)
                            const cell=b.table?.cells?.[r]?.[c]
                            return <div key={k} contentEditable suppressContentEditableWarning onBlur={e=>{
                              const val=(e.target as HTMLElement).innerText
                              const rows=b.table?.rows||3, cols=b.table?.cols||3
                              const cells=b.table?.cells ? JSON.parse(JSON.stringify(b.table.cells)) : Array.from({length:rows},()=>Array.from({length:cols},()=>({text:'',style:{}})))
                              if(!cells[r]) cells[r]=[]
                              cells[r][c]={text:val, style: cells[r][c]?.style||{}}
                              setSlides(sl=>sl.map((s,i)=> i!==active? s: {...s, content:{...s.content, blocks:s.content.blocks.map(x=>x.id===b.id? {...x, table:{rows, cols, cells}}:x)}}))
                            }} onFocus={()=>setSelectedBlock(b.id)} className="bg-white p-2 text-sm min-h-[32px] outline-none focus:bg-blue-50" style={{background: cell?.style?.background||'#fff'}}>{cell?.text||'Ячейка'}</div>
                          })}
                        </div>
                      </div>
                    )}
                    {b.type==='chart' && (
                      <div className="h-28 rounded-xl border-2 bg-white flex flex-col items-center justify-center gap-1 p-2">
                        <div className="flex items-center gap-1 text-xs font-bold text-blue-700"><BarChart3 size={14}/> {b.style?.chartType||'bar'}</div>
                        <div className="w-full h-12 flex items-end justify-center gap-1 mt-1">
                          {(b as any).chartData?.values?.length ? (b as any).chartData.values.map((v:any,i:number)=><div key={i} className="flex-1 bg-blue-500 rounded-t" style={{height:`${Math.max(10, Math.min(100, v))}%`}}></div>) : [40,70,50,80,60].map((h,i)=><div key={i} className="flex-1 bg-blue-500 rounded-t" style={{height:`${h}%`}}></div>)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Данные в Свойствах →</div>
                      </div>
                    )}
                    {b.type==='video' && <div className="aspect-video rounded-xl bg-black flex items-center justify-center text-white text-sm">🎥 {b.src||'Видео'}</div>}
                    {b.type==='icon' && <div className="text-4xl text-center" style={{fontSize:b.style?.fontSize||32}}>{b.content}</div>}
                    <button onClick={(e)=>{e.stopPropagation(); deleteSelected()}} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 size={10}/></button>
                  </div>
                ))}
                {cur.content.blocks.length===0 && <div className="flex-1 flex items-center justify-center text-slate-400 border-2 border-dashed rounded-xl p-12">Пустой слайд — добавь блок из ленты Вставка</div>}
              </div>
              <div className="h-7 bg-slate-50 border-t flex items-center justify-between px-3 text-[11px] text-slate-500 shrink-0">
                <span className="flex items-center gap-2"><FileImage size={12}/> Заметки: <input value={cur.notes||''} onChange={e=>setSlides(sl=>sl.map((s,i)=>i===active?{...s, notes:e.target.value}:s))} placeholder="Подсказки докладчику..." className="bg-transparent border-none focus:outline-none w-[300px]"/></span>
                <span className="flex items-center gap-1"><Palette size={12}/> Фон: <input type="color" value={cur.background.startsWith('#')? cur.background:'#ffffff'} onChange={e=>setSlides(sl=>sl.map((s,i)=>i===active?{...s,background:e.target.value, backgroundType:'solid'}:s))} className="w-5 h-5 rounded border ml-1 align-middle"/></span>
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button onClick={()=>setActive(a=>Math.max(0,a-1))} disabled={active===0} className="px-3 py-1.5 rounded-lg bg-white border text-sm disabled:opacity-50">‹ Назад</button>
            <button onClick={()=>setActive(a=>Math.min(slides.length-1,a+1))} disabled={active===slides.length-1} className="px-3 py-1.5 rounded-lg bg-white border text-sm disabled:opacity-50">Вперед ›</button>
            <button onClick={()=>setSlideshow(true)} className="ml-auto px-4 py-1.5 rounded-lg bg-[#d24726] text-white text-sm flex items-center gap-1"><Maximize2 size={14}/> Слайд-шоу</button>
          </div>
        </div>

        <div className="w-[300px] bg-white border-l hidden xl:flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-bold text-sm flex items-center gap-1"><Wand2 size={14}/> Свойства</h3>
            {selectedBlock ? <div className="text-xs text-slate-500">{curSelected?.type} • анимация: {curSelected?.animation||'нет'}</div> : <div className="text-xs text-slate-500">Выдели блок на слайде</div>}
          </div>
          <div className="flex-1 p-3 space-y-3 overflow-auto">
            {selectedBlock && curSelected?.type==='text' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold">Текст</label>
                <textarea value={curSelected.content} onChange={e=>updateSelected({content:e.target.value})} rows={3} className="w-full px-2 py-1.5 rounded border text-sm"/>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Шрифт <select value={curSelected.style?.fontFamily||'Inter'} onChange={e=>updateSelectedStyle({fontFamily:e.target.value})} className="w-full px-1 py-1 rounded border text-xs">{FONTS.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
                  <label className="text-xs">Размер <input type="range" min={10} max={54} value={curSelected.style?.fontSize||18} onChange={e=>updateSelectedStyle({fontSize:parseInt(e.target.value)})} className="w-full"/></label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Цвет <input type="color" value={curSelected.style?.color||'#1e293b'} onChange={e=>updateSelectedStyle({color:e.target.value})} className="w-full h-7 rounded border"/></label>
                  <label className="text-xs">Маркер <input type="color" value={curSelected.style?.highlightColor||'#fef08a'} onChange={e=>updateSelectedStyle({highlight:true, highlightColor:e.target.value})} className="w-full h-7 rounded border"/></label>
                </div>
                <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!curSelected.style?.shadow} onChange={e=>updateSelectedStyle({shadow:e.target.checked})}/> Тень</label>
              </div>
            )}
            {selectedBlock && curSelected?.type==='shape' && (
              <div className="space-y-2">
                <label className="text-xs">Фигура <select value={curSelected.shape} onChange={e=>updateSelected({shape:e.target.value})} className="w-full px-2 py-1.5 rounded border text-sm">{SHAPES.map(s=><option key={s.k} value={s.k}>{s.label}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Заливка <input type="color" value={curSelected.style?.fill||'#3B82F6'} onChange={e=>updateSelectedStyle({fill:e.target.value})} className="w-full h-7 rounded"/></label>
                  <label className="text-xs">Контур <input type="color" value={curSelected.style?.stroke||'#1e40af'} onChange={e=>updateSelectedStyle({stroke:e.target.value})} className="w-full h-7 rounded"/></label>
                </div>
              </div>
            )}
            {selectedBlock && curSelected?.type==='image' && (
              <div className="space-y-2">
                <label className="text-xs">Скругление <input type="range" min={0} max={24} value={curSelected.style?.borderRadius||8} onChange={e=>updateSelectedStyle({borderRadius:parseInt(e.target.value)})} className="w-full"/></label>
              </div>
            )}
            <div className="pt-3 border-t">
              <label className="text-xs font-semibold">Заметки к слайду</label>
              <textarea value={cur.notes||''} onChange={e=>setSlides(sl=>sl.map((s,i)=>i===active?{...s, notes:e.target.value}:s))} placeholder="Подсказки докладчику..." rows={3} className="w-full mt-1 px-2 py-1.5 rounded border text-sm"/>
            </div>
          </div>
          <div className="p-3 border-t space-y-2">
            <button onClick={deleteSelected} disabled={!selectedBlock} className="w-full py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm flex items-center justify-center gap-1 disabled:opacity-50"><Trash2 size={14}/> Удалить блок</button>
          </div>
        </div>
      </div>
    </div>
  )
}
