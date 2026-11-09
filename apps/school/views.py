"""API школьного слоя.

Роутер: /api/topics/ (CRUD + CSV-импорт программы).
Всё остальное (посещаемость, расписание, экспорт) — actions на ClassroomViewSet
через SchoolMixin (см. класс ниже).
"""
import csv
import io
from datetime import date, timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound

from apps.accounts.permissions import TeacherWriteMixin
from apps.classroom.models import Classroom
from .models import Topic, Attendance, LessonSlot, Substitution
from .serializers import (TopicSerializer, AttendanceSerializer,
                          LessonSlotSerializer, SubstitutionSerializer)


def _is_admin(u):
    return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'role', None) == 'admin'))


def _parse_date(s, field='date'):
    try:
        return date.fromisoformat(str(s or '').strip())
    except (ValueError, TypeError):
        raise ValidationError({field: 'Формат даты YYYY-MM-DD'})


class TopicViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    """Учебная программа КР: темы предмета по классам. Писать — учителю/админу."""
    serializer_class = TopicSerializer
    permission_classes = [permissions.IsAuthenticated]
    # тем в программе у предмета 20-50 — пагинация по 20 мешает фронту
    pagination_class = None

    def get_queryset(self):
        qs = Topic.objects.select_related('subject').all()
        subject = self.request.query_params.get('subject')
        if subject:
            if subject.isdigit():
                qs = qs.filter(subject_id=subject)
            else:
                qs = qs.filter(subject__slug=subject)
        grade = (self.request.query_params.get('grade') or '').strip()
        if grade != '':
            qs = qs.filter(grade=grade)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """Импорт программы: CSV `subject_slug;grade;num;title` (разделитель ';' или ',').
        Повторный импорт update_or_create — обновляет тематические строки, не дублирует."""
        u = request.user
        if not (_is_admin(u) or getattr(u, 'role', None) == 'teacher'):
            raise PermissionDenied('Программу импортирует учитель или админ')
        text = ''
        f = request.FILES.get('file')
        if f:
            text = f.read().decode('utf-8-sig', errors='replace')
        elif request.data.get('text'):
            text = str(request.data['text'])
        else:
            raise ValidationError({'file': 'Приложи CSV-файл или передай поле text'})
        from apps.catalog.models import Subject
        sample = text[:4096]
        try:
            delim = csv.Sniffer().delimiter(sample, delimiters=',;\t')
        except Exception:
            delim = ';' if sample.count(';') >= sample.count(',') else ','
        reader = csv.reader(io.StringIO(text), delimiter=delim)
        rows = [r for r in reader if r and any((c or '').strip() for c in r)]
        if not rows:
            raise ValidationError({'file': 'Пустой файл'})
        start = 1 if (len(rows[0]) >= 3 and not str(rows[0][2]).strip().isdigit()) else 0
        created, updated, skipped = 0, 0, []
        for i, r in enumerate(rows[start:], start=start + 1):
            r = [c.strip() for c in r] + [''] * (4 - len(r))
            slug, grade, num, title = r[0], r[1], r[2], r[3]
            subj = (Subject.objects.filter(slug=slug).first()
                    or Subject.objects.filter(name__iexact=slug).first())
            if not subj:
                skipped.append(f'строка {i}: предмет «{slug}» не найден')
                continue
            try:
                num = int(num)
            except (TypeError, ValueError):
                skipped.append(f'строка {i}: номер темы «{num}» не число')
                continue
            title = (title or '').strip()
            if not title:
                skipped.append(f'строка {i}: пустое название темы')
                continue
            _, was = Topic.objects.update_or_create(
                subject=subj, grade=str(grade), num=num,
                defaults={'title': title[:500], 'created_by': u})
            if was:
                updated += 1
            else:
                created += 1
        return Response({'created': created, 'updated': updated,
                         'skipped': skipped[:10], 'total_skip': len(skipped)})


class SchoolMixin:
    """Actions ClassroomViewSet: посещаемость, расписание, замены, экспорт CSV."""

    def _school_room(self, pk) -> Classroom:
        try:
            return Classroom.objects.get(pk=pk)
        except (Classroom.DoesNotExist, TypeError, ValueError):
            raise NotFound('Класс не найден')

    # ---------- посещаемость ----------
    @action(detail=True, methods=['get', 'post'])
    def attendance(self, request, pk=None):
        """GET ?date=YYYY-MM-DD — отметки за дату (виден участникам; родителю ?student=ник).
        POST — пачка отметок {date, marks:[{student, status, lesson_num?, note?}]} (владелец)."""
        room = self._school_room(pk)
        if request.method == 'POST':
            if not (_is_admin(request.user) or room.owner_id == request.user.id):
                raise PermissionDenied('Посещаемость отмечает владелец класса')
            d = _parse_date(request.data.get('date'))
            marks = request.data.get('marks') or []
            if not isinstance(marks, list) or not marks:
                raise ValidationError({'marks': 'Список отметок пуст'})
            allowed = ['present', 'absent', 'late', 'excused']
            prepared = []
            for m in marks:
                try:
                    sid = int(m.get('student'))
                except (TypeError, ValueError):
                    raise ValidationError({'student': 'student: id ученика'})
                if not room.enrollments.filter(student_id=sid).exclude(access_granted=False).exists():
                    raise ValidationError({'student': f'Ученик {sid} не в этом классе'})
                st = str(m.get('status') or '').strip()
                if st not in allowed:
                    raise ValidationError({'status': 'status: present|absent|late|excused'})
                try:
                    ln = int(m.get('lesson_num') or 0)
                except (TypeError, ValueError):
                    ln = 0
                note = str(m.get('note') or '')[:200]
                prepared.append((sid, max(0, min(9, ln)), st, note))
            from django.db import transaction as _tx
            out = []
            with _tx.atomic():
                for sid, ln, st, note in prepared:
                    rec, _ = Attendance.objects.update_or_create(
                        classroom=room, student_id=sid, date=d, lesson_num=ln,
                        defaults={'status': st, 'note': note, 'marked_by': request.user})
                    out.append(rec)
            return Response(AttendanceSerializer(out, many=True).data)
        d = _parse_date(request.query_params.get('date')
                        or timezone.localdate().isoformat())
        # родитель может смотреть посещаемость ТОЛЬКО своего привязанного ребёнка
        stu_nick = (request.query_params.get('student') or '').strip()
        if stu_nick and getattr(request.user, 'role', None) == 'parent':
            from apps.accounts.models import ParentLink
            from django.contrib.auth import get_user_model
            from django.db.models import Q as _Q
            stu = get_user_model().objects.filter(_Q(username__iexact=stu_nick)).first()
            if not stu or not ParentLink.objects.filter(parent=request.user, student=stu).exists():
                return Response({'error': 'Этот ученик не привязан к вашему аккаунту'}, status=403)
            if not room.is_member(stu):
                raise PermissionDenied('Ребёнок не в этом классе')
            qs = room.attendance.filter(date=d, student=stu).select_related('student')
            return Response(AttendanceSerializer(qs, many=True).data)
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        qs = room.attendance.filter(date=d).select_related('student')
        return Response(AttendanceSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'])
    def attendance_month(self, request, pk=None):
        """Сводка посещаемости класса за месяц: ?month=YYYY-MM."""
        room = self._school_room(pk)
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        mv = str(request.query_params.get('month') or timezone.localdate().strftime('%Y-%m'))
        try:
            y, m = int(mv.split('-')[0]), int(mv.split('-')[1])
        except (ValueError, IndexError):
            raise ValidationError({'month': 'Формат YYYY-MM'})
        qs = room.attendance.filter(date__year=y, date__month=m)
        per = {}
        for a in qs:
            s = per.setdefault(a.student_id, {'present': 0, 'absent': 0, 'late': 0,
                                              'excused': 0, 'absent_dates': []})
            s[a.status] = s.get(a.status, 0) + 1
            if a.status == 'absent':
                s['absent_dates'].append(str(a.date))
        names = {e.student_id: e.student.username
                 for e in room.enrollments.select_related('student')}
        return Response({'month': mv, 'rows': [
            {'student': sid, 'username': names.get(sid, f'#{sid}'), **v}
            for sid, v in sorted(per.items())]})

    @action(detail=False, methods=['get'])
    def my_attendance(self, request):
        """Моя посещаемость (или ребёнка родителя: ?student=ник) за последние N дней (?days=90)."""
        u = request.user
        if getattr(u, 'role', None) == 'parent':
            from apps.accounts.models import ParentLink
            from django.contrib.auth import get_user_model
            stu = get_user_model().objects.filter(
                username__iexact=(request.query_params.get('student') or '').strip()).first()
            if not stu or not ParentLink.objects.filter(parent=u, student=stu).exists():
                return Response({'error': 'Этот ученик не привязан к вашему аккаунту'}, status=403)
            student = stu
        else:
            student = u
        try:
            days = int(request.query_params.get('days') or 30)
        except (TypeError, ValueError):
            days = 30
        days = max(1, min(365, days))
        since = timezone.localdate() - timedelta(days=days)
        qs = (Attendance.objects.filter(student=student, date__gte=since)
              .select_related('classroom').order_by('-date'))
        rows, per_class = [], {}
        for a in qs:
            rows.append({'classroom_id': a.classroom_id, 'classroom_title': a.classroom.title,
                         'date': a.date, 'lesson_num': a.lesson_num, 'status': a.status,
                         'note': a.note})
            c = per_class.setdefault(a.classroom_id, {'title': a.classroom.title,
                                                      'present': 0, 'absent': 0,
                                                      'late': 0, 'excused': 0})
            c[a.status] = c.get(a.status, 0) + 1
        return Response({'rows': rows, 'classes': [{'classroom_id': cid, **v}
                                                   for cid, v in per_class.items()],
                         'days': days})

    # ---------- расписание ----------
    @action(detail=True, methods=['get'])
    def schedule_grid(self, request, pk=None):
        """Недельная сетка класса."""
        room = self._school_room(pk)
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        slots = room.schedule_slots.select_related('subject').all()
        return Response(LessonSlotSerializer(slots, many=True).data)

    @action(detail=True, methods=['post'])
    def schedule_set(self, request, pk=None):
        """POST {weekday, num, subject|null, room?} — поставить/убрать предмет в сетке."""
        room = self._school_room(pk)
        if not (_is_admin(request.user) or room.owner_id == request.user.id):
            raise PermissionDenied('Расписание меняет владелец класса')
        try:
            wd = int(request.data.get('weekday'))
            num = int(request.data.get('num'))
        except (TypeError, ValueError):
            raise ValidationError({'weekday': 'weekday и num — числа'})
        if not (1 <= wd <= 7 and 1 <= num <= 9):
            raise ValidationError({'weekday': 'weekday 1..7, num 1..9'})
        subj_id = request.data.get('subject')
        try:
            slot = LessonSlot.objects.get(classroom=room, weekday=wd, num=num)
        except LessonSlot.DoesNotExist:
            if subj_id in (None, '', 'null'):
                return Response({'ok': True, 'cleared': True})
            slot = LessonSlot(classroom=room, weekday=wd, num=num)
        if subj_id in (None, '', 'null'):
            slot.delete()
            return Response({'ok': True, 'cleared': True})
        from apps.catalog.models import Subject
        subj = Subject.objects.filter(pk=subj_id).first() if str(subj_id).isdigit() else None
        if not subj:
            if slot.pk:
                slot.delete()
            raise ValidationError({'subject': 'Предмет не найден'})
        slot.subject = subj
        slot.room = str(request.data.get('room') or '')[:50]
        # у новой записи pk нет — save(update_fields) в Django бросает; обычный save() работает в обоих случаях
        slot.save()
        return Response(LessonSlotSerializer(slot).data)

    @action(detail=True, methods=['get'])
    def schedule_day(self, request, pk=None):
        """День с заменами: GET ?date=YYYY-MM-DD."""
        room = self._school_room(pk)
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        d = _parse_date(request.query_params.get('date')
                        or timezone.localdate().isoformat())
        wd = d.isoweekday()
        slots = {s.num: s for s in room.schedule_slots.filter(weekday=wd).select_related('subject')}
        subs = {s.num: s for s in room.substitutions.filter(date=d).select_related('subject')}
        nums = sorted(set(slots) | set(subs))
        out = []
        for n in nums:
            sub = subs.get(n)
            slot = slots.get(n)
            eff = sub.subject if sub else (slot.subject if slot else None)
            out.append({
                'num': n,
                'base_subject': (slot.subject_id if slot else None),
                'base_subject_name': (slot.subject.name if slot and slot.subject else ''),
                'subject': (eff.id if eff else None),
                'subject_name': (eff.name if eff else ''),
                'room': (slot.room if slot else '') or '',
                'substitution': (SubstitutionSerializer(sub).data if sub else None),
            })
        return Response({'date': d.isoformat(), 'weekday': wd, 'slots': out})

    @action(detail=True, methods=['get', 'post'])
    def substitutions(self, request, pk=None):
        """GET ?date=|?month= — список замен. POST {date, num, subject|null, note} (владелец)."""
        room = self._school_room(pk)
        if request.method == 'POST':
            if not (_is_admin(request.user) or room.owner_id == request.user.id):
                raise PermissionDenied('Замены ставит владелец класса')
            d = _parse_date(request.data.get('date'))
            try:
                num = int(request.data.get('num'))
            except (TypeError, ValueError):
                raise ValidationError({'num': 'num — число 1..9'})
            if not (1 <= num <= 9):
                raise ValidationError({'num': 'num 1..9'})
            subj_id = request.data.get('subject')
            sub, _ = Substitution.objects.update_or_create(
                classroom=room, date=d, num=num,
                defaults={'subject_id': (int(subj_id) if str(subj_id).isdigit() else None),
                          'note': str(request.data.get('note') or '')[:200],
                          'created_by': request.user})
            return Response(SubstitutionSerializer(sub).data)
        if not room.is_member(request.user):
            raise PermissionDenied('Ты не участник класса')
        qs = room.substitutions.select_related('subject')
        d = request.query_params.get('date')
        m = request.query_params.get('month')
        if d:
            qs = qs.filter(date=_parse_date(d))
        elif m:
            try:
                y, mm = int(m.split('-')[0]), int(m.split('-')[1])
                qs = qs.filter(date__year=y, date__month=mm)
            except (ValueError, IndexError):
                raise ValidationError({'month': 'Формат YYYY-MM'})
        else:
            qs = qs.filter(date__gte=timezone.localdate() - timedelta(days=14))
        return Response(SubstitutionSerializer(qs, many=True).data)

    # ---------- экспорт ----------
    @action(detail=True, methods=['get'])
    def export_csv(self, request, pk=None):
        """GET ?type=gradebook|attendance&start=&end= → CSV (Excel: ; и BOM)."""
        room = self._school_room(pk)
        if not (_is_admin(request.user) or room.owner_id == request.user.id):
            raise PermissionDenied('Экспорт — для владельца класса')
        ttype = (request.query_params.get('type') or 'gradebook').strip()
        today = timezone.localdate()
        start = _parse_date(request.query_params.get('start')
                            or (today - timedelta(days=30)).isoformat(), 'start')
        end = _parse_date(request.query_params.get('end') or today.isoformat(), 'end')
        if start > end:
            start, end = end, start
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = (
            f'attachment; filename="{ttype}-{room.id}-{start.isoformat()}..{end.isoformat()}.csv"')
        response.write('\ufeff')  # BOM: Excel без него коверкает кириллицу
        writer = csv.writer(response, delimiter=';')
        students = list(room.enrollments.exclude(access_granted=False)
                        .select_related('student').order_by('student__username'))
        if ttype == 'attendance':
            writer.writerow(['Дата', 'Урок', 'Ученик', 'Статус', 'Пометка'])
            mk = dict(Attendance.STATUS_CHOICES)
            for a in (room.attendance.filter(date__gte=start, date__lte=end)
                      .select_related('student').order_by('date', 'lesson_num', 'student__username')):
                writer.writerow([a.date.isoformat(), a.lesson_num or '', a.student.username,
                                 mk.get(a.status, a.status), a.note])
        elif ttype == 'gradebook':
            from apps.classroom.models import Assignment, Submission
            assignments = list(room.assignments.order_by('deadline', 'id'))
            writer.writerow(['Задание', 'Тип', 'Дедлайн', 'Макс. балл', 'Тема',
                             'Ученик', 'Статус', 'Балл'])
            subs = {(s.assignment_id, s.student_id): s for s in
                    Submission.objects.filter(assignment__in=assignments).select_related('student')}
            now = timezone.now()
            for a in assignments:
                for e in students:
                    s = subs.get((a.id, e.student_id))
                    status = s.status if s else (
                        'overdue' if (a.deadline and a.deadline < now) else 'not_submitted')
                    writer.writerow([a.title, a.kind,
                                     a.deadline.strftime('%Y-%m-%d %H:%M') if a.deadline else '',
                                     a.max_score,
                                     a.topic.title if a.topic else '',
                                     e.student.username, status,
                                     '' if s is None or s.score is None else s.score])
        else:
            raise ValidationError({'type': 'type: gradebook|attendance'})
        return response
