from rest_framework import viewsets, permissions, status, throttling
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from .models import UploadedFile, Presentation, Slide
from .serializers import UploadedFileSerializer, PresentationSerializer, SlideSerializer
from apps.accounts.permissions import TeacherWriteMixin
import os
import re

def _validate_upload(file_obj):
    if not file_obj:
        raise ValueError("Файл не передан")
    if file_obj.size > 100 * 1024 * 1024:
        raise ValueError("Файл слишком большой (макс 100MB)")
    ext = os.path.splitext(file_obj.name)[1].lower()
    allowed_ext = getattr(settings, 'ALLOWED_UPLOAD_EXTENSIONS', [])
    if ext not in allowed_ext:
        raise ValueError(f"Недопустимое расширение {ext}. Разрешены: {', '.join(allowed_ext)}")
    # проверка mime
    allowed_mime = getattr(settings, 'ALLOWED_UPLOAD_MIMES', [])
    # доверяем расширению, но mime должен быть похож
    # блокируем .html/.svg которые могут содержать XSS
    if ext in ['.svg','.html','.htm','.js']:
        raise ValueError("Тип файла запрещен из соображений безопасности")
    return True

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user or (request.user.is_authenticated and request.user.role == 'admin')

class UploadedFileViewSet(viewsets.ModelViewSet):
    queryset = UploadedFile.objects.all().order_by('-created_at')
    serializer_class = UploadedFileSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.filter(is_public=True)
        if user.is_staff or getattr(user, 'role', None) == 'admin':
            return qs
        from django.db.models import Q
        return qs.filter(Q(owner=user) | Q(is_public=True))

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get('file')
        try:
            _validate_upload(file_obj)
        except ValueError as e:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(str(e))
        title = self.request.data.get('title') or (file_obj.name if file_obj else 'Без названия')
        # санитизация title: убираем html, ограничиваем длину
        title = re.sub(r'<[^>]*>', '', title)[:200]
        mime = file_obj.content_type if file_obj else ''
        serializer.save(owner=self.request.user if self.request.user.is_authenticated else None, title=title, mime_type=mime)

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Можно удалять только свои файлы")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Можно удалять только свои файлы")
        if instance.file:
            try: instance.file.delete(save=False)
            except Exception:
                pass
        instance.delete()

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Можно редактировать только свои файлы")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Можно редактировать только свои файлы")
        serializer.save()

class PresentationViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    queryset = Presentation.objects.prefetch_related('slides').all().order_by('-updated_at')
    serializer_class = PresentationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset().select_related('subject', 'lesson')
        user = self.request.user
        from django.db.models import Q
        # гость: публичное + уроковое из опубликованных уроков
        # зарегистрированный: + своё (черновики/приватное — только владелец)
        lesson_visible = Q(is_lesson_private=True, lesson__is_published=True)
        if not user.is_authenticated:
            qs = qs.filter(Q(is_public=True) | lesson_visible)
        elif not (user.is_staff or getattr(user, 'role', None) == 'admin'):
            qs = qs.filter(Q(owner=user) | Q(is_public=True) | lesson_visible)
        # фильтр по is_public ?is_public=true/false (для профиля черновиков)
        is_pub = self.request.query_params.get('is_public')
        if is_pub is not None and is_pub != '':
            if is_pub.lower() in ('true','1','yes'):
                qs = qs.filter(is_public=True)
            elif is_pub.lower() in ('false','0','no'):
                qs = qs.filter(is_public=False)
        # фильтр по is_lesson_private
        is_lesson = self.request.query_params.get('is_lesson_private')
        if is_lesson is not None and is_lesson != '':
            if is_lesson.lower() in ('true','1','yes'):
                qs = qs.filter(is_lesson_private=True)
            elif is_lesson.lower() in ('false','0','no'):
                qs = qs.filter(is_lesson_private=False)
        # фильтр по предмету ?subject=slug
        subject_slug = self.request.query_params.get('subject')
        if subject_slug:
            qs = qs.filter(subject__slug=subject_slug)
        # фильтр по владельцу ?owner=me
        owner_filter = self.request.query_params.get('owner')
        if owner_filter == 'me' and user.is_authenticated:
            qs = qs.filter(owner=user)
        return qs

    def perform_create(self, serializer):
        is_pub_raw = self.request.data.get('is_public')
        if is_pub_raw is not None:
            is_pub = str(is_pub_raw).lower() not in ('false','0','no')
        else:
            is_pub = True
        is_lesson_raw = self.request.data.get('is_lesson_private')
        is_lesson = str(is_lesson_raw).lower() in ('true','1','yes') if is_lesson_raw is not None else False
        lesson = serializer.validated_data.get('lesson')
        if lesson is not None:
            self._check_lesson_link(lesson)
        serializer.save(owner=self.request.user if self.request.user.is_authenticated else None, is_public=is_pub, is_lesson_private=is_lesson)

    def _check_lesson_link(self, lesson):
        # привязать контент можно только к своему уроку (админу — к любому)
        user = self.request.user
        is_admin = user.is_authenticated and (user.is_staff or getattr(user, 'role', None) == 'admin')
        if not is_admin and (not user.is_authenticated or (lesson.owner_id is not None and lesson.owner_id != user.id)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Можно привязать только к своему уроку")

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Можно редактировать только свои презентации")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Можно редактировать только свои презентации")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Можно удалять только свои презентации")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Можно удалять только свои презентации")
        instance.delete()

    @action(detail=False, methods=['post'], url_path='import', parser_classes=[MultiPartParser, FormParser])
    def import_pptx(self, request):
        """Загрузка .pptx/.ppt/.pdf как презентации с сохранением оригинального дизайна.
        Сохраняет: x/y/w/h (EMU→%), font runs, цвета, фон слайда (solid/gradient), таблицы с контентом, картинки с геометрией.
        Рендер на фронте — absolute layout, как в PowerPoint."""
        file = request.FILES.get('file')
        if not file:
            return Response({'detail':'Файл не передан (поле file)'}, status=400)
        title = (request.data.get('title') or file.name.rsplit('.',1)[0] or 'Без названия').strip()
        title = re.sub(r'<[^>]*>', '', title)[:200] or 'Презентация'
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ['.pptx','.ppt','.pdf']:
            return Response({'detail':'Разрешены только .pptx/.ppt/.pdf'}, status=400)
        if file.size > 100*1024*1024:
            return Response({'detail':'Файл >100MB'}, status=400)
        if ext == '.ppt':
            return Response({'detail':'Файл .ppt (старый PowerPoint) не поддерживается — сохраните как .pptx в PowerPoint'}, status=400)
        # subject для презентации (опционально)
        subject_obj = None
        subj_param = request.data.get('subject')
        if subj_param:
            try:
                from apps.catalog.models import Subject
                # пробуем как ID затем как slug
                try:
                    subject_obj = Subject.objects.get(id=int(subj_param))
                except:
                    subject_obj = Subject.objects.get(slug=str(subj_param))
            except:
                subject_obj = None
        # приватность: по умолчанию True, но если is_public=false (черновик) — только владельцу
        is_pub_raw = request.data.get('is_public')
        is_pub = True if is_pub_raw is None else str(is_pub_raw).lower() not in ('false','0','no','private','draft')
        is_lesson_raw = request.data.get('is_lesson_private')
        is_lesson = str(is_lesson_raw).lower() in ('true','1','yes') if is_lesson_raw is not None else False
        # привязка к уроку (опционально, только свой урок)
        lesson_obj = None
        lesson_param = request.data.get('lesson')
        if lesson_param:
            try:
                from apps.lessons.models import Lesson as LessonModel
                lesson_obj = LessonModel.objects.get(id=int(lesson_param))
                self._check_lesson_link(lesson_obj)
            except Exception as e:
                from rest_framework.exceptions import PermissionDenied
                if isinstance(e, PermissionDenied):
                    raise
                lesson_obj = None
        pres = Presentation.objects.create(title=title, description=f'Импортировано из {file.name}', owner=request.user if request.user.is_authenticated else None, is_public=is_pub, is_lesson_private=is_lesson, lesson=lesson_obj, subject=subject_obj)
        created_slides = 0
        try:
            if ext == '.pptx':
                from pptx import Presentation as PptxPres
                from pptx.enum.shapes import MSO_SHAPE_TYPE
                from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
                import uuid
                import tempfile
                from django.conf import settings as s
                def _parse_scheme_colors(pptx_path):
                    scheme = {}
                    try:
                        import zipfile
                        import xml.etree.ElementTree as ET
                        z = zipfile.ZipFile(pptx_path)
                        tname = None
                        for n in z.namelist():
                            if n.startswith('ppt/theme/theme') and n.endswith('.xml'):
                                tname = n
                                break
                        if not tname:
                            return scheme
                        root = ET.fromstring(z.read(tname))
                        ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                        clr = root.find('.//a:clrScheme', ns)
                        if clr is None:
                            return scheme
                        sys_map = {'windowtext': '#000000', 'window': '#FFFFFF', 'activeborder': '#B4B4B4',
                                   'highlight': '#0078D7', 'highlighttext': '#FFFFFF', 'graytext': '#808080',
                                   'buttonface': '#F0F0F0', 'buttontext': '#000000'}
                        for key in ('lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'):
                            el = clr.find('a:' + key, ns)
                            if el is None or len(el) == 0:
                                continue
                            c = el[0]
                            tag = c.tag.split('}')[-1]
                            hexv = None
                            if tag == 'srgbClr':
                                hexv = '#' + (c.get('val') or '').upper()
                            elif tag == 'sysClr':
                                if c.get('lastClr'):
                                    hexv = '#' + c.get('lastClr').upper()
                                else:
                                    hexv = sys_map.get((c.get('val') or '').lower())
                            if hexv and len(hexv) == 7:
                                scheme[key] = hexv
                        # алиасы текстовых/фоновых схемных цветов
                        try:
                            if scheme.get('dk1'):
                                scheme.setdefault('tx1', scheme['dk1'])
                            if scheme.get('lt1'):
                                scheme.setdefault('bg1', scheme['lt1'])
                            if scheme.get('dk2'):
                                scheme.setdefault('tx2', scheme['dk2'])
                            if scheme.get('lt2'):
                                scheme.setdefault('bg2', scheme['lt2'])
                        except Exception:
                            pass
                        # шрифты темы: +mj-lt/+mn-lt... -> реальные названия
                        try:
                            fs = root.find('.//a:fontScheme', ns)
                            if fs is not None:
                                for ftag, fkey in (('majorFont', 'mj'), ('minorFont', 'mn')):
                                    fel = fs.find('a:' + ftag, ns)
                                    if fel is None:
                                        continue
                                    for script, suffix in (('latin', 'lt'), ('ea', 'ea'), ('cs', 'cs')):
                                        lat = fel.find('a:' + script, ns)
                                        if lat is not None and lat.get('typeface'):
                                            # ключи как в pptx: +mj-lt, +mn-lt, +mj-ea ...
                                            scheme['+%s-%s' % (fkey, suffix)] = lat.get('typeface')
                        except Exception:
                            pass
                    except Exception:
                        pass
                    return scheme

                def _resolve_font(name, scheme):
                    try:
                        if not name:
                            return None
                        key = str(name).strip()
                        if key in (scheme or {}):
                            return scheme[key]
                        return key
                    except Exception:
                        return None

                def _apply_brightness(hexcol, bright):
                    try:
                        b = float(bright or 0)
                    except Exception:
                        return hexcol
                    if not b:
                        return hexcol
                    h = hexcol.lstrip('#')
                    if len(h) != 6:
                        return hexcol
                    try:
                        r, g, bl = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
                    except Exception:
                        return hexcol
                    if b > 0:
                        r = int(r + (255 - r) * b); g = int(g + (255 - g) * b); bl = int(bl + (255 - bl) * b)
                    else:
                        r = int(r * (1 + b)); g = int(g * (1 + b)); bl = int(bl * (1 + b))
                    r = max(0, min(255, r)); g = max(0, min(255, g)); bl = max(0, min(255, bl))
                    return '#%02X%02X%02X' % (r, g, bl)


                def _parse_master_typography(pptx_obj, scheme):
                    out = {'title': {}, 'body': {}, 'other': {}}
                    try:
                        masters = list(getattr(pptx_obj, 'slide_masters', []) or [])
                        if not masters:
                            return out
                        el = masters[0]._element
                        NSM = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
                               'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                        tx = el.find('p:txStyles', NSM)
                        if tx is None:
                            return out
                        amap = {'l': 'left', 'ctr': 'center', 'r': 'right', 'just': 'justify', 'dist': 'distribute'}
                        for key, tag in (('title', 'p:titleStyle'), ('body', 'p:bodyStyle'), ('other', 'p:otherStyle')):
                            st = tx.find(tag, NSM)
                            if st is None:
                                continue
                            lvl = st.find('a:lvl1pPr', NSM)
                            if lvl is None:
                                continue
                            d = {}
                            alg = lvl.get('algn')
                            if alg:
                                d['align'] = amap.get(alg, 'left')
                            dr = lvl.find('a:defRPr', NSM)
                            if dr is not None:
                                sz = dr.get('sz')
                                if sz:
                                    try:
                                        d['fontSize'] = max(8, int(round(int(sz) / 100)))
                                    except Exception:
                                        pass
                                if dr.get('b') == '1':
                                    d['bold'] = True
                                if dr.get('i') == '1':
                                    d['italic'] = True
                                lat = dr.find('a:latin', NSM)
                                if lat is not None and lat.get('typeface'):
                                    d['fontFamily'] = _resolve_font(lat.get('typeface'), scheme)
                            lnsp = lvl.find('a:lnSpc', NSM)
                            if lnsp is not None:
                                pct = lnsp.find('a:spcPct', NSM)
                                if pct is not None and pct.get('val'):
                                    try:
                                        _lhv = int(pct.get('val')) / 1000.0 / 100.0
                                        if 0.5 <= _lhv <= 3.0:
                                            d['lineHeight'] = round(_lhv, 3)
                                    except Exception:
                                        pass
                                sf = dr.find('a:solidFill', NSM)
                                if sf is not None and len(sf):
                                    cc = sf[0]
                                    t2 = cc.tag.split('}')[-1]
                                    if t2 == 'srgbClr' and cc.get('val'):
                                        d['color'] = '#' + cc.get('val').upper()
                                    elif t2 == 'schemeClr' and cc.get('val'):
                                        base = (scheme or {}).get(cc.get('val'), '')
                                        if base:
                                            d['color'] = base
                            out[key] = d
                    except Exception:
                        pass
                    return out
                def _read_alpha(cobj):
                    """Альфа из <a:alpha val> (0-100000) рядом с цветом. None если непрозрачность 100%."""
                    try:
                        el = getattr(cobj, '_color', None)
                        if el is None:
                            return None
                        NS = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
                        a = el.find(NS + 'alpha')
                        if a is not None and a.get('val') is not None:
                            return max(0.0, min(1.0, int(a.get('val')) / 100000.0))
                    except Exception:
                        pass
                    return None

                def _hex_to_rgba(hexcol, alpha):
                    try:
                        h = hexcol.strip().lstrip('#')
                        if len(h) == 3:
                            h = ''.join([ch * 2 for ch in h])
                        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
                        return 'rgba(%d,%d,%d,%s)' % (r, g, b, round(max(0.0, min(1.0, alpha)), 3))
                    except Exception:
                        return hexcol

                def _color_css(cobj, scheme):
                    """Цвет как CSS: #hex или rgba() при прозрачности. Замена _resolve_color_obj там, где важна альфа."""
                    try:
                        base = _resolve_color_obj(cobj, scheme)
                        if not base or not base.startswith('#'):
                            return base
                        alpha = _read_alpha(cobj)
                        if alpha is None or alpha >= 0.999:
                            return base
                        return _hex_to_rgba(base, alpha)
                    except Exception:
                        try:
                            return _resolve_color_obj(cobj, scheme)
                        except Exception:
                            return None

                def _resolve_color_obj(cobj, scheme):
                    try:
                        if cobj is None:
                            return None
                        if getattr(cobj, 'rgb', None):
                            return _rgb_to_hex(cobj.rgb)
                        th = getattr(cobj, 'theme_color', None)
                        if th is None:
                            return None
                        try:
                            th_int = int(th)
                        except Exception:
                            return None
                        th_map = {1: 'dk1', 2: 'lt1', 3: 'dk2', 4: 'lt2', 5: 'accent1', 6: 'accent2',
                                  7: 'accent3', 8: 'accent4', 9: 'accent5', 10: 'accent6',
                                  11: 'hlink', 12: 'folHlink', 13: 'tx1', 14: 'bg1', 15: 'tx2', 16: 'bg2'}
                        base = (scheme or {}).get(th_map.get(th_int, ''), '')
                        if not base:
                            return None
                        try:
                            bright = getattr(cobj, 'brightness', 0) or 0
                        except Exception:
                            bright = 0
                        return _apply_brightness(base, bright)
                    except Exception:
                        return None

                def _extract_custgeom_path(shape):
                    """Freeform custGeom -> SVG path. Returns (d, vw, vh) or (None, 0, 0)."""
                    try:
                        sp = shape._element.spPr
                        if sp is None:
                            return None, 0, 0
                        NS = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
                        cg = sp.find(NS + 'custGeom')
                        if cg is None:
                            return None, 0, 0
                        pl = cg.find(NS + 'pathLst')
                        if pl is None or len(pl) == 0:
                            return None, 0, 0
                        path = pl[0]
                        try:
                            vw = int(path.get('w') or 0)
                            vh = int(path.get('h') or 0)
                        except Exception:
                            vw, vh = 0, 0
                        if vw <= 0 or vh <= 0:
                            vw, vh = 10000, 10000
                        def _num(v):
                            try:
                                return float(v)
                            except Exception:
                                return None
                        def _flat_quad(p0, p1, p2, n=8):
                            pts = []
                            for i in range(1, n + 1):
                                t = i / float(n)
                                mt = 1 - t
                                pts.append((mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
                                            mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]))
                            return pts
                        def _flat_cubic(p0, p1, p2, p3, n=10):
                            pts = []
                            for i in range(1, n + 1):
                                t = i / float(n)
                                mt = 1 - t
                                pts.append((mt**3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t**3 * p3[0],
                                            mt**3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t**3 * p3[1]))
                            return pts
                        parts = []
                        cur = None
                        start = None
                        for cmd in path:
                            tag = cmd.tag.split('}')[-1] if isinstance(getattr(cmd, 'tag', None), str) else ''
                            pts = []
                            ok = True
                            for pt in cmd:
                                if not (isinstance(getattr(pt, 'tag', None), str) and pt.tag.split('}')[-1] == 'pt'):
                                    continue
                                x = _num(pt.get('x'))
                                y = _num(pt.get('y'))
                                if x is None or y is None:
                                    ok = False
                                    break
                                pts.append((x, y))
                            if not ok:
                                return None, 0, 0
                            if tag == 'moveTo' and len(pts) == 1:
                                cur = pts[0]
                                start = pts[0]
                                parts.append('M%.1f %.1f' % cur)
                            elif tag == 'lnTo' and len(pts) == 1:
                                cur = pts[0]
                                parts.append('L%.1f %.1f' % cur)
                            elif tag == 'quadBezTo' and len(pts) == 2 and cur is not None:
                                for p in _flat_quad(cur, pts[0], pts[1]):
                                    parts.append('L%.1f %.1f' % p)
                                cur = pts[1]
                            elif tag == 'cubicBezTo' and len(pts) == 3 and cur is not None:
                                for p in _flat_cubic(cur, pts[0], pts[1], pts[2]):
                                    parts.append('L%.1f %.1f' % p)
                                cur = pts[2]
                            elif tag == 'close':
                                if start is not None:
                                    parts.append('Z')
                                    cur = start
                            elif tag == 'arcTo':
                                pass
                        if not parts:
                            return None, 0, 0
                        d = ''.join(parts)
                        return d, vw, vh
                    except Exception:
                        return None, 0, 0

                def _extract_shape_fill_css(shape, scheme):
                    try:
                        fill = shape.fill
                        if fill is None:
                            return None, None
                        try:
                            if hasattr(fill, 'gradient_stops') and fill.gradient_stops is not None:
                                stops = list(fill.gradient_stops)
                                if stops and len(stops) >= 2:
                                    cols = []
                                    for st in stops:
                                        try:
                                            cc = _color_css(getattr(st, 'color', None), scheme)
                                            if cc:
                                                cols.append('%s %d%%' % (cc, round(float(st.position) * 100)))
                                        except Exception:
                                            pass
                                    if cols:
                                        try:
                                            angle = int(getattr(fill, 'gradient_angle', 90) or 90)
                                        except Exception:
                                            angle = 90
                                        return 'linear-gradient(%ddeg, %s)' % (angle, ', '.join(cols)), None
                        except Exception:
                            pass
                        if fill.fore_color is not None:
                            hc = _color_css(fill.fore_color, scheme)
                            if hc:
                                return hc, None
                    except Exception:
                        pass
                    return None, None

                def _extract_shape_line(shape, scheme):
                    """Возвращает (color_css, width_px, dash). ТОЛЬКО raw-XML: геттеры python-pptx
                    (shape.line / .color.rgb) МУТИРУЮТ дерево — дописывают пустой <solidFill>, после чего
                    пустая линия выглядит как настоящая. Поэтому API здесь не трогаем вообще."""
                    try:
                        NSA = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
                        _raw_ln = None
                        try:
                            _sp = shape._element.spPr
                            if _sp is not None:
                                _raw_ln = _sp.find(NSA + 'ln')
                        except Exception:
                            pass
                        if _raw_ln is None:
                            return None, 0, 'solid'
                        if _raw_ln.find(NSA + 'noFill') is not None:
                            return None, 0, 'solid'
                        # ширина из атрибута (EMU → px); 0/нет = волосная только при явной заливке
                        try:
                            _wemu = int(_raw_ln.get('w') or 0)
                        except Exception:
                            _wemu = 0
                        w = max(1, round(_wemu / 12700)) if _wemu > 0 else 0
                        # цвет из solidFill/gradFill (первый стоп)
                        col = None
                        try:
                            for _fc in ('solidFill', 'gradFill'):
                                _sf = _raw_ln.find(NSA + _fc)
                                if _sf is None or len(_sf) == 0:
                                    continue
                                _cc = _sf[0]
                                _tag = _cc.tag.split('}')[-1] if isinstance(getattr(_cc, 'tag', None), str) else ''
                                if _tag == 'srgbClr' and _cc.get('val'):
                                    col = '#' + _cc.get('val').upper()
                                elif _tag == 'schemeClr' and _cc.get('val'):
                                    col = (scheme or {}).get(_cc.get('val')) or None
                                else:
                                    continue
                                _al = _cc.find(NSA + 'alpha')
                                if _al is not None and _al.get('val'):
                                    try:
                                        _av = max(0.0, min(1.0, int(_al.get('val')) / 100000.0))
                                        if _av < 0.999 and col and col.startswith('#'):
                                            col = _hex_to_rgba(col, _av)
                                    except Exception:
                                        pass
                                # яркость lumMod/lumOff
                                try:
                                    _lm = _cc.find(NSA + 'lumMod')
                                    _lo = _cc.find(NSA + 'lumOff')
                                    if col and col.startswith('#') and (_lm is not None or _lo is not None):
                                        _hv = col.lstrip('#')
                                        _r, _g, _b = int(_hv[0:2], 16), int(_hv[2:4], 16), int(_hv[4:6], 16)
                                        if _lm is not None and _lm.get('val'):
                                            _f = int(_lm.get('val')) / 100000.0
                                            _r, _g, _b = int(_r * _f), int(_g * _f), int(_b * _f)
                                        if _lo is not None and _lo.get('val'):
                                            _o = int(_lo.get('val')) / 100000.0 * 255
                                            _r = min(255, int(_r + _o)); _g = min(255, int(_g + _o)); _b = min(255, int(_b + _o))
                                        col = '#%02X%02X%02X' % (max(0, min(255, _r)), max(0, min(255, _g)), max(0, min(255, _b)))
                                except Exception:
                                    pass
                                break
                        except Exception:
                            pass
                        # пустой <a:ln/> без заливки и ширины = линии НЕТ
                        if col is None and not w:
                            return None, 0, 'solid'
                        if col is None and w:
                            col = '#64748B'
                        if col is not None and not w:
                            w = 1
                        dash = 'solid'
                        try:
                            raw_ln = shape._element.spPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}ln')
                            if raw_ln is not None:
                                pd = raw_ln.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstDash')
                                if pd is not None:
                                    dv = (pd.get('val') or 'solid').lower()
                                    dash_map = {'solid': 'solid', 'dash': 'dashed', 'lgdash': 'dashed',
                                                'dashdot': 'dotted', 'lgdashdot': 'dotted', 'lgdashdotdot': 'dotted',
                                                'dot': 'dotted', 'sysdash': 'dashed', 'sysdot': 'dotted',
                                                'sysdashdot': 'dotted', 'sysdashdotdot': 'dotted'}
                                    dash = dash_map.get(dv, 'solid')
                        except Exception:
                            pass
                        return col, w, dash
                    except Exception:
                        return None, 0, 'solid'

                def _rgb_to_hex(rgb):
                    try:
                        c = str(rgb).upper().strip().lstrip('#')
                        # pptx RGBString may contain alpha: AARRGGBB → take last 6
                        if len(c) == 8:
                            c = c[2:]
                        if len(c) == 6 and all(ch in '0123456789ABCDEF' for ch in c):
                            return f"#{c}"
                    except:
                        pass
                    return None

                def _is_dark(hexcol):
                    # по-настоящему тёмный (для принудительного осветления текста) — порог строже, чем _is_light
                    try:
                        h = hexcol.strip().lstrip('#').upper()
                        if len(h) == 3:
                            h = ''.join([ch*2 for ch in h])
                        if len(h) != 6:
                            return False
                        r = int(h[0:2], 16); g = int(h[2:4], 16); b = int(h[4:6], 16)
                        return 0.299*r+0.587*g+0.114*b < 90
                    except:
                        return False

                def _is_light(hexcol):
                    try:
                        h = hexcol.strip().lstrip('#').upper()
                        if len(h) == 3:
                            h = ''.join([ch*2 for ch in h])
                        if len(h) != 6:
                            return False
                        r = int(h[0:2], 16); g = int(h[2:4], 16); b = int(h[4:6], 16)
                        return 0.299*r+0.587*g+0.114*b > 200
                    except:
                        return False

                def _emu_to_pct(val, total):
                    try:
                        return round(float(val) / float(total) * 100, 4)
                    except:
                        return 0

                def _convert_image_blob(blob, ext):
                    """EMF/WMF/TIFF/BMP → PNG через LibreOffice (есть в Dockerfile и на сервере).
                    Возвращает (bytes, '.png') или (None, ext) если конвертера нет."""
                    try:
                        import shutil
                        import subprocess
                        soffice = shutil.which('soffice') or shutil.which('libreoffice')
                        if not soffice:
                            return None, ext
                        with tempfile.NamedTemporaryFile(delete=False, suffix=ext.lower()) as f:
                            f.write(blob)
                            src = f.name
                        outdir = tempfile.mkdtemp()
                        try:
                            subprocess.run([soffice, '--headless', '--convert-to', 'png', '--outdir', outdir, src],
                                           capture_output=True, timeout=60)
                            base = os.path.splitext(os.path.basename(src))[0] + '.png'
                            out = os.path.join(outdir, base)
                            if os.path.exists(out):
                                with open(out, 'rb') as fh:
                                    return fh.read(), '.png'
                        finally:
                            try: os.unlink(src)
                            except: pass
                            try:
                                import shutil as _sh
                                _sh.rmtree(outdir, ignore_errors=True)
                            except: pass
                    except Exception:
                        pass
                    return None, ext

                def _extract_slide_background(slide, pptx_obj, scheme=None):
                    """Возвращает (background, background_type, gradient, bg_image)"""
                    bg = '#ffffff'
                    bg_type = 'solid'
                    gradient = ''
                    bg_image = ''
                    try:
                        fill = slide.background.fill
                        if fill is not None:
                            ft = getattr(fill, 'type', None)
                            # type 1=solid, 5=gradient, 6=picture etc — но проверяем наличие атрибутов
                            if ft == 1:
                                # solid
                                try:
                                    if fill.fore_color is not None:
                                        hexc = _color_css(fill.fore_color, scheme or {})
                                        if hexc:
                                            bg = hexc
                                    elif fill.fore_color and getattr(fill.fore_color, 'theme_color', None) is not None:
                                        # theme color — не можем резолвить, оставим white но не будем инвертировать текст
                                        bg = '#0f172a'  # hint dark for theme
                                        # но лучше белый; оставим как есть
                                        bg = '#ffffff'
                                except:
                                    pass
                            else:
                                # пробуем gradient
                                try:
                                    if hasattr(fill, 'gradient_stops') and fill.gradient_stops is not None:
                                        stops = list(fill.gradient_stops)
                                        if stops and len(stops) >= 2:
                                            cols = []
                                            for st in stops:
                                                try:
                                                    c = None
                                                    if st.color is not None:
                                                        c = _color_css(st.color, scheme or {})
                                                    if c:
                                                        pct = round(float(st.position)*100)
                                                        cols.append(f"{c} {pct}%")
                                                except:
                                                    pass
                                            if cols:
                                                try:
                                                    angle = int(getattr(fill, 'gradient_angle', 90) or 90)
                                                except:
                                                    angle = 90
                                                bg_type = 'gradient'
                                                gradient = f"linear-gradient({angle}deg, {', '.join(cols)})"
                                                bg = gradient
                                                return bg, bg_type, gradient, bg_image
                                except:
                                    pass
                                # solid fallback even if type not 1
                                try:
                                    if fill.fore_color is not None:
                                        hexc = _color_css(fill.fore_color, scheme or {})
                                        if hexc and hexc.upper() not in ('#FFFFFF', '#FFF'):
                                            bg = hexc
                                except:
                                    pass
                                # picture background
                                try:
                                    if hasattr(fill, 'background') and callable(fill.background):
                                        # для background() == True используется master
                                        pass
                                except:
                                    pass
                    except:
                        pass
                    # если фон всё ещё белый, но слайд из тёмной темы — проверим первый shape с большим заливом (fallback)
                    # не делаем авто-детект, оставляем белый, фронт сам не будет инвертировать если есть fill_bg
                    if bg == '#ffffff':
                        try:
                            _holders = []
                            try:
                                _holders.append(slide.slide_layout)
                                _holders.append(slide.slide_layout.slide_master)
                            except Exception:
                                pass
                            for _h in _holders:
                                try:
                                    _f2 = _h.background.fill
                                except Exception:
                                    continue
                                try:
                                    if _f2 is not None and _f2.fore_color is not None:
                                        _hx = _color_css(_f2.fore_color, scheme or {})
                                        if _hx and _hx.upper() not in ('#FFFFFF', '#FFF'):
                                            bg = _hx
                                            break
                                except Exception:
                                    pass
                        except Exception:
                            pass
                    return bg, bg_type, gradient, bg_image

                def _extract_shape_fill(shape):
                    try:
                        fill = shape.fill
                        if fill is None:
                            return None
                        ft = getattr(fill, 'type', None)
                        # solid
                        if ft == 1:
                            if fill.fore_color and fill.fore_color.rgb:
                                return _rgb_to_hex(fill.fore_color.rgb)
                        # пробуем любой fore_color
                        if fill.fore_color and fill.fore_color.rgb:
                            hc = _rgb_to_hex(fill.fore_color.rgb)
                            if hc and hc.upper() not in ('#FFFFFF',):
                                return hc
                    except:
                        pass
                    return None

                def _extract_text_frame(shape, slide_bg, scheme=None, fb=None):
                    """Извлекает paragraphs с runs, возвращает (full_text, paragraphs_data, style_hint)"""
                    if not getattr(shape, 'has_text_frame', False) or not shape.has_text_frame:
                        return None
                    tf = shape.text_frame
                    if not tf.paragraphs:
                        return None
                    # auto size / margins
                    paragraphs = []
                    full_texts = []
                    first_run_style = {}
                    has_bullet = False
                    for pi, para in enumerate(tf.paragraphs):
                        _ptext = para.text or ''
                        try:
                            _has_br = False
                            for _rr in (para.runs or []):
                                _rel = getattr(_rr, '_r', None)
                                if _rel is None:
                                    continue
                                for _ch in _rel:
                                    if isinstance(getattr(_ch, 'tag', None), str) and _ch.tag.split('}')[-1] == 'br':
                                        _has_br = True
                                        break
                                if _has_br:
                                    break
                        except Exception:
                            _has_br = False
                        if (not _ptext.strip()) and (not _has_br):
                            continue
                        # alignment
                        alg = 'left'
                        try:
                            al = para.alignment
                            if al is not None:
                                m = {1:'left',2:'center',3:'right',4:'justify',5:'distribute'}
                                alg = m.get(int(al), 'left')
                        except:
                            pass
                        if alg == 'left':
                            try:
                                try:
                                    _ppe = getattr(para, '_p', None)
                                    _ppr = _ppe.find('{http://schemas.openxmlformats.org/drawingml/2006/main}pPr') if _ppe is not None else None
                                    _explicit_algn = _ppr is not None and _ppr.get('algn') is not None
                                except Exception:
                                    _explicit_algn = para.alignment is not None
                                if not _explicit_algn:
                                    _fba = (fb or {}).get('align')
                                    if _fba and _fba != 'left':
                                        alg = _fba
                                    else:
                                        try:
                                            _pht2 = int(shape.placeholder_format.type) if getattr(shape, 'is_placeholder', False) else -1
                                        except Exception:
                                            _pht2 = -1
                                        alg = 'center' if _pht2 in (3, 4) else (_fba or 'left')
                            except Exception:
                                pass
                        _plh = None
                        try:
                            _ls = getattr(para, 'line_spacing', None)
                            if _ls is not None:
                                _lh = float(_ls)
                                if 0.5 <= _lh <= 3.0:
                                    _plh = round(_lh, 3)
                        except Exception:
                            pass
                        # level → bullet indent
                        level = getattr(para, 'level', 0) or 0
                        # runs
                        runs = []
                        for run in para.runs:
                            try:
                                _parts = []
                                _rel2 = getattr(run, '_r', None)
                                if _rel2 is not None:
                                    for _ch2 in _rel2:
                                        _t2 = _ch2.tag.split('}')[-1] if isinstance(getattr(_ch2, 'tag', None), str) else ''
                                        if _t2 == 't':
                                            _parts.append(_ch2.text or '')
                                        elif _t2 == 'br':
                                            _parts.append('\n')
                                    txt = ''.join(_parts)
                                else:
                                    txt = run.text or ''
                            except Exception:
                                txt = run.text or ''
                            if not txt or ((not txt.strip()) and ('\n' not in txt)):
                                continue
                            rs = {}
                            # font size
                            try:
                                if run.font.size is not None:
                                    rs['fontSize'] = int(run.font.size.pt)
                                elif (fb or {}).get('fontSize'):
                                    rs['fontSize'] = fb['fontSize']
                            except:
                                pass
                            # bold/italic/underline
                            try:
                                if run.font.bold is not None:
                                    rs['bold'] = bool(run.font.bold)
                                elif (fb or {}).get('bold') is True:
                                    rs['bold'] = True
                                if run.font.italic is not None:
                                    rs['italic'] = bool(run.font.italic)
                                elif (fb or {}).get('italic') is True:
                                    rs['italic'] = True
                                if run.font.underline is not None:
                                    rs['underline'] = bool(run.font.underline)
                                if run.font.name:
                                    rs['fontFamily'] = _resolve_font(run.font.name, scheme) or run.font.name
                                elif (fb or {}).get('fontFamily'):
                                    rs['fontFamily'] = fb['fontFamily']
                                # strike?
                                # highlight
                                try:
                                    if getattr(run.font, 'highlight_color', None) is not None:
                                        # enum value not None → highlighted
                                        rs['highlight'] = True
                                except:
                                    pass
                                # color
                                if run.font.color is not None:
                                    hc = _color_css(run.font.color, scheme or {})
                                    if not hc and (fb or {}).get('color'):
                                        hc = fb['color']
                                    if hc:
                                        # не инвертируем здесь — инверсия только если фон белый и цвет светлый
                                        rs['color'] = hc
                                elif run.font.color and getattr(run.font.color, 'theme_color', None) is not None:
                                    # theme — оставим без цвета, фронт использует наследование
                                    pass
                            except:
                                pass
                            # если первый run без fontSize — запомним
                            if pi == 0 and not first_run_style and rs:
                                first_run_style = rs.copy()
                            runs.append({'text': txt, 'style': rs})
                        if not runs:
                            # параграф без runs но с текстом
                            runs = [{'text': para.text, 'style': {}}]
                            if alg:
                                runs[0]['style']['align'] = alg
                        paragraphs.append({
                            'align': alg,
                            'level': level,
                            'runs': runs,
                            'lineHeight': _plh,
                        })
                        # для фолбэка fullText
                        full_texts.append(''.join([r['text'] for r in runs]))
                        if level > 0:
                            has_bullet = True
                    if not paragraphs:
                        return None
                    # соберём full text для совместимости
                    full = '\n'.join(full_texts).strip()
                    if not full:
                        full = shape.text.strip()
                    return full, paragraphs, first_run_style, has_bullet

                def _extract_chart_table(shape):
                    """Диаграмма → table-блок с данными (категории x серии). Возвращает dict table или None."""
                    try:
                        if not getattr(shape, 'has_chart', False):
                            return None
                        chart = shape.chart
                        title = ''
                        try:
                            if chart.has_title and chart.chart_title and chart.chart_title.text_frame:
                                title = chart.chart_title.text_frame.text.strip()
                        except Exception:
                            pass
                        cats, series = [], []
                        try:
                            for s in chart.series:
                                vals = []
                                try:
                                    vals = [float(v) if v is not None else 0 for v in s.values]
                                except Exception:
                                    vals = []
                                name = ''
                                try:
                                    name = s.name or ''
                                except Exception:
                                    pass
                                series.append((name, vals))
                            try:
                                cats = [str(c.label if hasattr(c, 'label') else c) for c in chart.plots[0].categories]
                            except Exception:
                                n = max((len(v) for _, v in series), default=0)
                                cats = [f'{i+1}' for i in range(n)]
                        except Exception:
                            pass
                        if not series:
                            return None
                        header = [''] + [nm or f'Ряд {i+1}' for i, (nm, _) in enumerate(series)]
                        cells = [[{'text': h, 'style': {'bold': True, 'background': '#f1f5f9'}} for h in header]]
                        for ci, cat in enumerate(cats):
                            row = [{'text': cat, 'style': {'bold': True}}]
                            for _, vals in series:
                                v = vals[ci] if ci < len(vals) else ''
                                row.append({'text': str(v), 'style': {}})
                            cells.append(row)
                        if title:
                            cells.insert(0, [{'text': title, 'style': {'bold': True}}])
                        return {'rows': len(cells), 'cols': len(header), 'cells': cells, 'chartTitle': title}
                    except Exception:
                        return None

                def _extract_graphic_text(shape):
                    """SmartArt/диаграммы/графики без text_frame: собираем весь видимый текст из XML (a:t).
                    Возвращает текст или None."""
                    try:
                        st = getattr(shape, 'shape_type', None)
                        if st not in (MSO_SHAPE_TYPE.DIAGRAM, MSO_SHAPE_TYPE.CHART,
                                      MSO_SHAPE_TYPE.IGX_GRAPHIC, MSO_SHAPE_TYPE.MEDIA):
                            return None
                        el = shape._element
                        NS_A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
                        parts = []
                        for t in el.iter(NS_A + 't'):
                            if t.text and t.text.strip():
                                parts.append(t.text.strip())
                        # убираем дубли подряд, сохраняем порядок
                        seen, uniq = set(), []
                        for p in parts:
                            if p not in seen:
                                seen.add(p)
                                uniq.append(p)
                        txt = '\n'.join(uniq).strip()
                        return txt[:4000] if txt else None
                    except Exception:
                        return None

                def _extract_transition(slide):
                    """Читает p:transition слайда → наш transition (fade/slide/zoom/wipe/split)."""
                    try:
                        NS_P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
                        tr = slide._element.find(NS_P + 'transition')
                        if tr is None or len(tr) == 0:
                            return 'fade'
                        tag = tr[0].tag.split('}')[-1] if isinstance(getattr(tr[0], 'tag', None), str) else ''
                        mapping = {
                            'fade': 'fade', 'blinds': 'wipe', 'checker': 'split', 'comb': 'split',
                            'cover': 'slide', 'dissolve': 'fade', 'flythrough': 'zoom', 'push': 'slide',
                            'random': 'random', 'split': 'split', 'strips': 'wipe', 'wipe': 'wipe',
                            'zoom': 'zoom', 'clock': 'wipe', 'circle': 'zoom',
                        }
                        return mapping.get(tag, 'fade')
                    except Exception:
                        return 'fade'

                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    for chunk in file.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                try:
                    pptx = PptxPres(tmp_path)
                    scheme = _parse_scheme_colors(tmp_path)
                    typo = _parse_master_typography(pptx, scheme)
                    media_root = getattr(s, 'MEDIA_ROOT', 'media')
                    os.makedirs(os.path.join(media_root, 'pptx_images'), exist_ok=True)
                    # размеры слайда для процентов
                    try:
                        sw = int(pptx.slide_width)
                        sh = int(pptx.slide_height)
                    except:
                        sw = 9144000
                        sh = 6858000
                    for idx, slide in enumerate(pptx.slides):
                        blocks = []
                        bg, bg_type, gradient, bg_image = _extract_slide_background(slide, pptx, scheme)
                        slide_width = sw
                        slide_height = sh
                        # хелпер для геометрии
                        def _geom(shape):
                            try:
                                x = _emu_to_pct(shape.left, slide_width)
                                y = _emu_to_pct(shape.top, slide_height)
                                w = _emu_to_pct(shape.width, slide_width)
                                h = _emu_to_pct(shape.height, slide_height)
                                # clamp
                                x = max(0, min(100, x))
                                y = max(0, min(100, y))
                                w = max(2, min(100, w))
                                h = max(2, min(100, h))
                                rot = 0
                                try:
                                    rot = float(getattr(shape, 'rotation', 0) or 0)
                                except:
                                    rot = 0
                                return {'x': x, 'y': y, 'w': w, 'h': h, 'rotation': rot, 'unit': '%'}
                            except:
                                return {'x': 2, 'y': 2, 'w': 96, 'h': 10, 'unit': '%'}

                        # рекурсивный обход с учётом групп
                        def _walk_shapes(shapes, z_base=0):
                            nonlocal blocks
                            for si, shape in enumerate(shapes):
                                z = z_base + si
                                # GROUP
                                try:
                                    if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                                        try:
                                            _walk_shapes(shape.shapes, z_base=z*10)
                                        except:
                                            pass
                                        continue
                                except:
                                    pass
                                # PICTURE
                                is_picture = False
                                try:
                                    if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                                        is_picture = True
                                except:
                                    pass
                                if is_picture:
                                    try:
                                        blob = shape.image.blob
                                        img_ext = '.' + (shape.image.ext or 'png')
                                        # браузеры не показывают EMF/WMF/TIFF/BMP — пробуем конверт через LibreOffice, иначе плейсхолдер
                                        BROWSER_OK = ['.png','.jpg','.jpeg','.gif','.webp','.svg']
                                        need_convert = img_ext.lower() not in BROWSER_OK
                                        conv_blob, conv_ext, unrenderable = blob, img_ext, False
                                        if need_convert:
                                            conv_blob, conv_ext = _convert_image_blob(blob, img_ext)
                                            if conv_blob is None:
                                                conv_blob, conv_ext, unrenderable = blob, img_ext, True
                                        if not unrenderable and conv_ext.lower() not in BROWSER_OK + ['.png']:
                                            conv_ext = '.png'
                                        fname = f"{uuid.uuid4().hex}{conv_ext}"
                                        rel = f"pptx_images/{fname}"
                                        full = os.path.join(media_root, rel)
                                        with open(full, 'wb') as out:
                                            out.write(conv_blob)
                                        url = s.MEDIA_URL + rel
                                        geom = _geom(shape)
                                        # crop? PowerPoint stretches to box when no crop -> fill, else cover
                                        try:
                                            _sr = shape._element.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}srcRect')
                                            _has_crop = _sr is not None and any((_sr.get(k) or '0') != '0' for k in ('l', 't', 'r', 'b'))
                                        except Exception:
                                            _has_crop = False
                                        style = {'borderRadius': 4, 'objectFit': 'cover' if _has_crop else 'contain', 'x': geom['x'], 'y': geom['y'], 'w': geom['w'], 'h': geom['h'], 'rotation': geom.get('rotation',0), 'z': z, 'unit': '%'}
                                        # если картинка в тексте — сохраняем как image блок с геометрией
                                        img_block = {'id': uuid.uuid4().hex[:8], 'type':'image','src': url, 'style': style}
                                        if unrenderable:
                                            img_block['unrenderable'] = True
                                            img_block['origExt'] = img_ext
                                        blocks.append(img_block)
                                        continue
                                    except Exception:
                                        pass
                                # TABLE — извлекаем ячейки
                                try:
                                    if getattr(shape, 'has_table', False) and shape.has_table:
                                        tbl = shape.table
                                        rows = len(tbl.rows)
                                        cols = len(tbl.columns)
                                        cells = []
                                        for r in tbl.rows:
                                            row_cells = []
                                            for c in r.cells:
                                                txt = ''
                                                try:
                                                    txt = c.text.strip() if c.text else ''
                                                except:
                                                    txt = ''
                                                # объединённые ячейки: gridSpan/rowSpan + пропуск поглощённых (hMerge/vMerge)
                                                colspan, rowspan, merged_away = 1, 1, False
                                                try:
                                                    _tc_el = c._tc
                                                    colspan = max(1, int(_tc_el.get('gridSpan') or 1))
                                                    rowspan = max(1, int(_tc_el.get('rowSpan') or 1))
                                                    if _tc_el.get('hMerge') == '1' or _tc_el.get('vMerge') == '1':
                                                        merged_away = True
                                                except Exception:
                                                    pass
                                                # стиль ячейки
                                                cell_style = {}
                                                try:
                                                    if c.fill and c.fill.fore_color is not None:
                                                        hc = _color_css(c.fill.fore_color, scheme or {})
                                                        if hc and hc.upper() != '#FFFFFF':
                                                            cell_style['background'] = hc
                                                except:
                                                    pass
                                                try:
                                                    # font of first paragraph
                                                    if c.text_frame and c.text_frame.paragraphs and c.text_frame.paragraphs[0].runs:
                                                        rr = c.text_frame.paragraphs[0].runs[0]
                                                        if rr.font.color is not None:
                                                            hc = _color_css(rr.font.color, scheme or {})
                                                            if hc:
                                                                cell_style['color'] = hc
                                                        if rr.font.bold is not None:
                                                            cell_style['bold'] = bool(rr.font.bold)
                                                except:
                                                    pass
                                                # границы ячейки tcBdr + вертикальный якорь + отступы
                                                try:
                                                    _tcPr = c._tc.find('{http://schemas.openxmlformats.org/drawingml/2006/main}tcPr')
                                                    if _tcPr is not None:
                                                        for _side, _css in (('lnL', 'borderLeft'), ('lnR', 'borderRight'), ('lnT', 'borderTop'), ('lnB', 'borderBottom')):
                                                            _ln = _tcPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}' + _side)
                                                            if _ln is None:
                                                                continue
                                                            try:
                                                                _bw = max(1, round(int(_ln.get('w') or 12700) / 12700))
                                                            except Exception:
                                                                _bw = 1
                                                            _bc = None
                                                            try:
                                                                _sf = _ln.find('{http://schemas.openxmlformats.org/drawingml/2006/main}solidFill')
                                                                if _sf is not None and len(_sf):
                                                                    _cc = _sf[0]
                                                                    _tag = _cc.tag.split('}')[-1]
                                                                    if _tag == 'srgbClr' and _cc.get('val'):
                                                                        _bc = '#' + _cc.get('val').upper()
                                                                    elif _tag == 'schemeClr' and _cc.get('val'):
                                                                        _bc = (scheme or {}).get(_cc.get('val')) or None
                                                                    if _bc:
                                                                        _al = _cc.find('{http://schemas.openxmlformats.org/drawingml/2006/main}alpha')
                                                                        if _al is not None and _al.get('val'):
                                                                            try:
                                                                                _av = max(0.0, min(1.0, int(_al.get('val')) / 100000.0))
                                                                                if _av < 0.999:
                                                                                    _bc = _hex_to_rgba(_bc, _av)
                                                                            except Exception:
                                                                                pass
                                                            except Exception:
                                                                pass
                                                            cell_style[_css] = '%dpx solid %s' % (_bw, _bc or '#94A3B8')
                                                        _anch = (_tcPr.get('anchor') or '').lower()
                                                        if _anch in ('ctr', 'b', 't'):
                                                            cell_style['anchorItems'] = {'ctr': 'center', 'b': 'flex-end', 't': 'flex-start'}[_anch]
                                                        try:
                                                            _mar = []
                                                            for _mk in ('marT', 'marR', 'marB', 'marL'):
                                                                _mv = _tcPr.get(_mk)
                                                                _mar.append(round(int(_mv) / 914400 * 96, 1) if _mv else 0)
                                                            if max(_mar) > 1:
                                                                cell_style['cellPad'] = _mar
                                                        except Exception:
                                                            pass
                                                except Exception:
                                                    pass
                                                row_cells.append({'text': txt, 'style': cell_style, 'colspan': colspan, 'rowspan': rowspan, 'merged': merged_away})
                                            cells.append(row_cells)
                                        geom = _geom(shape)
                                        style = {'x': geom['x'], 'y': geom['y'], 'w': geom['w'], 'h': geom['h'], 'z': z, 'unit': '%'}
                                        blocks.append({'id': uuid.uuid4().hex[:8], 'type':'table','table':{'rows': rows, 'cols': cols, 'cells': cells}, 'style': style})
                                        continue
                                except:
                                    pass
                                # TEXT
                                try:
                                    _phk = 'other'
                                    if getattr(shape, 'is_placeholder', False):
                                        try:
                                            _pht = int(shape.placeholder_format.type)
                                        except Exception:
                                            _pht = -1
                                        if _pht in (1, 3, 5):
                                            _phk = 'title'
                                        elif _pht in (2, 4, 6):
                                            _phk = 'body'
                                except Exception:
                                    _phk = 'other'
                                _fbm = dict((typo or {}).get('other') or {})
                                _fbm.update((typo or {}).get('body') or {})
                                _fbm.update((typo or {}).get(_phk) or {})
                                tex = _extract_text_frame(shape, bg, scheme, _fbm or None)
                                if tex:
                                    full_txt, paragraphs, first_style, has_bullet = tex
                                    if full_txt and len(full_txt.strip()) > 0:
                                        geom = _geom(shape)
                                        # фон фигуры для текста
                                        fill_bg, _ = _extract_shape_fill_css(shape, scheme)
                                        # line для bullet
                                        style = {
                                            'x': geom['x'], 'y': geom['y'], 'w': geom['w'], 'h': geom['h'],
                                            'rotation': geom.get('rotation',0), 'z': z, 'unit': '%',
                                        }
                                        # если paragraphs имеют разные aligns — сохраним per paragraph, иначе в style
                                        # для совместимости сохраним align/fontSize/color из first paragraph
                                        if first_style:
                                            for k in ['fontSize','bold','italic','underline','color','fontFamily','highlight']:
                                                if k in first_style:
                                                    style[k] = first_style[k]
                                        # если единый align у всех
                                        try:
                                            aligns = set(p['align'] for p in paragraphs)
                                            if len(aligns) == 1:
                                                style['align'] = paragraphs[0]['align']
                                            else:
                                                style['align'] = 'left'
                                        except:
                                            style['align'] = 'left'
                                        if has_bullet:
                                            style['bullet'] = True
                                        try:
                                            _flh = paragraphs[0].get('lineHeight') if paragraphs else None
                                            if _flh:
                                                style['lineHeight'] = _flh
                                            elif (_fbm or {}).get('lineHeight'):
                                                style['lineHeight'] = _fbm['lineHeight']
                                        except Exception:
                                            pass
                                        if fill_bg and fill_bg.upper() not in ('#FFFFFF',):
                                            style['background'] = fill_bg
                                        # обводка текстового бокса (иначе карты с рамкой её теряют)
                                        try:
                                            _tl, _tw, _td = _extract_shape_line(shape, scheme)
                                            if _tl and _tw:
                                                style['stroke'] = _tl
                                                style['strokeWidth'] = _tw
                                                style['dash'] = _td or 'solid'
                                        except Exception:
                                            pass
                                        # highlight flag из runs
                                        try:
                                            has_hl = any(any(r.get('style',{}).get('highlight') for r in p['runs']) for p in paragraphs)
                                            if has_hl:
                                                style['highlight'] = True
                                        except:
                                            pass
                                        # lightness fix ТОЛЬКО если фон слайда светлый и текст светлый без своего фона
                                        try:
                                            col = style.get('color','')
                                            if col and _is_light(col) and not fill_bg and bg and bg.startswith('#') and _is_light(bg):
                                                # белый на белом → тёмный
                                                style['color'] = '#1e293b'
                                            # тёмный фон + белый текст — оставляем как есть
                                            try:
                                                _fc = (fill_bg or '')
                                                if _fc.startswith('#') and _is_dark(_fc):
                                                    _cc = style.get('color', '')
                                                    if _cc and _cc.startswith('#') and _is_dark(_cc):
                                                        style['color'] = '#F8FAFC'
                                            except Exception:
                                                pass
                                        except:
                                            pass
                                        # lineHeight / vertical anchor (по имени enum: TOP/MIDDLE/BOTTOM; str вида "MIDDLE (3)")
                                        try:
                                            if shape.text_frame and hasattr(shape.text_frame, 'vertical_anchor') and shape.text_frame.vertical_anchor is not None:
                                                _van = str(shape.text_frame.vertical_anchor).split(' ')[0].split('.')[-1].upper()
                                                va_map = {'TOP': 'top', 'MIDDLE': 'middle', 'BOTTOM': 'bottom',
                                                          'TOP_CENTERED': 'top', 'BOTTOM_CENTERED': 'bottom'}
                                                style['verticalAlign'] = va_map.get(_van, 'top')
                                        except:
                                            pass
                                        # wrap (None in pptx means default ON)
                                        try:
                                            _ww = shape.text_frame.word_wrap if hasattr(shape.text_frame, 'word_wrap') else None
                                            style['wordWrap'] = True if _ww is None else bool(_ww)
                                        except:
                                            pass
                                        # inner margins EMU -> % of slide
                                        try:
                                            _tfm = shape.text_frame
                                            _ml = float(_tfm.margin_left or 0) / float(slide_width) * 100
                                            _mr = float(_tfm.margin_right or 0) / float(slide_width) * 100
                                            _mt = float(_tfm.margin_top or 0) / float(slide_height) * 100
                                            _mb = float(_tfm.margin_bottom or 0) / float(slide_height) * 100
                                            if max(_ml, _mr, _mt, _mb) > 0.15:
                                                style['paddingPct'] = [round(_mt, 2), round(_mr, 2), round(_mb, 2), round(_ml, 2)]
                                        except Exception:
                                            pass
                                        if len(full_txt) > 8000:
                                            full_txt = full_txt[:8000]
                                        # финальный блок с paragraphs для rich rendering
                                        blocks.append({
                                            'id': uuid.uuid4().hex[:8],
                                            'type':'text',
                                            'content': full_txt,
                                            'paragraphs': paragraphs,
                                            'style': style
                                        })
                                        continue
                                # LINE/CONNECTOR: линия без заливки и текста — сохраняем как line-блок, иначе дропается молча
                                try:
                                    if getattr(shape, 'shape_type', None) == MSO_SHAPE_TYPE.LINE:
                                        _geom4 = _geom(shape)
                                        _lcol, _lw, _ldash = _extract_shape_line(shape, scheme)
                                        blocks.append({
                                            'id': uuid.uuid4().hex[:8], 'type': 'shape', 'shape': 'line',
                                            'style': {'fill': 'transparent', 'stroke': _lcol or '#64748B',
                                                      'strokeWidth': _lw or 1, 'dash': _ldash or 'solid',
                                                      'x': _geom4['x'], 'y': _geom4['y'],
                                                      'w': max(_geom4['w'], 2), 'h': max(_geom4['h'], 2),
                                                      'rotation': _geom4.get('rotation', 0), 'z': z, 'unit': '%',
                                                      'borderRadius': 4}
                                        })
                                        continue
                                except Exception:
                                    pass
                                # SMARTART/CHART без text_frame: диаграмму — таблицей с данными, SmartArt — текстом узлов
                                try:
                                    _gtext = _extract_graphic_text(shape)
                                    _ctable = _extract_chart_table(shape)
                                    if _ctable:
                                        _geom3 = _geom(shape)
                                        blocks.append({
                                            'id': uuid.uuid4().hex[:8], 'type': 'table', 'table': _ctable,
                                            'style': {'x': _geom3['x'], 'y': _geom3['y'], 'w': _geom3['w'], 'h': _geom3['h'],
                                                      'rotation': _geom3.get('rotation', 0), 'z': z, 'unit': '%'}
                                        })
                                        continue
                                    if _gtext:
                                        _geom3 = _geom(shape)
                                        blocks.append({
                                            'id': uuid.uuid4().hex[:8], 'type': 'text', 'content': _gtext,
                                            'style': {'x': _geom3['x'], 'y': _geom3['y'], 'w': _geom3['w'], 'h': _geom3['h'],
                                                      'rotation': _geom3.get('rotation', 0), 'z': z, 'unit': '%',
                                                      'fontSize': 14, 'color': '#334155', 'align': 'left'}
                                        })
                                        continue
                                except Exception:
                                    pass
                                # undecorated shapes incl freeform: fills/cards, white cards, thin lines
                                try:
                                    fill_bg2, _ = _extract_shape_fill_css(shape, scheme)
                                    line_col2, line_w2, line_dash2 = _extract_shape_line(shape, scheme)
                                    geom2 = _geom(shape)
                                    try:
                                        _svgd, _svw, _svh = _extract_custgeom_path(shape)
                                    except Exception:
                                        _svgd, _svw, _svh = None, 0, 0
                                    try:
                                        _sp2 = shape._element.spPr
                                        _pg2 = _sp2.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom') if _sp2 is not None else None
                                        _prst2 = _pg2.get('prst') if _pg2 is not None else None
                                    except Exception:
                                        _prst2 = None
                                    # adj скругления: roundRect с adj=0 = острые углы (не скругляем!)
                                    _radius_pct = None
                                    try:
                                        if _pg2 is not None and _prst2 in ('roundRect', 'round1Rect', 'round2SameRect', 'round2DiagRect'):
                                            _av = _pg2.find('{http://schemas.openxmlformats.org/drawingml/2006/main}avLst')
                                            _adj = 16666
                                            if _av is not None:
                                                for _gd in _av:
                                                    if _gd.get('name') == 'adj':
                                                        _fmla = (_gd.get('fmla') or '').split(' ')
                                                        _adj = int(_fmla[-1]) if _fmla else 16666
                                                        break
                                            _radius_pct = round(max(0, min(50000, _adj)) / 50000, 3)
                                    except Exception:
                                        pass
                                    up2 = (fill_bg2 or '').upper()
                                    is_white2 = up2 == '#FFFFFF'
                                    if fill_bg2 and geom2['w'] >= 1.5 and geom2['h'] >= 0.35:
                                        if is_white2 and not (5 < geom2['w'] < 98 and 3 < geom2['h'] < 95):
                                            pass
                                        else:
                                            is_deco2 = (not is_white2) and up2 in ('#FF8C69', '#7EDBD5', '#FFE66D', '#FF6B35') and (geom2['x'] < 15 or geom2['x'] > 75) and geom2['y'] < 20
                                            if not is_deco2:
                                                _shape_name = 'rect'
                                                try:
                                                    _pmap = {'ellipse': 'ellipse', 'diamond': 'diamond', 'triangle': 'triangle',
                                                             'rightTriangle': 'rightTriangle', 'pentagon': 'pentagon', 'hexagon': 'hexagon',
                                                             'star5': 'star', 'star': 'star', 'roundRect': 'rounded', 'round1Rect': 'rounded',
                                                             'round2SameRect': 'rounded', 'arrow': 'arrow', 'leftArrow': 'arrow',
                                                             'rightArrow': 'arrow', 'trapezoid': 'trapezoid', 'parallelogram': 'parallelogram',
                                                             'circle': 'circle', 'oval': 'ellipse'}
                                                    if _prst2 and _prst2 in _pmap:
                                                        _shape_name = _pmap[_prst2]
                                                except Exception:
                                                    pass
                                                style2 = {'fill': fill_bg2, 'x': geom2['x'], 'y': geom2['y'], 'w': geom2['w'], 'h': geom2['h'], 'rotation': geom2.get('rotation', 0), 'z': z - 0.5, 'unit': '%', 'borderRadius': 8}
                                                if _radius_pct is not None:
                                                    style2['radiusPct'] = _radius_pct
                                                # мелкие фигурки (<6% x <10%) — это иконки: рендерить без растягивания
                                                try:
                                                    if geom2['w'] < 6 and geom2['h'] < 10:
                                                        style2['icon'] = True
                                                except Exception:
                                                    pass
                                                if _svgd:
                                                    style2['svgPath'] = _svgd
                                                    style2['svgW'] = _svw
                                                    style2['svgH'] = _svh
                                                if _prst2:
                                                    style2['preset'] = _prst2
                                                if line_col2:
                                                    style2['stroke'] = line_col2
                                                    style2['strokeWidth'] = line_w2
                                                    style2['dash'] = line_dash2 or 'solid'
                                                if is_white2:
                                                    style2['shadow'] = True
                                                blocks.append({'id': uuid.uuid4().hex[:8], 'type': 'shape', 'shape': _shape_name, 'style': style2})
                                                continue
                                    if not fill_bg2 and line_col2 and line_w2:
                                        if geom2['w'] < 4 or geom2['h'] < 4:
                                            style2 = {'fill': 'transparent', 'stroke': line_col2, 'strokeWidth': line_w2, 'dash': line_dash2 or 'solid', 'x': geom2['x'], 'y': geom2['y'], 'w': max(geom2['w'], 2), 'h': max(geom2['h'], 2), 'rotation': geom2.get('rotation', 0), 'z': z - 0.5, 'unit': '%', 'borderRadius': 4}
                                            if _svgd:
                                                style2['svgPath'] = _svgd
                                                style2['svgW'] = _svw
                                                style2['svgH'] = _svh
                                            blocks.append({'id': uuid.uuid4().hex[:8], 'type': 'shape', 'shape': 'rect', 'style': style2})
                                            continue
                                except Exception:
                                    pass
                                pass
                        # end for shape

                        _walk_shapes(slide.shapes)
                        # фоновый дизайн из слоя/мастера: только не-плейсхолдеры без текста, позади всего
                        try:
                            _mh = []
                            try:
                                _mh.append(slide.slide_layout.slide_master)
                                _mh.append(slide.slide_layout)
                            except Exception:
                                pass
                            for _zb, _holder in ((-2000, _mh[0] if len(_mh) > 0 else None), (-1000, _mh[1] if len(_mh) > 1 else None)):
                                if _holder is None:
                                    continue
                                try:
                                    _extra = [s for s in _holder.shapes if not getattr(s, 'is_placeholder', False) and not (getattr(s, 'has_text_frame', False) and (s.text or '').strip())]
                                except Exception:
                                    _extra = []
                                if _extra:
                                    _walk_shapes(_extra, z_base=_zb)
                        except Exception:
                            pass
                        if not blocks:
                            # пустой слайд
                            blocks.append({'id': uuid.uuid4().hex[:8], 'type':'text','content': f'Слайд {idx+1}', 'style':{'color':'#94a3b8','align':'center','x':10,'y':40,'w':80,'h':20,'unit':'%'}})
                        # сортируем по y затем x для стабильного порядка если z одинаков, но сохраняем z
                        try:
                            blocks = sorted(blocks, key=lambda b: (b.get('style',{}).get('z', 0), b.get('style',{}).get('y', 0), b.get('style',{}).get('x', 0)))
                        except:
                            pass
                        # ограничиваем до 200 (плотные слайды с подложками)
                        blocks = blocks[:200]
                        # notes
                        notes_text = ''
                        try:
                            if slide.has_notes_slide and slide.notes_slide:
                                ns = slide.notes_slide
                                for shp in ns.shapes:
                                    if shp.has_text_frame and shp.text and shp.text.strip():
                                        if 'Click to edit' not in shp.text:
                                            notes_text += shp.text.strip() + '\n'
                                notes_text = notes_text.strip()[:2000]
                        except:
                            pass
                        # transition из оригинала, layout name
                        slide_transition = 'fade'
                        try:
                            slide_transition = _extract_transition(slide)
                        except Exception:
                            pass
                        layout_name = 'blank'
                        try:
                            layout_name = slide.slide_layout.name or 'blank'
                            layout_name = re.sub(r'[^a-zA-Z0-9_-]', '', layout_name)[:20].lower() or 'blank'
                        except:
                            pass
                        Slide.objects.create(
                            presentation=pres,
                            order=idx,
                            background=bg,
                            background_type=bg_type,
                            gradient=gradient,
                            bg_image=bg_image,
                            layout=layout_name,
                            transition=slide_transition,
                            width=sw,
                            height=sh,
                            content={'blocks': blocks},
                            notes=notes_text[:2000]
                        )
                        created_slides += 1
                finally:
                    try: os.unlink(tmp_path)
                    except: pass
                if created_slides == 0:
                    raise ValueError('Не удалось извлечь слайды из файла')
            elif ext == '.pdf':
                # рендерим страницы PDF в картинки (PyMuPDF) — слайды как в оригинале
                import tempfile as _tf
                import uuid as _uuid
                with _tf.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                    for chunk in file.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                try:
                    import fitz
                    doc = fitz.open(tmp_path)
                    from django.conf import settings as _s2
                    media_root = getattr(_s2, 'MEDIA_ROOT', 'media')
                    os.makedirs(os.path.join(media_root, 'pptx_images'), exist_ok=True)
                    max_pages = min(len(doc), 50)
                    for pno in range(max_pages):
                        page = doc[pno]
                        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                        fname = f"{_uuid.uuid4().hex}.png"
                        rel = f"pptx_images/{fname}"
                        pix.save(os.path.join(media_root, rel))
                        url = _s2.MEDIA_URL + rel
                        Slide.objects.create(
                            presentation=pres, order=pno, background='#ffffff', background_type='solid',
                            layout='blank', transition='fade', width=12192000, height=6858000,
                            content={'blocks': [{'id': _uuid.uuid4().hex[:8], 'type': 'image', 'src': url,
                                                 'style': {'x': 0, 'y': 0, 'w': 100, 'h': 100, 'z': 0, 'unit': '%'}}]},
                            notes='')
                        created_slides += 1
                    doc.close()
                finally:
                    try: os.unlink(tmp_path)
                    except: pass
                if created_slides == 0:
                    raise ValueError('Не удалось извлечь страницы из PDF')
        except Exception as e:
            pres.delete()
            import traceback; traceback.print_exc()
            return Response({'detail': f'Ошибка импорта: {str(e)[:500]}'}, status=400)
        try:
            from .models import UploadedFile
            file.seek(0)
            try:
                _validate_upload(file)
            except ValueError:
                pass
            else:
                uf = UploadedFile(title=title, owner=request.user if request.user.is_authenticated else None, is_public=is_pub)
                # сохраняем оригинальное имя без path-traversal
                safe_name = os.path.basename(file.name)[:100]
                uf.file.save(safe_name, file, save=True)
        except Exception:
            pass
        return Response(PresentationSerializer(pres, context={'request': request}).data, status=201)

    @action(detail=True, methods=['get','post'])
    def slides(self, request, pk=None):
        pres = self.get_object()
        if request.method == 'GET':
            slides = pres.slides.all()
            return Response(SlideSerializer(slides, many=True).data)
        # POST create slide — только владелец/админ
        is_admin = request.user.is_authenticated and (request.user.is_staff or getattr(request.user, 'role', None) == 'admin')
        if pres.owner_id is None:
            if not is_admin:
                return Response({'error': 'Нет прав'}, status=403)
        elif not request.user.is_authenticated or (pres.owner_id != request.user.id and not is_admin):
            return Response({'error': 'Нет прав'}, status=403)
        data = request.data.copy()
        data['presentation'] = pres.id
        # auto order
        if 'order' not in data:
            data['order'] = pres.slides.count()
        ser = SlideSerializer(data=data)
        if ser.is_valid():
            ser.save()
            return Response(ser.data, status=201)
        return Response(ser.errors, status=400)

    @action(detail=True, methods=['post'])
    def reorder(self, request, pk=None):
        pres = self.get_object()
        # проверка владельца (owner=None — только админ)
        is_admin = request.user.is_authenticated and (getattr(request.user, 'role', None) == 'admin' or request.user.is_staff)
        if pres.owner_id is None:
            if not is_admin:
                return Response({'error':'Нет прав'}, status=403)
        elif not request.user.is_authenticated or (pres.owner_id != request.user.id and not is_admin):
            return Response({'error':'Нет прав'}, status=403)
        order = request.data.get('order', [])  # list of slide ids
        # валидация: только слайды этой презентации
        valid_ids = set(pres.slides.values_list('id', flat=True))
        for idx, sid in enumerate(order):
            if sid in valid_ids:
                Slide.objects.filter(id=sid, presentation=pres).update(order=idx)
        return Response({'status':'ok'})

class SlideViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    queryset = Slide.objects.all()
    serializer_class = SlideSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        pres = serializer.validated_data.get('presentation')
        is_admin = self.request.user.is_authenticated and (getattr(self.request.user, 'role', None) == 'admin' or self.request.user.is_staff)
        if pres is not None:
            if pres.owner_id is None:
                if not is_admin:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Нет прав на добавление слайдов")
            elif not self.request.user.is_authenticated or (pres.owner_id != self.request.user.id and not is_admin):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Нет прав на добавление слайдов")
        serializer.save()

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_authenticated and (getattr(self.request.user, 'role', None) == 'admin' or self.request.user.is_staff)
        owner_id = obj.presentation.owner_id if obj.presentation else None
        if owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Нет прав")
        elif not self.request.user.is_authenticated or (owner_id != self.request.user.id and not is_admin):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Нет прав")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_authenticated and (getattr(self.request.user, 'role', None) == 'admin' or self.request.user.is_staff)
        owner_id = instance.presentation.owner_id if instance.presentation else None
        if owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Нет прав")
        elif not self.request.user.is_authenticated or (owner_id != self.request.user.id and not is_admin):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Нет прав")
        instance.delete()
