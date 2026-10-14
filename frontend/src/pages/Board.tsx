import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { Save, Trash2, Download, Palette, PenTool, Circle, Square, Triangle, Minus, ArrowRight, Type, Grid3X3, Move, Compass, Orbit, Box, Undo2, Redo2, Plus, Layers, Maximize2 } from 'lucide-react'

type Tool2D = 'pen'|'eraser'|'rect'|'circle'|'ellipse'|'triangle'|'rhombus'|'line'|'arrow'|'text'|'coordinate'|'vector'|'angle'
type Tool3D = 'cube3d'|'sphere3d'|'cylinder3d'|'cone3d'|'pyramid3d'|'prism3d'|'plane3d'|'orbit'|'axis3d'
type Tool = Tool2D | Tool3D

export default function Board(){
  const {t}=useLang()
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const containerRef=useRef<HTMLDivElement>(null)
  const [mode,setMode]=useState<'2d'|'3d'>('2d')
  const [tool,setTool]=useState<Tool>('pen')
  const [color,setColor]=useState('#0f172a')
  const [fill,setFill]=useState('#3B82F6')
  const [width,setWidth]=useState(3)
  const [grid,setGrid]=useState(true)
  const [drawing,setDrawing]=useState(false)
  const [startPos,setStartPos]=useState<{x:number,y:number}|null>(null)
  const [snapshot,setSnapshot]=useState<ImageData|null>(null)
  const [boards,setBoards]=useState<any[]>([])
  const [title,setTitle]=useState(t('board_new'))
  const [isFullscreen,setIsFullscreen]=useState(false)
  const [hideRight,setHideRight]=useState(false)
  const [hideSidebarLocal,setHideSidebarLocal]=useState(false)
  // pages: локальные страницы доски
  const [pages,setPages]=useState<(string|null)[]>([null])
  const [currentPage,setCurrentPage]=useState(0)
  // history for undo/redo per page
  const [history,setHistory]=useState<ImageData[]>([])
  const [historyIdx,setHistoryIdx]=useState(-1)

  useEffect(()=>{
    client.get('/boards/').then(r=>setBoards(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
    initCanvas()
    const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape' && isFullscreen) setIsFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  },[isFullscreen])

  useEffect(()=>{ if(mode==='3d' && !tool.endsWith('3d') && tool!=='axis3d' && tool!=='orbit') setTool('cube3d'); if(mode==='2d' && (tool.endsWith('3d')||tool==='orbit'||tool==='axis3d')) setTool('pen') },[mode])

  const toggleSidebar=()=>{
    const newVal=!hideSidebarLocal
    setHideSidebarLocal(newVal)
    localStorage.setItem('board-hide-sidebar', newVal?'1':'0')
    window.dispatchEvent(new CustomEvent('toggle-sidebar', {detail:{hide:newVal}}))
  }
  // сохраняем текущую страницу при переключении
  const saveCurrentPageToMem=()=>{
    const c=canvasRef.current
    if(!c) return
    const data=c.toDataURL('image/png')
    setPages(prev=>{
      const np=[...prev]
      np[currentPage]=data
      return np
    })
  }

  const initCanvas=(withGrid=grid)=>{
    const c=canvasRef.current
    if(!c) return
    const ctx=c.getContext('2d')!
    const dpr=window.devicePixelRatio||1
    const rect=c.getBoundingClientRect()
    // responsive: use container width, but capped for performance
    const logicalW = isFullscreen ? 1920 : Math.min(Math.max(rect.width, 600), 1400)
    const logicalH = isFullscreen ? 900 : 520
    c.width= logicalW*dpr
    c.height= logicalH*dpr
    c.style.width = logicalW+'px'
    c.style.height = logicalH+'px'
    ctx.setTransform(1,0,0,1,0,0)
    ctx.scale(dpr,dpr)
    ctx.fillStyle='#ffffff'
    ctx.fillRect(0,0,logicalW,logicalH)
    if(withGrid) drawGrid(ctx, logicalW, logicalH)
    try{
      const img=ctx.getImageData(0,0,c.width,c.height)
      setHistory([img]); setHistoryIdx(0)
    }catch(e){ console.warn('init history failed', e) }
  }

  useEffect(()=>{
    const onResize=()=>{
      // keep drawing but reinitialize grid if needed
    }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  useEffect(()=>{
    if(isFullscreen){
      setTimeout(()=>initCanvas(),100)
    }
  },[isFullscreen])

  const drawGrid=(ctx:CanvasRenderingContext2D, w:number,h:number)=>{
    ctx.save()
    ctx.strokeStyle='#e2e8f0'
    ctx.lineWidth=0.5
    const step=40
    for(let x=0;x<w;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
    for(let y=0;y<h;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }
    ctx.strokeStyle='#94a3b8'
    ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(w/2,0); ctx.lineTo(w/2,h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke()
    ctx.fillStyle='#64748b'
    ctx.font='11px Inter'
    ctx.fillText('O', w/2+6, h/2+12)
    ctx.fillText('X', w-10, h/2-6)
    ctx.fillText('Y', w/2+8, 14)
    ctx.restore()
  }

  const getPos=(e:any)=>{
    const rect=canvasRef.current!.getBoundingClientRect()
    const t=e.touches?.[0]||e
    // учитываем что canvas может быть шире контейнера и скроллится
    return {x:t.clientX-rect.left, y:t.clientY-rect.top}
  }

  const pushHistory=()=>{
    const c=canvasRef.current!
    const ctx=c.getContext('2d')!
    try{
      const img=ctx.getImageData(0,0,c.width,c.height)
      setHistory(prev=>{
        // use functional to avoid stale closure
        const idxRef = historyIdx
        const nh=prev.slice(0, idxRef+1)
        nh.push(img)
        if(nh.length>20) nh.shift()
        return nh
      })
      setHistoryIdx(prev=> Math.min(prev+1, 19))
    }catch(e){
      console.warn('history push failed', e)
    }
  }

  const undo=()=>{
    if(historyIdx<=0) return
    const c=canvasRef.current!, ctx=c.getContext('2d')!
    const newIdx=historyIdx-1
    ctx.putImageData(history[newIdx],0,0)
    setHistoryIdx(newIdx)
  }
  const redo=()=>{
    if(historyIdx>=history.length-1) return
    const c=canvasRef.current!, ctx=c.getContext('2d')!
    const newIdx=historyIdx+1
    ctx.putImageData(history[newIdx],0,0)
    setHistoryIdx(newIdx)
  }

  const drawShape=(ctx:CanvasRenderingContext2D, type:Tool, x1:number,y1:number,x2:number,y2:number)=>{
    ctx.strokeStyle=color
    ctx.fillStyle=fill
    ctx.lineWidth=width
    ctx.lineCap='round'
    ctx.lineJoin='round'
    const w=x2-x1, h=y2-y1
    const cx=(x1+x2)/2, cy=(y1+y2)/2
    const min=Math.min(Math.abs(w),Math.abs(h))
    // без лимита — используем реальный размер
    switch(type){
      case 'rect':
        ctx.strokeRect(x1,y1,w,h)
        if(fill!=='transparent'){ ctx.globalAlpha=0.3; ctx.fillRect(x1,y1,w,h); ctx.globalAlpha=1 }
        break
      case 'circle':{
        const r=Math.hypot(w,h)/2
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke()
        if(fill!=='transparent'){ ctx.globalAlpha=0.2; ctx.fill(); ctx.globalAlpha=1 }
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill()
        break
      }
      case 'ellipse':{
        ctx.beginPath(); ctx.ellipse(cx,cy,Math.abs(w)/2,Math.abs(h)/2,0,0,Math.PI*2); ctx.stroke()
        if(fill!=='transparent'){ ctx.globalAlpha=0.15; ctx.fill(); ctx.globalAlpha=1 }
        break
      }
      case 'triangle':{
        ctx.beginPath(); ctx.moveTo(cx,y1); ctx.lineTo(x1,y2); ctx.lineTo(x2,y2); ctx.closePath(); ctx.stroke()
        if(fill!=='transparent'){ ctx.globalAlpha=0.15; ctx.fill(); ctx.globalAlpha=1 }
        break
      }
      case 'rhombus':{
        ctx.beginPath(); ctx.moveTo(cx,y1); ctx.lineTo(x2,cy); ctx.lineTo(cx,y2); ctx.lineTo(x1,cy); ctx.closePath(); ctx.stroke()
        if(fill!=='transparent'){ ctx.globalAlpha=0.15; ctx.fill(); ctx.globalAlpha=1 }
        break
      }
      case 'line':
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
        break
      case 'arrow':{
        drawArrow(ctx,x1,y1,x2,y2)
        break
      }
      case 'vector':{
        drawArrow(ctx,x1,y1,x2,y2)
        ctx.fillStyle=color; ctx.font='12px Inter'; ctx.fillText('a⃗', x2+6, y2-6)
        break
      }
      case 'angle':{
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y1); ctx.moveTo(x1,y1); ctx.lineTo(x1 + (x2-x1)*0.7, y1 + (y2-y1)*0.7); ctx.stroke()
        ctx.beginPath(); ctx.arc(x1,y1,24,0,Math.atan2(y2-y1,x2-x1)); ctx.stroke()
        break
      }
      case 'coordinate':{
        // без лимита
        drawCoordinate(ctx,cx,cy, Math.max(40, Math.abs(w)))
        break
      }
      case 'cube3d': drawCube(ctx,cx,cy, Math.max(20, Math.abs(min))); break
      case 'sphere3d': drawSphere(ctx,cx,cy, Math.max(10, Math.hypot(w,h)/2)); break
      case 'cylinder3d': drawCylinder(ctx,cx,cy, Math.max(20,Math.abs(w)), Math.max(20,Math.abs(h))); break
      case 'cone3d': drawCone(ctx,cx,cy, Math.max(20,Math.abs(w)), Math.max(20,Math.abs(h))); break
      case 'pyramid3d': drawPyramid(ctx,cx,cy, Math.max(30, Math.abs(min))); break
      case 'prism3d': drawPrism(ctx,cx,cy, Math.max(20,Math.abs(w)), Math.max(20,Math.abs(h))); break
      case 'plane3d': drawPlane(ctx,cx,cy, Math.max(40, Math.abs(w))); break
      case 'orbit': drawOrbit(ctx,cx,cy, Math.max(20, Math.abs(w)/2), Math.max(15, Math.abs(h)/3)); break
      case 'axis3d': drawAxis3D(ctx,cx,cy); break
    }
    if(['rect','circle','cube3d','sphere3d'].includes(type)){
      ctx.fillStyle='#475569'; ctx.font='10px Inter'
      ctx.fillText(`${Math.round(Math.abs(w))}×${Math.round(Math.abs(h))}`, x2+4, y2+12)
    }
  }

  const drawArrow=(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number)=>{
    const head=14
    const ang=Math.atan2(y2-y1,x2-x1)
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-head*Math.cos(ang-Math.PI/6), y2-head*Math.sin(ang-Math.PI/6)); ctx.lineTo(x2-head*Math.cos(ang+Math.PI/6), y2-head*Math.sin(ang+Math.PI/6)); ctx.closePath(); ctx.fillStyle=color; ctx.fill()
  }
  const drawCoordinate=(ctx:CanvasRenderingContext2D,x:number,y:number,size:number)=>{
    ctx.save(); ctx.strokeStyle='#0f172a'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(x-size,y); ctx.lineTo(x+size,y); ctx.stroke()
    drawArrow(ctx,x+size-12,y,x+size,y)
    ctx.fillText('X', x+size+6, y+4)
    ctx.beginPath(); ctx.moveTo(x,y+size); ctx.lineTo(x,y-size); ctx.stroke()
    drawArrow(ctx,x,y-size,x,y-size+12)
    ctx.fillText('Y', x+6, y-size+6)
    ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=0.5
    const step=Math.max(20, size/6)
    for(let i=-size;i<=size;i+=step){ ctx.beginPath(); ctx.moveTo(x+i, y-2); ctx.lineTo(x+i, y+2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x-2, y+i); ctx.lineTo(x+2, y+i); ctx.stroke() }
    ctx.restore()
  }
  const drawCube=(ctx:CanvasRenderingContext2D,x:number,y:number,s:number)=>{
    const d=s*0.35
    ctx.strokeStyle=color; ctx.fillStyle=fill; ctx.lineWidth=width
    ctx.strokeRect(x-s/2,y-s/2,s,s)
    ctx.globalAlpha=0.15; ctx.fillRect(x-s/2,y-s/2,s,s); ctx.globalAlpha=1
    ctx.beginPath(); ctx.moveTo(x-s/2,y-s/2); ctx.lineTo(x-s/2+d,y-s/2-d); ctx.lineTo(x+s/2+d,y-s/2-d); ctx.lineTo(x+s/2,y-s/2); ctx.closePath(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x+s/2,y-s/2); ctx.lineTo(x+s/2+d,y-s/2-d); ctx.lineTo(x+s/2+d,y+s/2-d); ctx.lineTo(x+s/2,y+s/2); ctx.closePath(); ctx.stroke()
    ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x-s/2+d,y+s/2-d); ctx.lineTo(x-s/2,y+s/2); ctx.stroke(); ctx.setLineDash([])
  }
  const drawSphere=(ctx:CanvasRenderingContext2D,x:number,y:number,r:number)=>{
    const g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.5, x,y,r)
    g.addColorStop(0, fill); g.addColorStop(1, '#0f172a')
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(x,y,r*0.9,r*0.35,0,0,Math.PI*2); ctx.strokeStyle='#ffffff55'; ctx.stroke()
  }
  const drawCylinder=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number)=>{
    const rx=w/2, ry=14
    ctx.fillStyle=fill; ctx.globalAlpha=0.2
    ctx.beginPath(); ctx.ellipse(x,y-h/2,rx,ry,0,0,Math.PI*2); ctx.fill()
    ctx.fillRect(x-rx,y-h/2, w, h)
    ctx.beginPath(); ctx.ellipse(x,y+h/2,rx,ry,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1
    ctx.strokeStyle=color; ctx.beginPath(); ctx.ellipse(x,y-h/2,rx,ry,0,0,Math.PI*2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x-rx,y-h/2); ctx.lineTo(x-rx,y+h/2); ctx.moveTo(x+rx,y-h/2); ctx.lineTo(x+rx,y+h/2); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(x,y+h/2,rx,ry,0,0,Math.PI, false); ctx.stroke()
  }
  const drawCone=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number)=>{
    const rx=w/2
    ctx.beginPath(); ctx.ellipse(x,y+h/2,rx,12,0,0,Math.PI*2); ctx.fillStyle=fill; ctx.globalAlpha=0.2; ctx.fill(); ctx.globalAlpha=1; ctx.strokeStyle=color; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x,y-h/2); ctx.lineTo(x-rx,y+h/2); ctx.lineTo(x+rx,y+h/2); ctx.closePath(); ctx.stroke()
  }
  const drawPyramid=(ctx:CanvasRenderingContext2D,x:number,y:number,s:number)=>{
    ctx.beginPath(); ctx.moveTo(x,y-s/2); ctx.lineTo(x-s/2,y+s/2); ctx.lineTo(x+s/2,y+s/2); ctx.closePath(); ctx.strokeStyle=color; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x,y-s/2); ctx.lineTo(x,y+s/4); ctx.stroke()
    ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(x-s/2,y+s/2); ctx.lineTo(x,y+s/4); ctx.lineTo(x+s/2,y+s/2); ctx.stroke(); ctx.setLineDash([])
  }
  const drawPrism=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number)=>{
    const d=18
    ctx.strokeStyle=color
    ctx.strokeRect(x-w/2,y-h/2,w,h)
    ctx.beginPath(); ctx.moveTo(x-w/2,y-h/2); ctx.lineTo(x-w/2+d,y-h/2-d); ctx.lineTo(x+w/2+d,y-h/2-d); ctx.lineTo(x+w/2,y-h/2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x+w/2,y-h/2); ctx.lineTo(x+w/2+d,y-h/2-d); ctx.lineTo(x+w/2+d,y+h/2-d); ctx.lineTo(x+w/2,y+h/2); ctx.stroke()
  }
  const drawPlane=(ctx:CanvasRenderingContext2D,x:number,y:number,s:number)=>{
    ctx.fillStyle=fill; ctx.globalAlpha=0.15; ctx.beginPath(); ctx.moveTo(x-s/2,y); ctx.lineTo(x+s/4,y-s/2); ctx.lineTo(x+s/2,y); ctx.lineTo(x-s/4,y+s/2); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; ctx.strokeStyle=color; ctx.stroke()
  }
  const drawOrbit=(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number)=>{
    ctx.strokeStyle=color; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle=fill; ctx.beginPath(); ctx.arc(x+rx,y,8,0,Math.PI*2); ctx.fill(); ctx.stroke()
    ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#475569'; ctx.font='10px Inter'; ctx.fillText('☀', x-5, y+4)
  }
  const drawAxis3D=(ctx:CanvasRenderingContext2D,x:number,y:number)=>{
    drawArrow(ctx,x,y,x+60,y-30); ctx.fillText('X', x+62, y-30)
    drawArrow(ctx,x,y,x-40,y-30); ctx.fillText('Y', x-44, y-32)
    drawArrow(ctx,x,y,x,y-60); ctx.fillText('Z', x+4, y-62)
  }

  const start=(e:any)=>{
    const p=getPos(e)
    setStartPos(p)
    setDrawing(true)
    const c=canvasRef.current!, ctx=c.getContext('2d')!
    if(['rect','circle','ellipse','triangle','rhombus','line','arrow','vector','angle','coordinate','cube3d','sphere3d','cylinder3d','cone3d','pyramid3d','prism3d','plane3d','orbit','axis3d'].includes(tool)){
      setSnapshot(ctx.getImageData(0,0,c.width,c.height))
    } else if(tool==='pen' || tool==='eraser'){
      ctx.beginPath(); ctx.moveTo(p.x,p.y)
    } else if(tool==='text'){
      const txt=prompt(t('board_text_prompt'))
      if(txt){ ctx.fillStyle=color; ctx.font='18px Inter'; ctx.fillText(txt, p.x, p.y); pushHistory() }
      setDrawing(false)
    }
  }
  const move=(e:any)=>{
    if(!drawing || !startPos) return
    const c=canvasRef.current!, ctx=c.getContext('2d')!
    const p=getPos(e)
    if(tool==='pen' || tool==='eraser'){
      ctx.strokeStyle= tool==='eraser'?'#ffffff':color
      ctx.lineWidth= tool==='eraser'?28:width
      ctx.lineCap='round'; ctx.lineJoin='round'
      ctx.lineTo(p.x,p.y); ctx.stroke()
    } else {
      if(snapshot){
        ctx.putImageData(snapshot,0,0)
      }
      drawShape(ctx, tool, startPos.x, startPos.y, p.x, p.y)
    }
  }
  const end=(e:any)=>{
    if(!drawing || !startPos) { setDrawing(false); return }
    const p=getPos(e)
    const c=canvasRef.current!, ctx=c.getContext('2d')!
    if(snapshot && !['pen','eraser','text'].includes(tool)){
      ctx.putImageData(snapshot,0,0)
      drawShape(ctx, tool, startPos.x, startPos.y, p.x, p.y)
    }
    setDrawing(false); setStartPos(null); setSnapshot(null)
    pushHistory()
  }

  const clear=()=>{
    const c=canvasRef.current!; const ctx=c.getContext('2d')!
    const rect=c.getBoundingClientRect()
    const logicalW = parseInt(c.style.width) || rect.width
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,logicalW,640)
    if(grid) drawGrid(ctx, logicalW, 640)
    pushHistory()
  }

  const save=async()=>{
    const c=canvasRef.current!
    // ensure current page saved
    const currentData=c.toDataURL('image/png')
    if (!currentData.startsWith('data:image/png')) { alert(t('board_png_only')); return; }
    const allPages = [...pages]
    allPages[currentPage]=currentData
    // check total size (approx)
    const totalLen = allPages.join('').length
    if (totalLen > 4_000_000) { alert(t('board_too_many')); return; }
    if (currentData.length > 800000) { alert(t('board_too_big')); return; }
    setPages(allPages)
    try {
      await client.post('/boards/',{title: title.slice(0,100), data:{image: currentData, images: allPages, mode, pages: allPages.length, currentPage}})
      // also update local
      const { toast } = await import('../context/UIContext')
      toast(t('board_saved'), 'success')
      client.get('/boards/').then(r=>setBoards(Array.isArray(r.data)?r.data:r.data.results||[]))
    } catch(e:any){ 
      const { toast } = await import('../context/UIContext')
      toast(e.response?.data?.detail || e.response?.data?.[0] || t('board_save_err'), 'error')
    }
  }
  const download=()=>{
    const c=canvasRef.current!
    const a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download=`board-${Date.now()}-page${currentPage+1}.png`; document.body.appendChild(a); a.click(); a.remove()
  }
  const loadBoard=(b:any)=>{
    const c=canvasRef.current!, ctx=c.getContext('2d')!
    const images = b.data.images || [b.data.image]
    const targetIdx = b.data.currentPage || 0
    setPages(images); setCurrentPage(targetIdx)
    // load target page after state update
    setTimeout(()=>{
      const cc=canvasRef.current!, cctx=cc.getContext('2d')!
      const logicalW = parseInt(cc.style.width) || cc.getBoundingClientRect().width
      const logicalH = isFullscreen ? 900 : 520
      cctx.clearRect(0,0,logicalW,logicalH)
      const src = images[targetIdx]
      if(src){
        const img=new Image()
        img.onload=()=>{ cctx.drawImage(img,0,0,logicalW,logicalH); pushHistory() }
        img.src=src
      } else {
        if(grid) drawGrid(cctx, logicalW, logicalH)
        pushHistory()
      }
    },100)
    setTitle(b.title)
  }

  const addPage=()=>{
    // сохраняем текущую
    const c=canvasRef.current!
    const data=c.toDataURL('image/png')
    setPages(prev=>{
      const np=[...prev]
      np[currentPage]=data
      np.push(null) // новая пустая
      return np
    })
    setCurrentPage(prev=> prev+1)
    setTimeout(()=>{
      const cc=canvasRef.current!, ctx=cc.getContext('2d')!
      const rect=cc.getBoundingClientRect()
      const logicalW = parseInt(cc.style.width) || rect.width
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,logicalW,640)
      if(grid) drawGrid(ctx, logicalW, 640)
      pushHistory()
    },50)
  }

  const newBoard=()=>{
    // новая пустая доска — текущую лучше сохранить кнопкой Сохранить
    if(historyIdx>0 && !confirm(t('board_new_confirm'))) return
    setPages([null])
    setCurrentPage(0)
    setTitle(t('board_new'))
    setTimeout(()=>initCanvas(),50)
    window.scrollTo({top:0, behavior:'smooth'})
  }

  const switchPage=(idx:number)=>{
    if(idx===currentPage) return
    // сохраняем текущую
    const c=canvasRef.current!
    const data=c.toDataURL('image/png')
    setPages(prev=>{
      const np=[...prev]
      np[currentPage]=data
      return np
    })
    setCurrentPage(idx)
    setTimeout(()=>{
      const cc=canvasRef.current!, ctx=cc.getContext('2d')!
      const rect=cc.getBoundingClientRect()
      const logicalW = parseInt(cc.style.width) || rect.width
      const saved=pages[idx]
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,logicalW,640)
      if(saved){
        const img=new Image()
        img.onload=()=>{ ctx.drawImage(img,0,0,logicalW,640); pushHistory() }
        img.src=saved
      } else {
        if(grid) drawGrid(ctx, logicalW, 640)
        pushHistory()
      }
    },50)
  }

  if(isFullscreen){
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="h-12 bg-slate-900 text-white flex items-center gap-3 px-4">
          <span className="font-bold">{t('board_fullscreen')}</span>
          <span className="text-xs text-white/70 hidden sm:inline">{title} • {t('board_sheet')} {currentPage+1}/{pages.length} • {mode==='2d'?'2D':'3D'}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={()=>setIsFullscreen(false)} className="px-4 py-1.5 rounded-lg bg-white text-slate-900 font-bold">{t('board_exit_esc')}</button>
            <button onClick={save} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold flex items-center gap-1"><Save size={14}/> {t('save')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#e9e9e9] p-2 flex flex-col">
          <div className="flex-1 overflow-auto bg-white rounded-xl border flex items-center justify-center p-2" ref={containerRef}>
            <canvas ref={canvasRef} className="w-[1920px] h-[900px] rounded-xl border bg-white touch-none cursor-crosshair block" style={{width:'1920px', height:'900px'}} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
          </div>
          <div className="bg-white border-t p-2 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
              {(mode==='2d' ? [['pen',t('board_tool_pen'),PenTool],['eraser',t('board_tool_eraser'),Trash2],['rect',t('board_tool_rect'),Square],['circle',t('board_tool_circle'),Circle],['triangle',t('board_tool_triangle'),Triangle],['line',t('board_tool_line'),Minus],['arrow',t('board_tool_arrow'),ArrowRight],['text',t('board_tool_text'),Type]] : [['cube3d',t('board_tool_cube'),Box],['sphere3d',t('board_tool_sphere'),Circle],['cylinder3d',t('board_tool_cyl'),Box],['cone3d',t('board_tool_cone'),Triangle],['pen',t('board_tool_pen'),PenTool]]).map(([t,label,Icon]:any)=>(
                <button key={t} onClick={()=>setTool(t as Tool)} className={`px-3 py-2 rounded-lg text-sm font-medium flex flex-col items-center gap-1 min-w-[56px] ${tool===t?'bg-blue-600 text-white':'hover:bg-white'}`}><Icon size={16}/><span className="text-[10px]">{label}</span></button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={newBoard} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1 text-sm"><Plus size={16}/> {t('board_new')}</button>
              <button onClick={undo} aria-label={t('board_undo')} className="p-2 rounded-lg bg-slate-100"><Undo2 size={16}/></button>
              <button onClick={redo} aria-label={t('board_redo')} className="p-2 rounded-lg bg-slate-100"><Redo2 size={16}/></button>
              <button onClick={clear} className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">{t('board_clear')}</button>
              <button onClick={()=>setIsFullscreen(false)} className="px-3 py-2 rounded-lg bg-slate-900 text-white">{t('board_exit')}</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 animate-fadeIn">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white"><PenTool size={20}/></span> {t('board')} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{boards.length}</span></h1>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="px-4 py-2 rounded-xl border bg-white font-medium min-w-[160px]"/>
        <div className="flex p-1 rounded-xl bg-slate-100">
          <button onClick={()=>setMode('2d')} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode==='2d'?'bg-white shadow':'text-slate-500'}`}>{t('board_2d')}</button>
          <button onClick={()=>setMode('3d')} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode==='3d'?'bg-white shadow':'text-slate-500'}`}>{t('board_3d')}</button>
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <button onClick={toggleSidebar} className={`px-3 py-2 rounded-xl border text-sm font-medium ${hideSidebarLocal?'bg-amber-100 border-amber-300 text-amber-700':'bg-white hover:bg-slate-50'}`}>{hideSidebarLocal?t('board_show_menu'):t('board_hide_tabs')}</button>
          <button onClick={()=>setHideRight(v=>!v)} className={`px-3 py-2 rounded-xl border text-sm font-medium ${hideRight?'bg-blue-100 border-blue-300':'bg-white'}`}>{hideRight?t('board_show_panel'):t('board_hide_right')}</button>
          <span className="text-xs text-slate-500">{t('board_page')} {currentPage+1}/{pages.length}</span>
          <button onClick={addPage} className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1"><Plus size={16}/> {t('board_add_sheet')}</button>
          <button onClick={save} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2"><Save size={16}/> {t('save')}</button>
          <button onClick={()=>setIsFullscreen(true)} className="px-3 py-2 rounded-xl bg-slate-900 text-white flex items-center gap-1 text-sm"><Maximize2 size={16}/> {t('board_fullscreen_btn')}</button>
        </div>
      </div>

      {/* страниц навигация */}
      <div className="flex gap-2 overflow-auto pb-1">
        {pages.map((_,idx)=>(
          <button key={idx} onClick={()=>switchPage(idx)} className={`px-4 py-2 rounded-xl border text-sm font-bold whitespace-nowrap ${idx===currentPage?'bg-slate-900 text-white border-slate-900':'bg-white hover:bg-slate-50'}`}>{t('board_sheet')} {idx+1}</button>
        ))}
        <button onClick={addPage} className="px-3 py-2 rounded-xl bg-white border border-dashed flex items-center gap-1 text-sm"><Plus size={14}/> {t('add')}</button>
      </div>

      {/* холст пошире */}
      <div ref={containerRef} className="bg-white rounded-2xl border p-2 overflow-auto">
        <div className="min-w-[1200px]">
          <canvas
            ref={canvasRef}
            className="w-[1400px] h-[640px] rounded-xl border bg-white touch-none cursor-crosshair block"
            style={{width:'1400px', height:'640px'}}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          />
        </div>
        <div className="text-xs text-slate-500 mt-2 flex gap-4 px-2">
          <span>{t('board_hint_a')}</span>
          <span className="hidden lg:inline">{t('board_hint_b')}</span>
        </div>
      </div>

      {/* НИЖНЯЯ панель — для интерактивной доски удобнее */}
      <div className="bg-white rounded-2xl border p-3 space-y-3 sticky bottom-0 z-10 shadow-lg">
        {mode==='2d' ? (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 overflow-auto">
              {([
                ['pen',t('board_tool_pen'),PenTool],
                ['eraser',t('board_tool_eraser'),Trash2],
                ['rect',t('board_tool_rect'),Square],
                ['circle',t('board_tool_circle'),Circle],
                ['ellipse',t('board_tool_ellipse'),Orbit],
                ['triangle',t('board_tool_triangle'),Triangle],
                ['rhombus',t('board_tool_rhombus'),Square],
                ['line',t('board_tool_line'),Minus],
                ['arrow',t('board_tool_arrow'),ArrowRight],
                ['vector',t('board_tool_vector'),Move],
                ['text',t('board_tool_text'),Type],
                ['coordinate',t('board_tool_coord'),Grid3X3],
                ['angle',t('board_tool_angle'),Compass],
              ] as const).map(([t,label,Icon])=>(
                <button key={t} onClick={()=>setTool(t as Tool)} className={`px-3 py-2.5 rounded-xl text-sm font-medium flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] ${tool===t?'bg-white shadow border border-blue-200 text-blue-700':'bg-transparent hover:bg-white'}`} title={label}><Icon size={18}/><span className="text-[11px]">{label}</span></button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border">
                <Palette size={16} className="text-slate-400"/>
                <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-9 h-9 rounded-lg border" title={t('board_stroke')}/>
                <input type="color" value={fill} onChange={e=>setFill(e.target.value)} className="w-9 h-9 rounded-lg border" title={t('board_fill')}/>
                <input type="range" min={1} max={24} value={width} onChange={e=>setWidth(parseInt(e.target.value))} className="w-24"/>
                <span className="text-sm w-8">{width}</span>
              </div>
              <label className="flex items-center gap-1 text-sm px-2 py-2 rounded-xl bg-slate-50 border cursor-pointer"><input type="checkbox" checked={grid} onChange={e=>{setGrid(e.target.checked); setTimeout(()=>initCanvas(),50)}}/> {t('board_grid')}</label>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-900 text-white overflow-auto">
              {([
                ['cube3d',t('board_tool_cube'),Box],
                ['sphere3d',t('board_tool_sphere'),Circle],
                ['cylinder3d',t('board_tool_cyl'),Box],
                ['cone3d',t('board_tool_cone'),Triangle],
                ['pyramid3d',t('board_tool_pyramid'),Triangle],
                ['prism3d',t('board_tool_prism'),Box],
                ['plane3d',t('board_tool_plane'),Square],
                ['orbit',t('board_tool_orbit'),Orbit],
                ['axis3d',t('board_tool_axis'),Grid3X3],
                ['pen',t('board_tool_pen'),Move],
              ] as const).map(([t,label,Icon])=>(
                <button key={t} onClick={()=>setTool(t as Tool)} className={`px-3 py-2.5 rounded-xl text-sm font-medium flex flex-col items-center gap-1 min-w-[64px] min-h-[56px] ${tool===t?'bg-white text-slate-900':'hover:bg-white/10'}`}><Icon size={18}/><span className="text-[11px]">{label}</span></button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-9 h-9 rounded-lg border"/>
              <input type="color" value={fill} onChange={e=>setFill(e.target.value)} className="w-9 h-9 rounded-lg border"/>
              <input type="range" min={1} max={24} value={width} onChange={e=>setWidth(parseInt(e.target.value))} className="w-24"/>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center justify-between pt-2 border-t">
          <div className="flex gap-2 flex-wrap">
            <button onClick={newBoard} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white flex items-center gap-2 text-sm font-bold min-h-[44px] hover:bg-emerald-700" title={t('board_new_hint')}><Plus size={18}/> {t('board_new')}</button>
            <button onClick={undo} disabled={historyIdx<=0} className="px-4 py-2.5 rounded-xl bg-slate-100 flex items-center gap-2 text-sm font-medium disabled:opacity-40 min-h-[44px]"><Undo2 size={18}/> {t('back')}</button>
            <button onClick={redo} disabled={historyIdx>=history.length-1} className="px-4 py-2.5 rounded-xl bg-slate-100 flex items-center gap-2 text-sm font-medium disabled:opacity-40 min-h-[44px]"><Redo2 size={18}/> {t('board_next')}</button>
            <button onClick={clear} className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-2 text-sm font-medium min-h-[44px]"><Trash2 size={18}/> {t('board_clear_sheet')}</button>
          </div>
          <div className="flex gap-2">
            <button onClick={download} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white flex items-center gap-2 text-sm font-medium min-h-[44px]"><Download size={18}/> {t('board_download')}</button>
            <button onClick={()=>setIsFullscreen(true)} className="px-3 py-2.5 rounded-xl bg-blue-600 text-white border text-sm hidden sm:flex items-center gap-1"><Maximize2 size={16}/> {t('board_fullscreen_btn')}</button>
          </div>
        </div>
        <div className="text-xs text-center text-slate-500">{t('board_bottom_hint')}</div>
      </div>

      {!hideRight && (
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="bg-white rounded-2xl border p-4 h-fit">
          <h3 className="font-bold">{t('board_sheets_in')}</h3>
          <div className="text-xs text-slate-500">{t('board_sheets_hint')}</div>
          <div className="flex gap-2 mt-3">
            {pages.map((_,idx)=>(
              <button key={idx} onClick={()=>switchPage(idx)} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold ${idx===currentPage?'bg-blue-600 text-white border-blue-600':'bg-white'}`}>{idx+1}</button>
            ))}
            <button onClick={addPage} className="w-12 h-12 rounded-xl border-2 border-dashed flex items-center justify-center"><Plus size={16}/></button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{t('board_mine')}</h3>
            <button onClick={()=>setHideRight(true)} className="text-xs px-2 py-1 rounded-lg bg-slate-100">{t('board_hide')}</button>
          </div>
          <div className="text-xs text-slate-500">{t('board_private_hint')}</div>
          <div className="space-y-2 max-h-[320px] overflow-auto">
            {boards.map(b=>(
              <button key={b.id} onClick={()=>loadBoard(b)} className="w-full text-left p-3 rounded-xl bg-slate-50 border hover:bg-white hover:shadow">
                <div className="font-medium text-sm line-clamp-1">{b.title}</div>
                <div className="text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString()} • {b.data?.mode||'2d'} • {b.data?.pages||1} {t('board_pages_short')}</div>
                {b.data?.image && b.data.image.startsWith('data:image/png') && <img src={b.data.image} className="mt-2 rounded-lg border w-full" referrerPolicy="no-referrer"/>}
              </button>
            ))}
            {boards.length===0 && <div className="text-sm text-slate-400 text-center py-6">{t('board_empty_a')}{t('save')}</div>}
          </div>
        </div>
      </div>
      )}
      {hideRight && (
        <div className="text-center">
          <button onClick={()=>setHideRight(false)} className="px-4 py-2 rounded-xl bg-white border text-sm">{t('board_show_side')}</button>
        </div>
      )}
    </div>
  )
}
