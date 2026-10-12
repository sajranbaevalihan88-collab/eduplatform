"""Мини-Word: хранение документов + импорт/экспорт .docx до 20МБ (python-docx)."""
import base64
import io
import os
import re
from html import escape
from html.parser import HTMLParser

from django.http import FileResponse
from rest_framework import permissions, throttling, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import WordDocument
from .serializers import WordDocumentSerializer

# Лимит импорта Word — 20МБ по ТЗ (стенд + жюри)
WORD_IMPORT_MAX_BYTES = 20 * 1024 * 1024

_ALLOWED_TAGS = {'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'u', 's',
                 'a', 'table', 'tr', 'td', 'th', 'img', 'br', 'blockquote', 'span'}
_ALLOWED_ATTRS = {'href', 'src', 'alt', 'style', 'colspan', 'rowspan'}


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.div_stack = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == 'div':
            # храним только разрывы страниц, остальное разворачиваем на фронте
            cls = ''
            for k, v in attrs:
                if k == 'class' and isinstance(v, str):
                    cls = v
            if 'page-break' in cls:
                self.out.append('<div class="page-break">')
                self.div_stack.append(True)
            else:
                self.div_stack.append(False)
            return
        if tag not in _ALLOWED_TAGS:
            return
        if tag == 'a':
            href = ''
            for k, v in attrs:
                if k == 'href' and isinstance(v, str) and v.startswith(('http://', 'https://', 'mailto:')):
                    href = v[:500]
            self.out.append(f'<a href="{escape(href, quote=True)}">' if href else '<a>')
            return
        if tag == 'img':
            src = ''
            for k, v in attrs:
                if k == 'src' and isinstance(v, str) and (v.startswith('data:image/') or v.startswith(('http://', 'https://'))):
                    src = v[:2000000]
            self.out.append(f'<img src="{escape(src, quote=True)}" alt="">' if src else '')
            return
        style = ''
        for k, v in attrs:
            if k == 'style' and isinstance(v, str):
                m = re.findall(r'(text-align\s*:\s*(left|center|right|justify)|color\s*:\s*#[0-9a-fA-F]{3,6}|background-color\s*:\s*#[0-9a-fA-F]{3,6}|font-size\s*:\s*\d{1,3}px)', v)
                if m:
                    style = '; '.join(x[0] for x in m)[:200]
        extra = ''
        if tag in ('td', 'th'):
            for k, v in attrs:
                if k in ('colspan', 'rowspan') and str(v).isdigit():
                    extra += f' {k}="{min(20, int(v))}"'
        self.out.append(f'<{tag}{extra} style="{escape(style, quote=True)}">' if style else f'<{tag}{extra}>')

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == 'div':
            kept = self.div_stack.pop() if self.div_stack else False
            if kept:
                self.out.append('</div>')
            return
        if tag in _ALLOWED_TAGS and tag not in ('img', 'br'):
            self.out.append(f'</{tag}>')

    def handle_data(self, data):
        self.out.append(escape(data))

    def handle_entityref(self, name):
        self.out.append(f'&{name};')

    def handle_charref(self, name):
        self.out.append(f'&#{name};')


def sanitize_html(html: str, limit: int = 500000) -> str:
    s = _Sanitizer()
    try:
        s.feed(str(html or '')[:limit])
    except Exception:
        pass
    return ''.join(s.out)[:limit]


W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def _has_page_break(paragraph) -> bool:
    """Ctrl+Enter из Word (<w:br w:type="page"/>) — без xpath, прямым обходом."""
    try:
        for el in paragraph._p.iter():
            if not isinstance(getattr(el, 'tag', None), str):
                continue
            if el.tag == f'{{{W_NS}}}br' and el.get(f'{{{W_NS}}}type') == 'page':
                return True
    except Exception:
        pass
    return False


def _runs_html(paragraph) -> str:
    parts = []
    for r in paragraph.runs:
        t = escape(r.text or '')
        if not t:
            continue
        if getattr(r, 'bold', False):
            t = f'<strong>{t}</strong>'
        if getattr(r, 'italic', False):
            t = f'<em>{t}</em>'
        if getattr(r, 'underline', False):
            t = f'<u>{t}</u>'
        try:
            if r.font.strike:
                t = f'<s>{t}</s>'
        except Exception:
            pass
        parts.append(t)
    return ''.join(parts)


def docx_to_html(path: str):
    """Парсит .docx в HTML. Возвращает (title, body_html, stats)."""
    from docx import Document as DocxDocument
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = DocxDocument(path)
    title = ''
    try:
        core = doc.core_properties
        if core and core.title:
            title = str(core.title)[:200]
    except Exception:
        pass

    align_map = {
        WD_ALIGN_PARAGRAPH.LEFT: 'left',
        WD_ALIGN_PARAGRAPH.CENTER: 'center',
        WD_ALIGN_PARAGRAPH.RIGHT: 'right',
        WD_ALIGN_PARAGRAPH.JUSTIFY: 'justify',
    }

    chunks = []
    open_list = None  # 'ul' | 'ol' | None
    tables_n = 0
    paras_n = 0

    def close_list():
        nonlocal open_list
        if open_list:
            chunks.append(f'</{open_list}>')
            open_list = None

    def table_html(table):
        rows = []
        for row in table.rows:
            cells = []
            for cell in row.cells:
                txt = ' '.join((p.text or '').strip() for p in cell.paragraphs).strip()
                cells.append(f'<td>{escape(txt)}</td>')
            rows.append(f"<tr>{''.join(cells)}</tr>")
        return f"<table border=\"1\">{''.join(rows)}</table>"

    body = doc.element.body
    for child in body:
        tag = child.tag.split('}')[-1] if isinstance(getattr(child, 'tag', None), str) else ''
        if tag == 'tbl':
            from docx.table import Table as DocxTable
            close_list()
            try:
                chunks.append(table_html(DocxTable(child, doc)))
                tables_n += 1
            except Exception:
                pass
            continue
        if tag != 'p':
            continue
        from docx.text.paragraph import Paragraph as DocxPara
        try:
            p = DocxPara(child, doc)
        except Exception:
            continue
        style_name = ''
        try:
            style_name = (p.style.name or '')
        except Exception:
            pass
        inner = _runs_html(p)
        # разрыв страницы внутри абзаца (Ctrl+Enter в Word) -> маркер нового листа
        if _has_page_break(p):
            close_list()
            chunks.append('<div class="page-break">Новая страница</div>')
            continue
        if not inner.strip():
            continue
        paras_n += 1
        if not title and len(inner) > 3:
            title = re.sub(r'<[^>]+>', '', inner)[:200]

        if style_name.startswith('Heading'):
            close_list()
            level = 'h1'
            if 'Heading 2' in style_name:
                level = 'h2'
            elif 'Heading 3' in style_name or 'Heading 4' in style_name:
                level = 'h3'
            chunks.append(f'<{level}>{inner}</{level}>')
            continue
        if style_name == 'Title':
            close_list()
            chunks.append(f'<h1>{inner}</h1>')
            continue
        is_bullet = 'List Bullet' in style_name or 'Bullet' in style_name
        is_number = 'List Number' in style_name or 'Number' in style_name
        if is_bullet or is_number:
            want = 'ul' if is_bullet else 'ol'
            if open_list != want:
                close_list()
                chunks.append(f'<{want}>')
                open_list = want
            chunks.append(f'<li>{inner}</li>')
            continue
        close_list()
        align = ''
        try:
            a = p.alignment
            if a in align_map:
                align = align_map[a]
        except Exception:
            pass
        if align and align != 'left':
            chunks.append(f'<p style="text-align: {align}">{inner}</p>')
        else:
            chunks.append(f'<p>{inner}</p>')

    close_list()
    try:
        images_n = len(doc.inline_shapes)
    except Exception:
        images_n = 0
    return title, ''.join(chunks), {'paragraphs': paras_n, 'tables': tables_n, 'images_skipped': images_n}


class _HtmlToDocx(HTMLParser):
    """Простой конвертер HTML редактора -> python-docx (h1-h3/p/ul/ol/table)."""

    def __init__(self, doc):
        super().__init__(convert_charrefs=True)
        self.doc = doc
        self.block = None  # dict: {type, align, items?}
        self.marks = []
        self.buf = ''

    def _flush_run(self, para, text):
        if not text:
            return
        run = para.add_run(text)
        if 'b' in self.marks:
            run.bold = True
        if 'i' in self.marks:
            run.italic = True
        if 'u' in self.marks:
            run.underline = True
        if 's' in self.marks:
            try:
                run.font.strike = True
            except Exception:
                pass

    def _new_block(self, btype, attrs):
        self._close_block()
        align = None
        for k, v in attrs:
            if k == 'style' and isinstance(v, str):
                m = re.search(r'text-align\s*:\s*(left|center|right|justify)', v)
                if m:
                    align = m.group(1)
        if btype in ('ul', 'ol'):
            self.block = {'type': btype, 'align': align, 'items': [], 'cur': ''}
        else:
            self.block = {'type': btype, 'align': align, 'runs': []}

    def _close_block(self):
        b = self.block
        self.block = None
        if not b:
            return
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        amap = {'left': WD_ALIGN_PARAGRAPH.LEFT, 'center': WD_ALIGN_PARAGRAPH.CENTER,
                'right': WD_ALIGN_PARAGRAPH.RIGHT, 'justify': WD_ALIGN_PARAGRAPH.JUSTIFY}
        if b['type'] in ('ul', 'ol'):
            for item in b.get('items', []):
                if not item.strip():
                    continue
                style = 'List Bullet' if b['type'] == 'ul' else 'List Number'
                try:
                    p = self.doc.add_paragraph(item.strip(), style=style)
                except Exception:
                    p = self.doc.add_paragraph(item.strip())
                if b.get('align') in amap:
                    p.alignment = amap[b['align']]
            return
        if b['type'] == 'table':
            return  # таблицы собираем отдельно через _TableBuilder (см. ниже)
        if b['type'] in ('h1', 'h2', 'h3'):
            level = {'h1': 1, 'h2': 2, 'h3': 3}[b['type']]
            text = ''.join(t for _, t in b.get('runs', []))
            if text.strip():
                try:
                    self.doc.add_heading(text.strip(), level=level)
                except Exception:
                    self.doc.add_paragraph(text.strip())
            return
        p = self.doc.add_paragraph()
        for mark_set, text in b.get('runs', []):
            if not text:
                continue
            run = p.add_run(text)
            if 'b' in mark_set:
                run.bold = True
            if 'i' in mark_set:
                run.italic = True
            if 'u' in mark_set:
                run.underline = True
            if 's' in mark_set:
                try:
                    run.font.strike = True
                except Exception:
                    pass
        if b.get('align') in amap:
            p.alignment = amap[b['align']]

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ('h1', 'h2', 'h3', 'p', 'blockquote'):
            self._new_block(tag if tag in ('h1', 'h2', 'h3') else 'p', attrs)
        elif tag in ('ul', 'ol'):
            self._new_block(tag, attrs)
        elif tag == 'li':
            if self.block and self.block.get('type') in ('ul', 'ol'):
                self.block['cur'] = ''
            else:
                self._new_block('ul', [])
                self.block['cur'] = ''
        elif tag in ('strong', 'b'):
            self.marks.append('b')
        elif tag in ('em', 'i'):
            self.marks.append('i')
        elif tag == 'u':
            self.marks.append('u')
        elif tag == 's':
            self.marks.append('s')
        elif tag == 'br':
            self.handle_data('\n')

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('h1', 'h2', 'h3', 'p', 'blockquote', 'ul', 'ol'):
            if self.block and tag == self.block.get('type'):
                self._close_block()
            elif tag in ('ul', 'ol') and self.block and self.block.get('type') in ('ul', 'ol'):
                self._close_block()
        elif tag == 'li':
            if self.block and self.block.get('type') in ('ul', 'ol'):
                self.block['items'].append(self.block.get('cur', ''))
                self.block['cur'] = ''
        elif tag in ('strong', 'b'):
            if 'b' in self.marks:
                self.marks.remove('b')
        elif tag in ('em', 'i'):
            if 'i' in self.marks:
                self.marks.remove('i')
        elif tag == 'u':
            if 'u' in self.marks:
                self.marks.remove('u')
        elif tag == 's':
            if 's' in self.marks:
                self.marks.remove('s')

    def handle_data(self, data):
        if not data:
            return
        if self.block and self.block.get('type') in ('ul', 'ol') and 'items' in self.block and 'cur' in self.block:
            self.block['cur'] = (self.block.get('cur', '') + data)
        elif self.block and 'runs' in self.block:
            self.block['runs'].append((tuple(self.marks), data))
        elif self.block is None:
            if data.strip():
                self.block = {'type': 'p', 'align': None, 'runs': []}
                self.block['runs'].append((tuple(self.marks), data))


def html_to_docx_bytes(body_html: str) -> bytes:
    from docx import Document as DocxDocument
    doc = DocxDocument()
    # разрывы страниц редактора -> настоящие разрывы Word
    chunks = re.split(r'<div[^>]*class="[^"]*page-break[^"]*"[^>]*>.*?</div>',
                      str(body_html or ''), flags=re.DOTALL | re.IGNORECASE)
    first = True
    for chunk in chunks:
        if not first:
            try:
                doc.add_page_break()
            except Exception:
                pass
        first = False
        if not chunk.strip():
            continue
        _html_chunk_to_docx(doc, chunk)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _html_chunk_to_docx(doc, html: str) -> None:
    # таблицы — отдельным проходом: режем html на куски table/не-table
    parts = re.split(r'(<table.*?</table>)', str(html or ''), flags=re.DOTALL | re.IGNORECASE)
    for part in parts:
        if not part.strip():
            continue
        if part.strip().lower().startswith('<table'):
            try:
                rows = re.findall(r'<tr.*?>(.*?)</tr>', part, flags=re.DOTALL | re.IGNORECASE)
                grid = []
                for r in rows:
                    cells = re.findall(r'<t[dh].*?>(.*?)</t[dh]>', r, flags=re.DOTALL | re.IGNORECASE)
                    grid.append([re.sub(r'<[^>]+>', '', c).strip()[:500] for c in cells])
                grid = [r for r in grid if r]
                if grid:
                    cols = max(len(r) for r in grid)
                    t = doc.add_table(rows=len(grid), cols=cols)
                    t.style = 'Table Grid'
                    for i, row in enumerate(grid):
                        for j in range(cols):
                            t.cell(i, j).text = row[j] if j < len(row) else ''
                    doc.add_paragraph('')
            except Exception:
                pass
            continue
        parser = _HtmlToDocx(doc)
        try:
            parser.feed(part)
            parser._close_block()
        except Exception:
            pass


PAGE_SIZES = ('A3', 'A4', 'A5')


def clean_page_size(v) -> str:
    v = str(v or 'A4').upper()
    return v if v in PAGE_SIZES else 'A4'


class WordDocumentViewSet(viewsets.ModelViewSet):
    queryset = WordDocument.objects.all().order_by('-updated_at')
    serializer_class = WordDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or getattr(user, 'role', None) == 'admin':
            return qs
        return qs.filter(owner=user)

    def perform_create(self, serializer):
        title = (serializer.validated_data.get('title') or 'Документ')[:300]
        body = sanitize_html(serializer.validated_data.get('body_html') or '')
        if len(body) > 2000000:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Документ слишком большой (макс ~2МБ текста с картинками)")
        serializer.save(
            owner=self.request.user if self.request.user.is_authenticated else None,
            title=title, body_html=body,
            page_size=clean_page_size(serializer.validated_data.get('page_size')),
        )

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        if 'body_html' in serializer.validated_data:
            serializer.validated_data['body_html'] = sanitize_html(serializer.validated_data['body_html'])[:2000000]
        if 'title' in serializer.validated_data and serializer.validated_data['title']:
            serializer.validated_data['title'] = serializer.validated_data['title'][:300]
        if 'page_size' in serializer.validated_data:
            serializer.validated_data['page_size'] = clean_page_size(serializer.validated_data['page_size'])
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        instance.delete()

    @action(detail=False, methods=['post'], url_path='import',
            parser_classes=[MultiPartParser, FormParser])
    def import_docx(self, request):
        """Импорт .docx до 20МБ -> {title, body_html, stats}. Не сохраняет — редактор сохраняет сам."""
        f = request.FILES.get('file')
        if not f:
            return Response({'error': 'Файл не передан (поле file)'}, status=400)
        ext = os.path.splitext(f.name)[1].lower()
        if ext != '.docx':
            return Response({'error': 'Нужен именно .docx (старый .doc сохрани как .docx в Word)'}, status=400)
        if f.size > WORD_IMPORT_MAX_BYTES:
            return Response({'error': f'Файл {round(f.size / 1024 / 1024, 1)}МБ больше лимита 20МБ'}, status=400)
        if f.size == 0:
            return Response({'error': 'Пустой файл'}, status=400)
        import tempfile
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
        try:
            for chunk in f.chunks():
                tmp.write(chunk)
            tmp.close()
            try:
                title, body_html, stats = docx_to_html(tmp.name)
            except Exception as e:
                return Response({'error': f'Не получилось прочитать .docx: {e}'}, status=400)
            if not body_html.strip():
                return Response({'error': 'В файле нет текста'}, status=400)
            clean = sanitize_html(body_html)
            name = re.sub(r'<[^>]*>', '', f.name.rsplit('.', 1)[0])[:200] or 'Документ'
            return Response({
                'title': title or name,
                'body_html': clean,
                'stats': stats,
            })
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass

    @action(detail=False, methods=['post'], url_path='export')
    def export_docx(self, request):
        """Экспорт {title, body_html} -> .docx файл."""
        title = str(request.data.get('title') or 'Документ')[:200]
        body_html = sanitize_html(request.data.get('body_html') or '')
        if not body_html.strip():
            return Response({'error': 'Пустой документ'}, status=400)
        try:
            data = html_to_docx_bytes(body_html)
        except Exception as e:
            return Response({'error': f'Не получилось собрать .docx: {e}'}, status=400)
        safe = re.sub(r'[^\w\s\-а-яА-ЯёЁ]+', '', title, flags=re.UNICODE).strip()[:80] or 'document'
        resp = FileResponse(io.BytesIO(data),
                            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        resp['Content-Disposition'] = f'attachment; filename="{safe}.docx"'
        return resp
