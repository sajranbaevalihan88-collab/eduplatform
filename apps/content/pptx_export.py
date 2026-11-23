"""Real .pptx exporter for EduPlatform presentations using python-pptx + Pillow.

Supports:
- 16:9 widescreen slides (13.333 in x 7.5 in)
- Solid, linear-gradient (Pillow rasterized cleanly for universal PowerPoint/Keynote/LibreOffice fidelity),
  and image slide backgrounds
- Native editable TextBoxes (rich paragraphs/runs, alignment, bold/italic/underline, colors, fill, rotation)
- Images (data URLs, local MEDIA_ROOT files, MediaBlob DB fallback, auto-conversion of WEBP -> PNG)
- Native editable PowerPoint AutoShapes (all 23 shapes + straight/arrow connector lines + text inside)
- Native editable PowerPoint Tables (6 themes, header row, zebra striping, custom column widths)
- Native editable PowerPoint Charts (bar, hbar, line, area, pie, donut with editable Excel data)
- Video hyperlink cards & Speaker Notes
"""

from __future__ import annotations

import base64
import io
import math
import os
import re
from typing import Any

from django.conf import settings
from PIL import Image, ImageDraw
from pptx import Presentation as PptxPresentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

SLIDE_W_IN = 13.333
SLIDE_H_IN = 7.5

TABLE_THEMES: dict[str, dict[str, str]] = {
    'blue': {'headerBg': '#2563eb', 'headerText': '#ffffff', 'zebraBg': '#eff6ff', 'cellBg': '#ffffff', 'text': '#0f172a'},
    'powerpoint': {'headerBg': '#b7472a', 'headerText': '#ffffff', 'zebraBg': '#fff7ed', 'cellBg': '#ffffff', 'text': '#1e293b'},
    'emerald': {'headerBg': '#059669', 'headerText': '#ffffff', 'zebraBg': '#ecfdf5', 'cellBg': '#ffffff', 'text': '#0f172a'},
    'violet': {'headerBg': '#4f46e5', 'headerText': '#ffffff', 'zebraBg': '#eef2ff', 'cellBg': '#ffffff', 'text': '#0f172a'},
    'slate': {'headerBg': '#1e293b', 'headerText': '#f8fafc', 'zebraBg': '#f1f5f9', 'cellBg': '#ffffff', 'text': '#0f172a'},
    'minimal': {'headerBg': '#f1f5f9', 'headerText': '#0f172a', 'zebraBg': '#f8fafc', 'cellBg': '#ffffff', 'text': '#1e293b'},
}

CHART_PALETTES: dict[str, list[str]] = {
    'corporate': ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'],
    'vibrant': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'],
    'emerald': ['#059669', '#10b981', '#34d399', '#0d9488', '#06b6d4', '#0284c7', '#2563eb'],
    'warm': ['#b7472a', '#ea580c', '#f59e0b', '#eab308', '#e11d48', '#db2777', '#9333ea'],
    'pastel': ['#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#38bdf8'],
    'mono': ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#2563eb', '#0284c7'],
}

SHAPE_MAP: dict[str, Any] = {
    'rect': MSO_SHAPE.RECTANGLE,
    'rounded': MSO_SHAPE.ROUNDED_RECTANGLE,
    'circle': MSO_SHAPE.OVAL,
    'ellipse': MSO_SHAPE.OVAL,
    'triangle': MSO_SHAPE.ISOSCELES_TRIANGLE,
    'rightTriangle': MSO_SHAPE.RIGHT_TRIANGLE,
    'diamond': MSO_SHAPE.DIAMOND,
    'pentagon': MSO_SHAPE.REGULAR_PENTAGON,
    'hexagon': MSO_SHAPE.HEXAGON,
    'arrow': MSO_SHAPE.RIGHT_ARROW,
    'arrowLeft': MSO_SHAPE.LEFT_ARROW,
    'arrowUp': MSO_SHAPE.UP_ARROW,
    'arrowDown': MSO_SHAPE.DOWN_ARROW,
    'arrowBoth': MSO_SHAPE.LEFT_RIGHT_ARROW,
    'callout': MSO_SHAPE.ROUNDED_RECTANGULAR_CALLOUT,
    'chevron': MSO_SHAPE.CHEVRON,
    'parallelogram': MSO_SHAPE.PARALLELOGRAM,
    'trapezoid': MSO_SHAPE.TRAPEZOID,
    'star': MSO_SHAPE.STAR_5_POINT,
    'heart': MSO_SHAPE.HEART,
    'plus': MSO_SHAPE.MATH_PLUS,
    'badge': MSO_SHAPE.PENTAGON,
}

CHART_TYPE_MAP: dict[str, Any] = {
    'bar': XL_CHART_TYPE.COLUMN_CLUSTERED,
    'hbar': XL_CHART_TYPE.BAR_CLUSTERED,
    'line': XL_CHART_TYPE.LINE_MARKERS,
    'area': XL_CHART_TYPE.AREA,
    'pie': XL_CHART_TYPE.PIE,
    'donut': XL_CHART_TYPE.DOUGHNUT,
}


def _parse_rgb(color: Any, fallback: tuple[int, int, int] | None = None) -> RGBColor | None:
    if not color or not isinstance(color, str):
        return RGBColor(*fallback) if fallback else None
    s = color.strip().lower()
    if s in ('none', 'transparent', 'inherit', 'initial'):
        return None
    if s.startswith('#'):
        h = s[1:]
        if len(h) == 3:
            h = ''.join(ch * 2 for ch in h)
        if len(h) >= 6:
            try:
                return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
            except Exception:
                pass
    m = re.match(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', s)
    if m:
        try:
            return RGBColor(
                max(0, min(255, int(m.group(1)))),
                max(0, min(255, int(m.group(2)))),
                max(0, min(255, int(m.group(3)))),
            )
        except Exception:
            pass
    named = {
        'white': (255, 255, 255),
        'black': (0, 0, 0),
        'red': (220, 38, 38),
        'blue': (37, 99, 235),
        'green': (22, 163, 74),
        'yellow': (234, 179, 8),
        'gray': (100, 116, 139),
        'grey': (100, 116, 139),
    }
    if s in named:
        return RGBColor(*named[s])
    return RGBColor(*fallback) if fallback else None


def _parse_align(align: Any) -> Any:
    a = str(align or 'left').lower()
    if a == 'center':
        return PP_ALIGN.CENTER
    if a == 'right':
        return PP_ALIGN.RIGHT
    if a == 'justify':
        return PP_ALIGN.JUSTIFY
    return PP_ALIGN.LEFT


def _parse_valign(valign: Any) -> Any:
    v = str(valign or 'top').lower()
    if v == 'middle':
        return MSO_ANCHOR.MIDDLE
    if v == 'bottom':
        return MSO_ANCHOR.BOTTOM
    return MSO_ANCHOR.TOP


def _to_float(val: Any, default: float) -> float:
    try:
        if val is None or val == '':
            return default
        return float(val)
    except Exception:
        return default


def _pct_box(st: dict[str, Any], default_w: float = 80.0, default_h: float = 20.0):
    x = max(0.0, min(98.0, _to_float(st.get('x'), 5.0)))
    y = max(0.0, min(98.0, _to_float(st.get('y'), 5.0)))
    w = max(2.0, min(100.0 - x, _to_float(st.get('w'), default_w)))
    h = max(2.0, min(100.0 - y, _to_float(st.get('h'), default_h)))
    return (
        Inches((x / 100.0) * SLIDE_W_IN),
        Inches((y / 100.0) * SLIDE_H_IN),
        Inches((w / 100.0) * SLIDE_W_IN),
        Inches((h / 100.0) * SLIDE_H_IN),
    )


def _render_gradient_png(grad_css: str, width: int = 960, height: int = 540) -> bytes | None:
    """Render a CSS linear-gradient(...) string into a crisp RGB PNG via Pillow."""
    hexes = re.findall(r'#[0-9a-fA-F]{3,6}', grad_css or '')
    colors: list[tuple[int, int, int]] = []
    for hx in hexes:
        rgb = _parse_rgb(hx)
        if rgb is not None:
            colors.append((rgb[0], rgb[1], rgb[2]))
    if len(colors) < 2:
        return None
    angle_m = re.search(r'(-?\d+(?:\.\d+)?)deg', grad_css or '')
    angle_deg = float(angle_m.group(1)) if angle_m else 135.0
    rad = math.radians(angle_deg)
    dx, dy = math.sin(rad), -math.cos(rad)

    # Render at modest resolution and upscale smoothly for fast generation
    rw, rh = 320, 180
    img = Image.new('RGB', (rw, rh))
    px = img.load()
    n_seg = len(colors) - 1
    for yy in range(rh):
        ny = (yy / max(1, rh - 1)) - 0.5
        for xx in range(rw):
            nx = (xx / max(1, rw - 1)) - 0.5
            t = max(0.0, min(1.0, (nx * dx + ny * dy) + 0.5))
            pos = t * n_seg
            idx = min(n_seg - 1, int(pos))
            frac = pos - idx
            c0, c1 = colors[idx], colors[idx + 1]
            px[xx, yy] = (
                int(c0[0] + (c1[0] - c0[0]) * frac),
                int(c0[1] + (c1[1] - c0[1]) * frac),
                int(c0[2] + (c1[2] - c0[2]) * frac),
            )
    img = img.resize((width, height), Image.Resampling.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def _load_image_bytes(src: str) -> bytes | None:
    """Load image bytes from data URL (raster only) or authorized public pptx_images/ media.
    Converts WEBP/unsupported formats into PNG so PowerPoint always displays them.
    Blocks path traversal, absolute/UNC paths, SVG, and private media folders (receipts/uploads/achievements)."""
    if not src or not isinstance(src, str):
        return None
    raw: bytes | None = None
    s = src.strip()
    s_low = s.lower()

    if s_low.startswith('data:image/'):
        if s_low.startswith('data:image/svg'):
            return None
        try:
            header, payload = s.split(',', 1)
            if len(payload) > 7_000_000:
                return None
            if ';base64' in header.lower():
                raw = base64.b64decode(payload, validate=False)
            else:
                from urllib.parse import unquote_to_bytes
                raw = unquote_to_bytes(payload)
        except Exception:
            return None
    else:
        # Разрешаем локальное чтение ТОЛЬКО из публичной папки pptx_images/
        rel = None
        if '/media/' in s:
            rel = s.split('/media/', 1)[1].split('?', 1)[0].split('#', 1)[0]
        elif not s_low.startswith(('http://', 'https://', 'javascript:', 'file:', 'data:')):
            rel = s.split('?', 1)[0].split('#', 1)[0]
        if rel:
            rel = rel.replace('\\', '/').lstrip('/')
            if not rel or '..' in rel.split('/') or ':' in rel or not rel.startswith('pptx_images/'):
                return None
            if rel.lower().endswith('.svg'):
                return None
            from pathlib import Path
            media_root = Path(str(getattr(settings, 'MEDIA_ROOT', 'media'))).resolve()
            allowed_dir = (media_root / 'pptx_images').resolve()
            target = (media_root / rel).resolve()
            try:
                target.relative_to(allowed_dir)
            except ValueError:
                return None
            if target.is_file():
                try:
                    if target.stat().st_size <= 8 * 1024 * 1024:
                        raw = target.read_bytes()
                except Exception:
                    raw = None
            if raw is None:
                try:
                    from apps.content.models import MediaBlob
                    blob = MediaBlob.objects.filter(key=rel).first()
                    if blob and blob.data and len(blob.data) <= 8 * 1024 * 1024:
                        raw = bytes(blob.data)
                except Exception:
                    raw = None

    if not raw or len(raw) > 8 * 1024 * 1024:
        return None

    # Validate & normalize via Pillow (converts WEBP / CMYK / odd modes cleanly to PNG/JPEG)
    try:
        with Image.open(io.BytesIO(raw)) as im:
            fmt = (im.format or '').upper()
            if fmt in ('PNG', 'JPEG', 'JPG', 'GIF', 'BMP'):
                return raw
            out = io.BytesIO()
            im.convert('RGBA').save(out, format='PNG')
            return out.getvalue()
    except Exception:
        return None


def _apply_slide_background(slide, sdata: dict[str, Any]):
    bg_type = str(sdata.get('backgroundType') or sdata.get('background_type') or 'solid').lower()
    grad = str(sdata.get('gradient') or '')
    bg_img = str(sdata.get('bgImage') or sdata.get('bg_image') or '')
    bg_val = str(sdata.get('background') or '#ffffff')

    # Image background
    img_src = ''
    if bg_type == 'image' and bg_img:
        img_src = bg_img
    elif bg_img.startswith(('data:image/', '/media/')):
        img_src = bg_img
    elif bg_val.startswith('url('):
        m = re.match(r'url\(["\']?([^"\')]+)["\']?\)', bg_val)
        if m:
            img_src = m.group(1)

    if img_src:
        img_bytes = _load_image_bytes(img_src)
        if img_bytes:
            slide.shapes.add_picture(io.BytesIO(img_bytes), Inches(0), Inches(0), Inches(SLIDE_W_IN), Inches(SLIDE_H_IN))
            return

    # Gradient background
    grad_css = grad if grad.startswith(('linear-gradient', 'radial-gradient')) else (
        bg_val if bg_val.startswith(('linear-gradient', 'radial-gradient')) else ''
    )
    if grad_css:
        png = _render_gradient_png(grad_css)
        if png:
            slide.shapes.add_picture(io.BytesIO(png), Inches(0), Inches(0), Inches(SLIDE_W_IN), Inches(SLIDE_H_IN))
            return

    # Solid background
    rgb = _parse_rgb(bg_val, (255, 255, 255))
    if rgb is not None:
        fill = slide.background.fill
        fill.solid()
        fill.fore_color.rgb = rgb


def _add_text_block(slide, block: dict[str, Any]):
    st = block.get('style') or {}
    left, top, width, height = _pct_box(st, 80.0, 18.0)
    tb = slide.shapes.add_textbox(left, top, width, height)
    rot = _to_float(st.get('rotation'), 0.0)
    if rot:
        tb.rotation = rot

    bg_rgb = _parse_rgb(st.get('background') or st.get('bg'))
    if bg_rgb is not None:
        tb.fill.solid()
        tb.fill.fore_color.rgb = bg_rgb

    border_rgb = _parse_rgb(st.get('borderColor'))
    if border_rgb is not None and _to_float(st.get('borderWidth'), 0) > 0:
        tb.line.color.rgb = border_rgb
        tb.line.width = Pt(_to_float(st.get('borderWidth'), 1))

    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = _parse_valign(st.get('verticalAlign'))
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    tf.margin_top = Inches(0.05)
    tf.margin_bottom = Inches(0.05)

    base_font_px = _to_float(st.get('fontSize'), 22.0)
    base_color = _parse_rgb(st.get('color'), (15, 23, 42))
    base_font_name = st.get('fontFamily') or 'Arial'
    base_bold = bool(st.get('bold'))
    base_italic = bool(st.get('italic'))
    base_underline = bool(st.get('underline'))
    base_align = _parse_align(st.get('align'))

    paragraphs = block.get('paragraphs') or st.get('paragraphs')
    if isinstance(paragraphs, list) and paragraphs:
        for pi, pdata in enumerate(paragraphs):
            p = tf.paragraphs[0] if pi == 0 else tf.add_paragraph()
            p.alignment = _parse_align(pdata.get('align') or st.get('align'))
            p.level = int(_to_float(pdata.get('level'), 0))
            runs = pdata.get('runs') if isinstance(pdata.get('runs'), list) else []
            if not runs:
                r = p.add_run()
                r.text = str(pdata.get('text') or '')
                r.font.size = Pt(max(8, round(base_font_px * 0.78)))
                r.font.name = base_font_name
                if base_color:
                    r.font.color.rgb = base_color
                continue
            for rdata in runs:
                r = p.add_run()
                r.text = str(rdata.get('text') or '')
                rst = rdata.get('style') or {}
                fpx = _to_float(rst.get('fontSize'), base_font_px)
                r.font.size = Pt(max(8, round(fpx * 0.78)))
                r.font.name = rst.get('fontFamily') or base_font_name
                r.font.bold = bool(rst.get('bold')) if 'bold' in rst else base_bold
                r.font.italic = bool(rst.get('italic')) if 'italic' in rst else base_italic
                r.font.underline = bool(rst.get('underline')) if 'underline' in rst else base_underline
                rcol = _parse_rgb(rst.get('color')) or base_color
                if rcol:
                    r.font.color.rgb = rcol
    else:
        raw_text = str(block.get('content') or '')
        lines = raw_text.split('\n') if raw_text else ['']
        for pi, line in enumerate(lines):
            p = tf.paragraphs[0] if pi == 0 else tf.add_paragraph()
            p.alignment = base_align
            r = p.add_run()
            r.text = line
            r.font.size = Pt(max(8, round(base_font_px * 0.78)))
            r.font.name = base_font_name
            r.font.bold = base_bold
            r.font.italic = base_italic
            r.font.underline = base_underline
            if base_color:
                r.font.color.rgb = base_color


def _add_image_block(slide, block: dict[str, Any]):
    st = block.get('style') or {}
    src = str(block.get('src') or block.get('content') or '')
    img_bytes = _load_image_bytes(src)
    if not img_bytes:
        return
    left, top, width, height = _pct_box(st, 40.0, 40.0)
    pic = slide.shapes.add_picture(io.BytesIO(img_bytes), left, top, width, height)
    rot = _to_float(st.get('rotation'), 0.0)
    if rot:
        pic.rotation = rot


def _add_shape_block(slide, block: dict[str, Any]):
    st = block.get('style') or {}
    left, top, width, height = _pct_box(st, 28.0, 22.0)
    kind = str(block.get('shape') or st.get('shape') or 'rect')
    fill_raw = st.get('bg') or st.get('background') or st.get('fill') or '#3b82f6'
    stroke_raw = st.get('stroke') or st.get('borderColor') or '#1d4ed8'
    stroke_w = _to_float(st.get('strokeWidth'), 2.0)
    dash = str(st.get('dash') or 'solid').lower()

    if kind in ('line', 'lineArrow'):
        mid_y = top + height // 2
        conn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, left, mid_y, left + width, mid_y)
        line_rgb = _parse_rgb(stroke_raw) or _parse_rgb(fill_raw) or RGBColor(37, 99, 235)
        conn.line.color.rgb = line_rgb
        conn.line.width = Pt(max(1.5, stroke_w))
        if dash == 'dashed':
            conn.line.dash_style = MSO_LINE_DASH_STYLE.DASH
        elif dash == 'dotted':
            conn.line.dash_style = MSO_LINE_DASH_STYLE.ROUND_DOT
        return

    mso = SHAPE_MAP.get(kind, MSO_SHAPE.RECTANGLE)
    shp = slide.shapes.add_shape(mso, left, top, width, height)
    rot = _to_float(st.get('rotation'), 0.0)
    if rot:
        shp.rotation = rot

    # Fill (solid or first stop of gradient)
    fill_str = str(fill_raw)
    if fill_str.startswith(('linear-gradient', 'radial-gradient')):
        hx = re.findall(r'#[0-9a-fA-F]{3,6}', fill_str)
        fill_rgb = _parse_rgb(hx[0] if hx else '#3b82f6', (59, 130, 246))
    else:
        fill_rgb = _parse_rgb(fill_str)
    if fill_rgb is not None:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill_rgb
    else:
        shp.fill.background()

    stroke_rgb = _parse_rgb(stroke_raw)
    if stroke_rgb is not None and stroke_w > 0:
        shp.line.color.rgb = stroke_rgb
        shp.line.width = Pt(max(0.75, stroke_w * 0.75))
        if dash == 'dashed':
            shp.line.dash_style = MSO_LINE_DASH_STYLE.DASH
        elif dash == 'dotted':
            shp.line.dash_style = MSO_LINE_DASH_STYLE.ROUND_DOT
    else:
        shp.line.fill.background()

    label = str(block.get('content') or '').strip()
    if label:
        tf = shp.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = _parse_align(st.get('textAlign') or 'center')
        r = p.add_run()
        r.text = label
        r.font.size = Pt(max(10, round(_to_float(st.get('textSize') or st.get('fontSize'), 18.0) * 0.78)))
        r.font.bold = st.get('textBold') is not False
        tcol = _parse_rgb(st.get('textColor') or st.get('color'), (255, 255, 255))
        if tcol:
            r.font.color.rgb = tcol


def _add_table_block(slide, block: dict[str, Any]):
    st = block.get('style') or {}
    tbl_data = block.get('table') or {}
    cells_raw = tbl_data.get('cells') or []
    rows = max(1, min(50, int(_to_float(tbl_data.get('rows'), len(cells_raw) or 3))))
    cols = max(1, min(30, int(_to_float(tbl_data.get('cols'), len(cells_raw[0]) if cells_raw else 3))))
    theme = TABLE_THEMES.get(str(tbl_data.get('theme') or 'blue'), TABLE_THEMES['blue'])
    header_row = tbl_data.get('headerRow') is not False
    striped = tbl_data.get('striped') is not False
    font_px = _to_float(tbl_data.get('fontSize'), 13.0)
    align = _parse_align(tbl_data.get('align') or 'left')

    left, top, width, height = _pct_box(st, 78.0, 42.0)
    table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table

    col_widths = tbl_data.get('colWidths')
    if isinstance(col_widths, list) and len(col_widths) == cols:
        total_w = sum(_to_float(w, 100.0 / cols) for w in col_widths) or 100.0
        for ci, cw in enumerate(col_widths):
            table.columns[ci].width = int(width * (_to_float(cw, 100.0 / cols) / total_w))

    hdr_bg = _parse_rgb(theme['headerBg'], (37, 99, 235))
    hdr_fg = _parse_rgb(theme['headerText'], (255, 255, 255))
    zebra_bg = _parse_rgb(theme['zebraBg'], (239, 246, 255))
    cell_bg = _parse_rgb(theme['cellBg'], (255, 255, 255))
    text_fg = _parse_rgb(theme['text'], (15, 23, 42))

    for r_idx in range(rows):
        row_arr = cells_raw[r_idx] if r_idx < len(cells_raw) else []
        is_hdr = header_row and r_idx == 0
        for c_idx in range(cols):
            cell_obj = row_arr[c_idx] if c_idx < len(row_arr) else {}
            if isinstance(cell_obj, dict):
                txt = str(cell_obj.get('text') or '')
                cst = cell_obj.get('style') or {}
            else:
                txt = str(cell_obj or '')
                cst = {}
            cell = table.cell(r_idx, c_idx)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            fill_rgb = _parse_rgb(cst.get('bg'))
            if fill_rgb is None:
                if is_hdr:
                    fill_rgb = hdr_bg
                elif striped and r_idx % 2 == 0:
                    fill_rgb = zebra_bg
                else:
                    fill_rgb = cell_bg
            if fill_rgb is not None:
                cell.fill.solid()
                cell.fill.fore_color.rgb = fill_rgb

            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.alignment = _parse_align(cst.get('align')) if cst.get('align') else align
            run = p.add_run()
            run.text = txt
            run.font.size = Pt(max(9, round(font_px * 0.85)))
            run.font.bold = is_hdr or bool(cst.get('bold'))
            run.font.italic = bool(cst.get('italic'))
            fg = _parse_rgb(cst.get('color')) or (hdr_fg if is_hdr else text_fg)
            if fg:
                run.font.color.rgb = fg


def _add_chart_block(slide, block: dict[str, Any]):
    st = block.get('style') or {}
    cd = block.get('chartData') or {}
    chart_kind = str(st.get('chartType') or cd.get('chartType') or 'bar').lower()
    xl_type = CHART_TYPE_MAP.get(chart_kind, XL_CHART_TYPE.COLUMN_CLUSTERED)

    raw_vals = cd.get('values') if isinstance(cd.get('values'), list) and cd.get('values') else [68, 82, 75, 94]
    values = [_to_float(v, 0.0) for v in raw_vals]
    raw_labels = cd.get('labels') if isinstance(cd.get('labels'), list) and cd.get('labels') else []
    labels = [str(raw_labels[i]) if i < len(raw_labels) else f'Пункт {i + 1}' for i in range(len(values))]

    chart_data = CategoryChartData()
    chart_data.categories = labels
    series_title = str(cd.get('title') or 'Значения')
    chart_data.add_series(series_title, values)

    left, top, width, height = _pct_box(st, 66.0, 52.0)
    graphic_frame = slide.shapes.add_chart(xl_type, left, top, width, height, chart_data)
    chart = graphic_frame.chart

    title_text = str(cd.get('title') or '').strip()
    if title_text:
        chart.has_title = True
        chart.chart_title.text_frame.text = title_text
        for p in chart.chart_title.text_frame.paragraphs:
            for r in p.runs:
                r.font.size = Pt(14)
                r.font.bold = True

    show_legend = cd.get('showLegend') is not False
    chart.has_legend = show_legend
    if show_legend:
        chart.legend.position = XL_LEGEND_POSITION.BOTTOM
        chart.legend.include_in_layout = False

    # Apply custom palette colors to series/points
    pal_name = str(cd.get('palette') or 'corporate')
    pal = CHART_PALETTES.get(pal_name, CHART_PALETTES['corporate'])
    custom_colors = cd.get('colors') if isinstance(cd.get('colors'), list) else []
    try:
        series = chart.series[0]
        if chart_kind in ('pie', 'donut', 'bar', 'hbar'):
            for idx in range(len(values)):
                c_str = custom_colors[idx] if idx < len(custom_colors) and custom_colors[idx] else pal[idx % len(pal)]
                rgb = _parse_rgb(c_str)
                if rgb:
                    pt = series.points[idx]
                    pt.format.fill.solid()
                    pt.format.fill.fore_color.rgb = rgb
        else:
            c_str = custom_colors[0] if custom_colors and custom_colors[0] else pal[0]
            rgb = _parse_rgb(c_str)
            if rgb:
                series.format.line.color.rgb = rgb
                if chart_kind == 'area':
                    series.format.fill.solid()
                    series.format.fill.fore_color.rgb = rgb
    except Exception:
        pass


def _add_video_block(slide, block: dict[str, Any]):
    st = block.get('style') or {}
    left, top, width, height = _pct_box(st, 56.0, 44.0)
    url = str(block.get('src') or block.get('content') or '').strip()
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(15, 23, 42)
    shp.line.color.rgb = RGBColor(51, 65, 85)
    tf = shp.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = f'▶ Видео\n{url}' if url else '▶ Видео'
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(226, 232, 240)
    if url.startswith(('http://', 'https://')):
        r.hyperlink.address = url


def build_pptx_bytes(title: str, slides_data: list[dict[str, Any]]) -> bytes:
    """Build a complete 16:9 .pptx file in memory and return its bytes."""
    prs = PptxPresentation()
    prs.slide_width = Inches(SLIDE_W_IN)
    prs.slide_height = Inches(SLIDE_H_IN)
    try:
        prs.core_properties.title = (title or 'Презентация')[:200]
        prs.core_properties.author = 'EduPlatform'
    except Exception:
        pass

    blank_layout = prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[-1]

    for sdata in (slides_data or []):
        if not isinstance(sdata, dict):
            continue
        slide = prs.slides.add_slide(blank_layout)
        _apply_slide_background(slide, sdata)

        content = sdata.get('content') if isinstance(sdata.get('content'), dict) else {}
        blocks = content.get('blocks') if isinstance(content.get('blocks'), list) else []
        ordered = sorted(
            enumerate(blocks),
            key=lambda pair: _to_float((pair[1].get('style') or {}).get('zIndex'), pair[0]),
        )

        for _, block in ordered:
            if not isinstance(block, dict):
                continue
            btype = str(block.get('type') or 'text').lower()
            try:
                if btype == 'text':
                    _add_text_block(slide, block)
                elif btype == 'image':
                    _add_image_block(slide, block)
                elif btype == 'shape':
                    _add_shape_block(slide, block)
                elif btype == 'table':
                    _add_table_block(slide, block)
                elif btype == 'chart':
                    _add_chart_block(slide, block)
                elif btype == 'video':
                    _add_video_block(slide, block)
            except Exception:
                # Never abort the whole export because of one malformed block
                continue

        notes_text = str(sdata.get('notes') or '').strip()
        if notes_text:
            try:
                slide.notes_slide.notes_text_frame.text = notes_text
            except Exception:
                pass

    if len(prs.slides) == 0:
        prs.slides.add_slide(blank_layout)

    out = io.BytesIO()
    prs.save(out)
    return out.getvalue()
