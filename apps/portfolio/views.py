import os
from urllib.parse import quote
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.http import FileResponse, HttpResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Achievement, ALLOWED_EXTENSIONS, FILE_MAX_MB
from .serializers import AchievementSerializer

_MIME_BY_EXT = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}


def _can_view(viewer, student) -> bool:
    """Портфолио смотрит: сам ученик, админ/ассистент, учитель класса ученика, родитель ребёнка."""
    if viewer.id == student.id or getattr(viewer, 'is_staff', False) or getattr(viewer, 'role', '') == 'admin':
        return True
    if getattr(viewer, 'role', '') == 'teacher':
        from apps.classroom.models import Enrollment
        return Enrollment.objects.filter(classroom__owner=viewer, student=student).exists()
    if getattr(viewer, 'role', '') == 'parent':
        return viewer.parent_links.filter(student=student).exists()
    return False


def _who(request):
    """Разобрать ?user=<ник>: по умолчанию сам пользователь. 403 если нельзя смотреть, None если нет такого."""
    u = request.user
    nick = (request.query_params.get('user') or '').strip()
    U = get_user_model()
    if not nick:
        return u
    stu = U.objects.filter(username__iexact=nick).first()
    if not stu:
        return None
    if stu.id != u.id and not _can_view(u, stu):
        raise PermissionDenied('Нет прав смотреть это портфолио')
    return stu


def _best_works(student, limit=12):
    """Лучшие сдачи по (% от максимума): задания + тесты + письменные проекты ученика."""
    from apps.classroom.models import Submission
    subs = (Submission.objects.filter(student=student, status__in=['submitted', 'late'],
                                      assignment__isnull=False)
            .filter(models.Q(score__isnull=False) | ~models.Q(answer=''))
            .select_related('assignment__classroom', 'assignment__topic')
            .order_by('-created_at'))
    works = []
    seen = set()
    for s in subs:
        a = s.assignment
        mx = a.max_score or 100
        pct = round((s.score or 0) / mx * 100, 1) if s.score is not None else None
        key = (a.id,)
        # одна работа на задание — хранить лучшую попытку
        if key in seen:
            continue
        seen.add(key)
        works.append({
            'assignment_id': a.id, 'title': a.title, 'kind': a.kind,
            'classroom': a.classroom.title, 'topic': a.topic.title if a.topic else '',
            'score': s.score, 'max_score': mx, 'pct': pct,
            'answer': (s.answer or '')[:400],
            'url': a.url or '',
            'submitted_at': s.created_at,
        })
    works.sort(key=lambda w: (w['score'] is not None, w['pct'] if w['pct'] is not None else -1), reverse=True)
    return works[:limit]


class PortfolioView(APIView):
    """GET /api/portfolio/?user=<ник> — портфолио: работы, достижения, карта знаний."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student = _who(request)
        if student is None:
            return Response({'error': 'Ученик не найден'}, status=status.HTTP_404_NOT_FOUND)
        prog = None
        if getattr(request.user, 'role', '') != 'student' or student.id == request.user.id:
            from apps.school.views import _topic_mastery
            prog = _topic_mastery(student)
        works = _best_works(student)
        ach = AchievementSerializer(
            Achievement.objects.filter(student=student).select_related('added_by'),
            many=True, context={'request': request}).data
        diag_avg = None
        if prog and prog.get('diagnostics'):
            scores = [d['score'] for d in prog['diagnostics'] if d.get('score') is not None]
            diag_avg = round(sum(scores) / len(scores), 1) if scores else None
        return Response({
            'username': student.username,
            'first_name': student.first_name or '',
            'avatar': student.avatar.url if getattr(student, 'avatar', None) else None,
            'is_self': student.id == request.user.id,
            'progress': prog,
            'works': works,
            'achievements': ach,
            'diag_avg': diag_avg,
        })


class PortfolioStudentsView(APIView):
    """GET /api/portfolio/students/ — для учителя/админа: чьи портфолио можно открыть."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        if not (u.is_staff or getattr(u, 'role', '') in ('teacher', 'admin')):
            raise PermissionDenied('Только для учителя и админа')
        from apps.classroom.models import Enrollment
        qs = get_user_model().objects.filter(role='student')
        if not (u.is_staff or getattr(u, 'role', '') == 'admin'):
            qs = (qs.filter(enrollments__classroom__owner=u)
                  .exclude(enrollments__access_granted=False).distinct())
        # автокомплит: поиск по нику/имени, до 50 совпадений; без q — как раньше, до 400
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(models.Q(username__icontains=q) | models.Q(first_name__icontains=q))
            limit = 50
        else:
            limit = 400
        is_admin = bool(u.is_staff or getattr(u, 'role', '') == 'admin')
        out = []
        for s in qs.order_by('username')[:limit]:
            enr_qs = Enrollment.objects.filter(student=s).exclude(access_granted=False).select_related('classroom')
            if not is_admin:
                enr_qs = enr_qs.filter(classroom__owner=u)
            classes = [e.classroom.title for e in enr_qs]
            out.append({'id': s.id, 'username': s.username, 'first_name': s.first_name or '',
                        'classes': classes})
        return Response(out)


class AchievementCreateView(APIView):
    """POST /api/portfolio/achievements/ {user, title, kind, description, event_date} —
    учитель класса ученика или админ. Поддерживает JSON и multipart/form-data (файл)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        u = request.user
        nick = (request.data.get('user') or '').strip()
        is_teacher_or_admin = bool(u.is_staff or getattr(u, 'role', '') in ('teacher', 'admin'))
        if not is_teacher_or_admin:
            raise PermissionDenied('Добавлять достижения в портфолио может только учитель или администратор')
        stu = get_user_model().objects.filter(username__iexact=nick).first() if nick else u
        if not stu:
            return Response({'error': 'Ученик не найден'}, status=status.HTTP_404_NOT_FOUND)
        if not (u.is_staff or getattr(u, 'role', '') == 'admin') and stu.id != u.id:
            from apps.classroom.models import Enrollment
            if not Enrollment.objects.filter(classroom__owner=u, student=stu).exists():
                raise PermissionDenied('Ученик не в вашем классе')
        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'title': 'Введите название'}, status=status.HTTP_400_BAD_REQUEST)
        kind = request.data.get('kind') or 'gramota'
        if kind not in dict(Achievement.KIND_CHOICES):
            kind = 'gramota'
        # файл: расширение jpg/jpeg/png/webp/gif/pdf, размер до 8 МБ с проверкой сигнатуры
        f = request.FILES.get('file')
        if f is not None:
            ext = f.name.rsplit('.', 1)[-1].lower() if '.' in f.name else ''
            if ext not in ALLOWED_EXTENSIONS:
                return Response({'file': 'Можно только jpg, jpeg, png, webp, gif, pdf'},
                                status=status.HTTP_400_BAD_REQUEST)
            from apps.common.safety import validate_portfolio_file
            validate_portfolio_file(f, max_mb=FILE_MAX_MB)
        a = Achievement.objects.create(
            student=stu, title=title, kind=kind,
            description=(request.data.get('description') or '').strip(),
            event_date=request.data.get('event_date') or None, added_by=u, file=f or None)
        # Сохраняем копию байтов в MediaBlob (чтобы PDF/фото не пропадали после редеплоя Render)
        if a.file and a.file.name:
            try:
                from apps.content.views import store_media_blob
                disk_path = os.path.join(str(getattr(settings, 'MEDIA_ROOT', 'media')), a.file.name.replace('/', os.sep))
                if os.path.isfile(disk_path):
                    with open(disk_path, 'rb') as fh:
                        store_media_blob(a.file.name, fh.read())
            except Exception:
                pass
        return Response(AchievementSerializer(a, context={'request': request}).data, status=status.HTTP_201_CREATED)


class AchievementFileView(APIView):
    """GET /api/portfolio/achievements/<id>/file/ — защищённый просмотр/скачивание PDF и фото из портфолио."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        a = get_object_or_404(Achievement.objects.select_related('student'), pk=pk)
        if not _can_view(request.user, a.student):
            raise PermissionDenied('Нет прав просматривать этот файл')
        if not a.file or not a.file.name:
            raise Http404('Файл не прикреплён')

        rel_name = a.file.name.replace('\\', '/').lstrip('/')
        ext = os.path.splitext(rel_name)[1].lower()
        ctype = _MIME_BY_EXT.get(ext, 'application/octet-stream')
        fname = os.path.basename(rel_name) or f'achievement_{a.id}{ext}'
        download = request.query_params.get('download') in ('1', 'true', 'yes')
        disp = 'attachment' if download else 'inline'
        disp_hdr = f"{disp}; filename*=UTF-8''{quote(fname)}"

        disk_path = os.path.join(str(getattr(settings, 'MEDIA_ROOT', 'media')), rel_name.replace('/', os.sep))
        resp = None
        if os.path.isfile(disk_path):
            resp = FileResponse(open(disk_path, 'rb'), content_type=ctype)
        else:
            # Фолбэк в БД (MediaBlob) — спасает эфемерный диск Render
            from apps.content.models import MediaBlob
            blob = MediaBlob.objects.filter(key=rel_name).first()
            if blob and blob.data:
                try:
                    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
                    with open(disk_path, 'wb') as fh:
                        fh.write(bytes(blob.data))
                except Exception:
                    pass
                resp = HttpResponse(bytes(blob.data), content_type=ctype)
            else:
                raise Http404('Файл не найден на сервере')

        resp['Content-Disposition'] = disp_hdr
        resp['X-Content-Type-Options'] = 'nosniff'
        resp['Cache-Control'] = 'private, max-age=3600'
        return resp


class AchievementDeleteView(APIView):
    """DELETE /api/portfolio/achievements/<id>/ — создавший (учитель) или админ."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        u = request.user
        a = get_object_or_404(Achievement, pk=pk)
        if not (u.is_staff or a.added_by_id == u.id or getattr(u, 'role', '') == 'admin'):
            raise PermissionDenied('Удалять может автор или админ')
        a.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
