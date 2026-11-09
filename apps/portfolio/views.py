from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Achievement
from .serializers import AchievementSerializer


def _can_view(viewer, student) -> bool:
    """Портфолио смотрит: сам ученик, админ, учитель класса ученика, родитель ребёнка."""
    if viewer.id == student.id or getattr(viewer, 'is_staff', False):
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
    """Лучшие сдачи по (% от максимума): задания + тесты ученика."""
    from apps.classroom.models import Submission
    subs = (Submission.objects.filter(student=student, status__in=['submitted', 'late'],
                                      score__isnull=False, assignment__isnull=False)
            .select_related('assignment__classroom', 'assignment__topic')
            .order_by('-created_at'))
    works = []
    seen = set()
    for s in subs:
        a = s.assignment
        mx = a.max_score or 100
        pct = round((s.score or 0) / mx * 100, 1)
        key = (a.id,)
        # одна работа на задание — хранить лучшую попытку
        if key in seen:
            continue
        seen.add(key)
        works.append({
            'assignment_id': a.id, 'title': a.title, 'kind': a.kind,
            'classroom': a.classroom.title, 'topic': a.topic.title if a.topic else '',
            'score': s.score, 'max_score': mx, 'pct': pct,
            'submitted_at': s.created_at,
        })
    works.sort(key=lambda w: w['pct'], reverse=True)
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
            Achievement.objects.filter(student=student).select_related('added_by'), many=True).data
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
        out = []
        for s in qs.order_by('username')[:400]:
            classes = [e.classroom.title for e in
                       Enrollment.objects.filter(student=s, classroom__owner=u)
                       .exclude(access_granted=False)]
            out.append({'id': s.id, 'username': s.username, 'first_name': s.first_name or '',
                        'classes': classes})
        return Response(out)


class AchievementCreateView(APIView):
    """POST /api/portfolio/achievements/ {user, title, kind, description, event_date} —
    учитель класса ученика или админ."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        u = request.user
        if not (u.is_staff or getattr(u, 'role', '') in ('teacher', 'admin')):
            raise PermissionDenied('Только для учителя и админа')
        nick = (request.data.get('user') or '').strip()
        stu = get_user_model().objects.filter(username__iexact=nick).first()
        if not stu:
            return Response({'error': 'Ученик не найден'}, status=status.HTTP_404_NOT_FOUND)
        if not (u.is_staff or getattr(u, 'role', '') == 'admin'):
            from apps.classroom.models import Enrollment
            if not Enrollment.objects.filter(classroom__owner=u, student=stu).exists():
                raise PermissionDenied('Ученик не в вашем классе')
        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'title': 'Введите название'}, status=status.HTTP_400_BAD_REQUEST)
        kind = request.data.get('kind') or 'gramota'
        if kind not in dict(Achievement.KIND_CHOICES):
            kind = 'gramota'
        a = Achievement.objects.create(
            student=stu, title=title, kind=kind,
            description=(request.data.get('description') or '').strip(),
            event_date=request.data.get('event_date') or None, added_by=u)
        return Response(AchievementSerializer(a).data, status=status.HTTP_201_CREATED)


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
