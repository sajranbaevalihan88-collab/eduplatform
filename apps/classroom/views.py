from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from apps.accounts.permissions import IsTeacherOrAdmin
from .models import Classroom, Enrollment, Assignment, Submission, Announcement, AnnouncementComment
from .serializers import (ClassroomSerializer, EnrollmentSerializer, AssignmentSerializer,
                          SubmissionSerializer, AnnouncementSerializer, AnnouncementCommentSerializer)


def _is_admin(u):
    return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'role', None) == 'admin'))


def _is_teacher(u):
    return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'role', None) in ('teacher', 'admin')))


def _visible_classrooms(user):
    qs = Classroom.objects.select_related('owner', 'subject').all()
    if not user or not user.is_authenticated:
        return qs.none()
    if _is_admin(user):
        return qs
    return qs.filter(Q(owner=user) | Q(enrollments__student=user)).distinct()


class ClassroomViewSet(viewsets.ModelViewSet):
    serializer_class = ClassroomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = _visible_classrooms(self.request.user)
        mine = self.request.query_params.get('mine')
        if mine == 'teach':
            qs = qs.filter(owner=self.request.user)
        elif mine == 'study':
            qs = qs.filter(enrollments__student=self.request.user)
        return qs

    def perform_create(self, serializer):
        if not _is_teacher(self.request.user):
            raise PermissionDenied('Классы создают учителя')
        serializer.save(owner=self.request.user)

    def _get_owned(self):
        obj = self.get_object()
        u = self.request.user
        if not (_is_admin(u) or obj.owner_id == u.id):
            raise PermissionDenied('Только владелец класса')
        return obj

    def perform_update(self, serializer):
        self._get_owned()
        serializer.save()

    def perform_destroy(self, instance):
        self._get_owned()
        instance.delete()

    @action(detail=False, methods=['post'])
    def join(self, request):
        code = str(request.data.get('code') or '').strip().upper()
        if not code:
            raise ValidationError({'code': 'Введи код приглашения'})
        try:
            room = Classroom.objects.get(invite_code=code)
        except Classroom.DoesNotExist:
            raise NotFound('Класс с таким кодом не найден')
        if room.owner_id == request.user.id:
            return Response(ClassroomSerializer(room).data)
        Enrollment.objects.get_or_create(classroom=room, student=request.user)
        return Response(ClassroomSerializer(room).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        room = self.get_object()
        if room.owner_id == request.user.id:
            raise ValidationError({'detail': 'Владелец не может покинуть свой класс'})
        Enrollment.objects.filter(classroom=room, student=request.user).delete()
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def regenerate_code(self, request, pk=None):
        from .models import gen_code
        room = self._get_owned()
        for _ in range(20):
            code = gen_code()
            if not Classroom.objects.filter(invite_code=code).exists():
                room.invite_code = code
                room.save(update_fields=['invite_code'])
                break
        return Response({'invite_code': room.invite_code})

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        room = self.get_object()
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        qs = room.enrollments.select_related('student').all()
        return Response(EnrollmentSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        room = self._get_owned()
        username = str(request.data.get('username') or '').strip()
        if not username:
            raise ValidationError({'username': 'Введи логин ученика'})
        from django.contrib.auth import get_user_model
        try:
            user = get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist:
            raise NotFound(f'Пользователь {username} не найден')
        if user.id == room.owner_id:
            raise ValidationError({'username': 'Это владелец класса'})
        Enrollment.objects.get_or_create(classroom=room, student=user)
        return Response({'ok': True, 'username': user.username})

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        room = self._get_owned()
        username = str(request.data.get('username') or '').strip()
        from django.contrib.auth import get_user_model
        try:
            user = get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist:
            raise NotFound(f'Пользователь {username} не найден')
        Enrollment.objects.filter(classroom=room, student=user).delete()
        return Response({'ok': True})

    @action(detail=True, methods=['get'])
    def gradebook(self, request, pk=None):
        room = self._get_owned()
        students = list(room.enrollments.select_related('student').all())
        assignments = list(room.assignments.order_by('deadline', '-created_at', 'id'))
        # колонки журнала: сначала автозадания с дедлайнами, ручные — после, по порядку создания
        assignments.sort(key=lambda a: (
            1 if a.kind == 'manual' else 0,
            a.deadline.timestamp() if a.deadline else 0,
            a.id))
        subs = Submission.objects.filter(assignment__in=assignments).select_related('student')
        sub_map = {(s.assignment_id, s.student_id): s for s in subs}
        now = timezone.now()
        cells = [
            {'assignment': a.id, 'student': e.student.id,
             'status': (sub_map[(a.id, e.student.id)].status if (a.id, e.student.id) in sub_map
                        else ('overdue' if (a.deadline and a.deadline < now) else 'pending')),
             'score': (sub_map[(a.id, e.student.id)].score if (a.id, e.student.id) in sub_map else None)}
            for a in assignments for e in students
        ]
        avgs_s = {}
        for e in students:
            vals = [c['score'] for c in cells if c['student'] == e.student.id and c['score'] is not None]
            avgs_s[str(e.student.id)] = round(sum(vals) / len(vals), 1) if vals else None
        avgs_a = {}
        for a in assignments:
            vals = [c['score'] for c in cells if c['assignment'] == a.id and c['score'] is not None]
            avgs_a[str(a.id)] = round(sum(vals) / len(vals), 1) if vals else None
        return Response({
            'students': [{'id': e.student.id, 'username': e.student.username} for e in students],
            'assignments': [{'id': a.id, 'title': a.title, 'kind': a.kind,
                             'deadline': a.deadline, 'max_score': a.max_score} for a in assignments],
            'cells': cells,
            'avg_student': avgs_s,
            'avg_assignment': avgs_a,
        })

    @action(detail=True, methods=['post'])
    def gradebook_score(self, request, pk=None):
        """Ручная оценка в журнале: {assignment, student, score|null} (owner-only)."""
        room = self._get_owned()
        a_id = request.data.get('assignment')
        s_id = request.data.get('student')
        try:
            a = room.assignments.get(pk=int(a_id))
        except (Assignment.DoesNotExist, TypeError, ValueError):
            raise NotFound('Колонка не найдена')
        try:
            e = room.enrollments.get(student_id=int(s_id))
        except (Enrollment.DoesNotExist, TypeError, ValueError):
            raise NotFound('Ученик не найден')
        raw = request.data.get('score')
        if raw is None or raw == '':
            Submission.objects.filter(assignment=a, student=e.student).delete()
            return Response({'ok': True, 'assignment': a.id, 'student': e.student.id, 'score': None})
        try:
            score = float(raw)
        except (TypeError, ValueError):
            raise ValidationError({'score': 'Число'})
        if score < 0:
            raise ValidationError({'score': 'Не меньше 0'})
        if score > (a.max_score or 0):
            raise ValidationError({'score': f'Не больше {a.max_score}'})
        sub, _ = Submission.objects.update_or_create(
            assignment=a, student=e.student,
            defaults={'status': 'submitted', 'score': score})
        return Response(SubmissionSerializer(sub).data)

    @action(detail=True, methods=['get'])
    def my_tasks(self, request, pk=None):
        """Задания класса со статусом текущего ученика (для виджета 'осталось сдать')."""
        room = self.get_object()
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        assignments = list(room.assignments.exclude(kind='manual').order_by('deadline', '-created_at', 'id'))
        sub_map = {s.assignment_id: s for s in Submission.objects.filter(
            assignment__in=assignments, student=request.user)}
        now = timezone.now()
        out = []
        for a in assignments:
            s = sub_map.get(a.id)
            if s:
                st = s.status
            elif a.deadline and a.deadline < now:
                st = 'overdue'
            else:
                st = 'pending'
            out.append({'id': a.id, 'title': a.title, 'kind': a.kind,
                        'object_id': a.lesson_id if a.kind == 'lesson' else a.test_id,
                        'deadline': a.deadline, 'status': st,
                        'score': s.score if s else None})
        return Response(out)

    @action(detail=True, methods=['post'])
    def ai_report(self, request, pk=None):
        """⚡ Килллер-фича: ИИ-отчёт учителю по классу (Gemini), честный офлайн-фолбэк.
        POST /api/classrooms/{id}/ai_report/ -> {report, source, stats}"""
        room = self._get_owned()
        students = list(room.enrollments.select_related('student').all())
        assignments = list(room.assignments.select_related('lesson', 'test').all())
        subs = list(Submission.objects.filter(assignment__in=assignments).select_related('student', 'assignment'))
        test_ids = [a.test_id for a in assignments if a.kind == 'test' and a.test_id]
        per_student = {e.student_id: {'username': e.student.username, 'scores': [], 'done': 0, 'late': 0, 'missed': 0, 'attempts': []} for e in students}
        for s in subs:
            ps = per_student.get(s.student_id)
            if not ps:
                continue
            if s.score is not None:
                ps['scores'].append(s.score)
            ps['done' if s.status == 'submitted' else 'late'] += 1 if s.status in ('submitted', 'late') else 0
            if s.status == 'late':
                ps['late'] += 1
        now = timezone.now()
        for a in assignments:
            for e in students:
                done = any(s.student_id == e.student_id for s in subs if s.assignment_id == a.id)
                if not done:
                    overdue = bool(a.deadline and a.deadline < now)
                    per_student.get(e.student_id, {}).get('attempts', [])
                    key = 'missed' if overdue else 'pending'
                    ps = per_student.get(e.student_id)
                    if ps:
                        ps[key] = ps.get(key, 0) + 1
        if test_ids:
            from apps.assessments.models import TestAttempt
            for att in TestAttempt.objects.filter(test_id__in=test_ids).order_by('-created_at'):
                ps = per_student.get(att.user_id)
                if ps and att.score is not None and len(ps['attempts']) < 6:
                    ps['attempts'].append(round(att.score, 1))
        stats_students = []
        for sid, ps in per_student.items():
            avg = round(sum(ps['scores']) / len(ps['scores']), 1) if ps['scores'] else None
            stats_students.append({'username': ps['username'], 'avg': avg,
                                   'done': ps['done'], 'late': ps['late'],
                                   'missed': ps.get('missed', 0), 'pending': ps.get('pending', 0),
                                   'recent_attempts': ps['attempts']})
        stats = {'classroom': room.title, 'students_count': len(students),
                 'assignments_count': len(assignments), 'students': stats_students}
        from django.conf import settings as _dj
        from apps.assessments.services.gemini_text import generate_text
        import json as _json
        facts = _json.dumps(stats, ensure_ascii=False)
        prompt = (
            "Ты — ИИ-ассистент учителя. Собери КОРОТКИЙ живой отчёт по классу из данных JSON. "
            "Формат: markdown-lite текст с эмодзи, строго такие секции:\n"
            "🏆 Лидеры (2-3 имени + причина)\n⚠️ Нужна помощь (кто отстаёт: средний балл низкий/много пропусков)\n"
            "📚 Что повторить (темы по названиям заданий, где средний балл < 60% или много провалов)\n"
            "✅ Действия на следующую неделю (2-3 конкретных шага)\n"
            "Правила: только реальные имена/цифры из данных, БЕЗ выдумок; дружелюбно и по делу; не длиннее ~15 строк.\n\nДАННЫЕ:\n" + facts
        )
        text, used = generate_text(prompt, getattr(_dj, 'GEMINI_API_KEY', ''), getattr(_dj, 'GEMINI_MODEL', ''))
        if text:
            return Response({'report': text[:6000], 'source': f'gemini:{used}', 'stats': stats})
        # офлайн-фолбэк: честные числа, без выдумок
        with_score = [s for s in stats_students if s['avg'] is not None]
        leaders = sorted(with_score, key=lambda s: s['avg'], reverse=True)[:3]
        risky = [s for s in stats_students if (s['avg'] or 0) < 60 or s.get('missed', 0) > 0]
        lines = [f"📊 Класс «{room.title}»: {len(students)} учеников, заданий {len(assignments)}"]
        if leaders:
            lines.append('🏆 Лидеры: ' + ', '.join(f"{s['username']} (средний {s['avg']})" for s in leaders))
        if risky:
            lines.append('⚠️ Нужна помощь: ' + ', '.join(f"{s['username']}" + (f" (средний {s['avg']})" if s['avg'] else '') for s in risky[:5]))
        late_total = sum(s.get('late', 0) for s in stats_students)
        missed_total = sum(s.get('missed', 0) for s in stats_students)
        lines.append(f"⏰ Сдали с опозданием: {late_total} • пропустили дедлайн: {missed_total}")
        lines.append('✅ Действия: индивидуальные разборы со списком «Нужна помощь»; повторные попытки тестов с низким средним.')
        return Response({'report': '\n'.join(lines), 'source': 'offline', 'stats': stats})


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Assignment.objects.select_related('classroom', 'lesson', 'test').filter(
            classroom__in=_visible_classrooms(self.request.user))
        kind = self.request.query_params.get('kind')
        if kind:
            qs = qs.filter(kind=kind)
        else:
            qs = qs.exclude(kind='manual')
        room = self.request.query_params.get('classroom')
        if room:
            qs = qs.filter(classroom_id=room)
        return qs.order_by('deadline', '-created_at', 'id')

    def _owned_room(self, room):
        u = self.request.user
        if not (_is_admin(u) or room.owner_id == u.id):
            raise PermissionDenied('Задания создаёт владелец класса')
        return room

    def perform_create(self, serializer):
        room = serializer.validated_data.get('classroom')
        self._owned_room(room)
        serializer.save()

    def perform_update(self, serializer):
        obj = self.get_object()
        self._owned_room(obj.classroom)
        serializer.save()

    def perform_destroy(self, instance):
        self._owned_room(instance.classroom)
        instance.delete()

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Сдача задания учеником. Для теста баллы тянем из последней попытки."""
        a = self.get_object()
        u = request.user
        if not a.classroom.is_member(u):
            raise PermissionDenied('Ты не участник класса')
        if a.classroom.owner_id == u.id:
            raise PermissionDenied('Владелец не сдаёт свои задания')
        score = request.data.get('score')
        attempt = None
        if a.kind == 'test' and a.test_id:
            from apps.assessments.models import TestAttempt
            attempt = TestAttempt.objects.filter(test_id=a.test_id, user=u).order_by('-created_at').first()
            if attempt is not None:
                score = attempt.score
        try:
            score = None if score is None else float(score)
        except (TypeError, ValueError):
            score = None
        now = timezone.now()
        late = bool(a.deadline and now > a.deadline)
        sub, _ = Submission.objects.update_or_create(
            assignment=a, student=u,
            defaults={'status': 'late' if late else 'submitted',
                      'score': score, 'attempt': attempt})
        return Response(SubmissionSerializer(sub).data, status=200)


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        qs = Submission.objects.select_related('assignment', 'student', 'assignment__classroom').all()
        if _is_admin(u):
            pass
        elif _is_teacher(u):
            qs = qs.filter(Q(assignment__classroom__owner=u))
        else:
            qs = qs.filter(student=u)
        a = self.request.query_params.get('assignment')
        if a:
            qs = qs.filter(assignment_id=a)
        room = self.request.query_params.get('classroom')
        if room:
            qs = qs.filter(assignment__classroom_id=room)
        return qs.order_by('-updated_at')


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Announcement.objects.select_related('author', 'classroom').filter(
            classroom__in=_visible_classrooms(self.request.user))
        room = self.request.query_params.get('classroom')
        if room:
            qs = qs.filter(classroom_id=room)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        room = serializer.validated_data.get('classroom')
        u = self.request.user
        if not (_is_admin(u) or room.owner_id == u.id):
            raise PermissionDenied('Объявления публикует владелец класса')
        serializer.save(author=u)

    def perform_destroy(self, instance):
        u = self.request.user
        if not (_is_admin(u) or instance.classroom.owner_id == u.id):
            raise PermissionDenied('Только владелец класса')
        instance.delete()


class AnnouncementCommentViewSet(viewsets.ModelViewSet):
    """Комментарии к объявлениям: fullscreen по ?announcement=ID; пишет любой участник класса."""
    serializer_class = AnnouncementCommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        u = self.request.user
        qs = AnnouncementComment.objects.select_related('author', 'announcement', 'announcement__classroom').filter(
            announcement__classroom__in=_visible_classrooms(u))
        ann = self.request.query_params.get('announcement')
        if ann:
            qs = qs.filter(announcement_id=ann)
        return qs.order_by('created_at')

    def perform_create(self, serializer):
        ann = serializer.validated_data['announcement']
        u = self.request.user
        if not ann.classroom.is_member(u):
            raise PermissionDenied('Ты не участник класса')
        text = serializer.validated_data.get('text', '').strip()
        if not text:
            raise ValidationError({'text': 'Пустой комментарий'})
        serializer.validated_data['text'] = text[:2000]
        serializer.save(author=u)

    def perform_destroy(self, instance):
        u = self.request.user
        if not (u.is_staff or getattr(u, 'role', None) == 'admin'
                or instance.author_id == u.id or instance.announcement.classroom.owner_id == u.id):
            raise PermissionDenied('Удалить может автор или владелец класса')
        instance.delete()
