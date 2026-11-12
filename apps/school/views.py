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
from apps.common.safety import csv_safe
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

    def _can_edit_topic(self, topic):
        """Общую программу КР меняет только админ; учитель — только свои темы."""
        u = self.request.user
        if not (_is_admin(u) or (topic.created_by_id and topic.created_by_id == u.id)):
            raise PermissionDenied('Общую учебную программу меняет администратор. '
                                   'Учитель может редактировать только свои темы.')

    def perform_update(self, serializer):
        self._can_edit_topic(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._can_edit_topic(instance)
        instance.delete()

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """Импорт программы: CSV `subject_slug;grade;num;title` (разделитель ';' или ',').
        Повторный импорт update_or_create — обновляет тематические строки, не дублирует."""
        u = request.user
        if not (_is_admin(u) or getattr(u, 'role', None) == 'teacher'):
            raise PermissionDenied('Программу импортирует учитель или админ')
        is_admin = _is_admin(u)
        text = ''
        f = request.FILES.get('file')
        if f:
            if f.size > 2 * 1024 * 1024:
                raise ValidationError({'file': 'Файл больше 2 МБ'})
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
            r = [c.strip() for c in r] + [''] * (5 - len(r))
            slug, grade, num, title, desc = r[0], r[1], r[2], r[3], r[4]
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
            defaults = {'title': title[:500], 'created_by': u}
            if desc:
                defaults['description'] = desc[:1000]
            existing = Topic.objects.filter(subject=subj, grade=str(grade), num=num).first()
            if existing and not is_admin and existing.created_by_id != u.id:
                # чужую/общую тему учитель не перезаписывает
                skipped.append(f'строка {i}: тема {subj.name} {grade} кл. №{num} уже есть в общей программе')
                continue
            _, was = Topic.objects.update_or_create(
                subject=subj, grade=str(grade), num=num,
                defaults=defaults)
            if not was:
                updated += 1
            else:
                created += 1
        return Response({'created': created, 'updated': updated,
                         'skipped': skipped[:10], 'total_skip': len(skipped)})

    @action(detail=False, methods=['get'])
    def standards_kr(self, request):
        """Государственный образовательный стандарт КР (МОиН КР): критерии оценивания."""
        scale = [
            {'grade': 5, 'label': 'Отлично (Эң жакшы)', 'pct_min': 85, 'pct_max': 100, 'min_pct': 85, 'max_pct': 100,
             'criteria': 'Полное и глубокое освоение программного материала, самостоятельное решение стандартных и нестандартных задач, умение обосновывать выводы.'},
            {'grade': 4, 'label': 'Хорошо (Жакшы)', 'pct_min': 70, 'pct_max': 84, 'min_pct': 70, 'max_pct': 84,
             'criteria': 'Твёрдое знание базового материала и понятий, правильное применение формул/правил с 1–2 незначительными неточностями.'},
            {'grade': 3, 'label': 'Удовлетворительно (Канааттандырарлык)', 'pct_min': 50, 'pct_max': 69, 'min_pct': 50, 'max_pct': 69,
             'criteria': 'Усвоение основного материала на репродуктивном уровне, решение типовых заданий по образцу или с подсказкой учителя.'},
            {'grade': 2, 'label': 'Требуется подтянуть (Жетишсиз)', 'pct_min': 0, 'pct_max': 49, 'min_pct': 0, 'max_pct': 49,
             'criteria': 'Пробел в базовых знаниях по теме — требуется повторный разбор материала и индивидуальное задание для отработки.'},
        ]
        return Response({
            'standard': 'Государственный образовательный стандарт школьного общего образования КР (МОиН КР)',
            'scale': scale,
            'grading_scale': scale,
            'competencies': [
                'Информационная компетентность (поиск, анализ и применение знаний)',
                'Социально-коммуникативная компетентность (работа в группе, аргументация)',
                'Самоорганизация и разрешение проблем (применение навыков на практике и в проектах)',
            ]
        })

    @action(detail=False, methods=['post'])
    def seed_kr(self, request):
        """Загрузить базовую учебную программу и критерии оценивания по стандартам Кыргызстана.
        Перезаписывает общие темы — поэтому только администратор."""
        u = request.user
        if not _is_admin(u):
            raise PermissionDenied('Общую программу КР загружает администратор')
        from apps.catalog.models import Subject
        KR_CURRICULUM = [
            ('Математика', 'matematika', '📐', '#3B82F6', [
                ('7', 1, 'Линейные уравнения с одной переменной', 'Критерий КР: на «5» — решает уравнения со скобками и текстовые задачи; на «4» — решает базовые линейные уравнения; на «3» — переносит слагаемые по образцу.'),
                ('7', 2, 'Функции и их графики (y = kx + b)', 'Критерий КР: на «5» — строит график, находит точки пересечения и угловой коэффициент; на «3» — вычисляет значение функции по формуле.'),
                ('8', 1, 'Рациональные дроби и действия с ними', 'Критерий КР: на «5» — сокращает дроби с разложением на множители и приводит к общему знаменателю; на «3» — выполняет сложение с одинаковыми знаменателями.'),
                ('8', 2, 'Арифметический квадратный корень и степени', 'Критерий КР: на «5» — выносит множитель из-под знака корня и преобразует выражения; на «3» — находит корень из табличных чисел.'),
                ('8', 3, 'Квадратные уравнения и теорема Виета', 'Критерий КР: на «5» — решает через дискриминант и теорему Виета, составляет уравнения к задачам; на «3» — вычисляет дискриминант и корни по формуле.'),
                ('9', 1, 'Квадратичная функция и неравенства', 'Критерий КР: на «5» — решает неравенства методом интервалов и строит параболу; на «3» — определяет направление ветвей и вершину параболы.'),
                ('9', 2, 'Арифметическая и геометрическая прогрессии', 'Критерий КР: на «5» — применяет формулы n-го члена и суммы прогрессии в текстовых задачах; на «3» — находит следующий член прогрессии.'),
            ]),
            ('Физика', 'fizika', '⚡', '#F59E0B', [
                ('7', 1, 'Механическое движение. Скорость, путь и время', 'Критерий КР: на «5» — переводит единицы СИ, читает графики движения и решает комбинированные задачи; на «3» — применяет формулу v = s/t.'),
                ('8', 1, 'Тепловые явления и количество теплоты', 'Критерий КР: на «5» — составляет уравнение теплового баланса; на «3» — рассчитывает Q = cmΔt по табличным данным.'),
                ('8', 2, 'Закон Ома для участка цепи. Соединение проводников', 'Критерий КР: на «5» — рассчитывает смешанные цепи, силу тока, напряжение и сопротивление; на «3» — применяет закон Ома I = U/R.'),
                ('9', 1, 'Законы Ньютона и закон всемирного тяготения', 'Критерий КР: на «5» — строит проекции сил на оси и находит ускорение тела; на «3» — формулирует три закона Ньютона и применяет F = ma.'),
            ]),
            ('Информатика', 'informatika', '💻', '#10B981', [
                ('8', 1, 'Системы счисления и представление информации', 'Критерий КР: на «5» — свободно переводит числа между 2, 8, 10, 16 системами; на «3» — переводит из двоичной в десятичную.'),
                ('8', 2, 'Алгоритмы, ветвления и циклы в Python', 'Критерий КР: на «5» — пишет программы с вложенными условиями и циклами for/while без ошибок; на «3» — понимает блок-схему и базовый цикл.'),
                ('9', 1, 'Массивы (списки), функции и обработка строк', 'Критерий КР: на «5» — реализует поиск, сортировку и собственные функции; на «3» — перебирает элементы списка и находит сумму.'),
                ('9', 2, 'Базы данных и язык запросов SQL', 'Критерий КР: на «5» — составляет запросы SELECT с WHERE, ORDER BY, GROUP BY; на «3» — выбирает данные из одной таблицы.'),
            ]),
            ('Химия', 'himiya', '🧪', '#8B5CF6', [
                ('8', 1, 'Периодический закон и строение атома', 'Критерий КР: на «5» — составляет электронные формулы атомов и объясняет свойства по положению в таблице; на «3» — определяет заряд ядра и число электронов.'),
                ('8', 2, 'Химическая связь и степени окисления', 'Критерий КР: на «5» — определяет тип связи (ковалентная, ионная, металлическая) и расставляет степени окисления; на «3» — составляет формулы по валентности.'),
            ]),
            ('История Кыргызстана', 'istoriya-kr', '🇰🇬', '#EF4444', [
                ('8', 1, 'Кыргызский каганат и эпоха Великодержавия', 'Критерий КР: на «5» — анализирует причины возвышения каганата, знает ключевые даты и исторических личностей (Барсбек, Мухаммед Кыргыз); на «3» — называет основные события.'),
                ('9', 1, 'Кыргызстан в XX веке и становление государственности', 'Критерий КР: на «5» — раскрывает этапы государственного строительства КР и роль отцов-основателей; на «3» — знает хронологию ключевых дат.'),
            ]),
        ]
        created, updated = 0, 0
        for s_name, s_slug, s_icon, s_color, topic_rows in KR_CURRICULUM:
            subj = (Subject.objects.filter(slug=s_slug).first()
                    or Subject.objects.filter(name__iexact=s_name).first())
            if not subj:
                subj = Subject.objects.create(name=s_name, slug=s_slug, icon=s_icon, color=s_color,
                                              description=f'Школьная программа КР по предмету «{s_name}»')
            for gr, num, title, crit in topic_rows:
                _, was_created = Topic.objects.update_or_create(
                    subject=subj, grade=gr, num=num,
                    defaults={'title': title, 'description': crit, 'created_by': u}
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        return Response({'created': created, 'updated': updated, 'total': created + updated})


def _resolve_student(request):
    """Кого смотрим: ученик — себя; родитель — привязанного ребёнка по ?student=."""
    u = request.user
    if getattr(u, 'role', None) == 'parent':
        from apps.accounts.models import ParentLink
        from django.contrib.auth import get_user_model
        stu = get_user_model().objects.filter(
            username__iexact=(request.query_params.get('student') or '').strip()).first()
        if not stu or not ParentLink.objects.filter(parent=u, student=stu).exists():
            return None, Response({'error': 'Этот ученик не привязан к вашему аккаунту'}, status=403)
        return stu, None
    if getattr(u, 'role', None) != 'student':
        return None, Response({'error': 'Только для ученика и родителя'}, status=403)
    return u, None


def _topic_mastery_bulk(students):
    """Пакетный расчёт карты знаний по темам для списка учеников (избегает N+1 запросов).
    Возвращает словарь {student_id: prog_dict} за фиксированное число запросов к БД."""
    from apps.assessments.models import TestAttempt
    from apps.classroom.models import Submission
    from .models import Topic as _T

    stu_ids = [s.id if hasattr(s, 'id') else int(s) for s in students if s]
    if not stu_ids:
        return {}

    per_student = {sid: {} for sid in stu_ids}

    # 1 запрос: попытки тестов всех учеников
    attempts = list(TestAttempt.objects.filter(user_id__in=stu_ids).select_related('test'))
    all_topic_ids = set()
    for att in attempts:
        ps = per_student.get(att.user_id)
        if ps is None:
            continue
        for tid_s, rec in (att.topic_scores or {}).items():
            try:
                tid = int(tid_s)
            except (TypeError, ValueError):
                continue
            all_topic_ids.add(tid)
            r = ps.setdefault(tid, {'earned': 0, 'total': 0, 'title': rec.get('title') or ''})
            r['earned'] += rec.get('earned') or 0
            r['total'] += rec.get('total') or 0
            if rec.get('title') and not r['title']:
                r['title'] = rec.get('title')

    # 2 запрос: сдачи всех учеников с привязкой к теме
    subs = list(Submission.objects.filter(student_id__in=stu_ids, status__in=['submitted', 'late'],
                                          assignment__topic__isnull=False)
                .select_related('assignment__topic'))
    for s in subs:
        ps = per_student.get(s.student_id)
        if ps is None:
            continue
        a = s.assignment
        mx = a.max_score or 100
        if s.score is not None:
            all_topic_ids.add(a.topic_id)
            r = ps.setdefault(a.topic_id, {'earned': 0, 'total': 0, 'title': a.topic.title if a.topic else ''})
            r['earned'] += s.score
            r['total'] += mx
            if a.topic and not r['title']:
                r['title'] = a.topic.title

    # 3 запрос: метаданные всех затронутых тем
    topic_meta = {}
    if all_topic_ids:
        for t in _T.objects.filter(id__in=all_topic_ids).select_related('subject'):
            topic_meta[t.id] = {
                'title': t.title,
                'subject_name': t.subject.name if t.subject else '',
                'grade': t.grade or '',
                'criteria': t.description or '',
            }

    # 4 запрос: диагностики для всех учеников
    diag_attempts = [att for att in attempts if getattr(att.test, 'is_diagnostic', False)]
    diag_attempts.sort(key=lambda d: d.created_at, reverse=True)
    diags_by_student = {sid: [] for sid in stu_ids}
    seen_diags = {sid: set() for sid in stu_ids}
    for att in diag_attempts:
        sid = att.user_id
        if att.test_id not in seen_diags[sid]:
            seen_diags[sid].add(att.test_id)
            diags_by_student[sid].append({
                'test_id': att.test_id, 'title': att.test.title if att.test else '',
                'score': att.score, 'passed': att.passed, 'date': att.created_at
            })

    result = {}
    for sid in stu_ids:
        ps = per_student[sid]
        topics = []
        for tid, rec in ps.items():
            pct = round(rec['earned'] / rec['total'] * 100, 1) if rec['total'] else 0
            status = 'mastered' if pct >= 80 else ('learning' if pct >= 50 else 'gap')
            kr_grade = 5 if pct >= 85 else (4 if pct >= 70 else (3 if pct >= 50 else 2))
            meta = topic_meta.get(tid, {})
            title = rec['title'] or meta.get('title') or f'Тема #{tid}'
            topics.append({
                'topic_id': tid, 'title': title,
                'subject_name': meta.get('subject_name', ''),
                'grade': meta.get('grade', ''),
                'criteria': meta.get('criteria', ''),
                'kr_grade': kr_grade,
                'pct': pct, 'status': status,
                'earned': rec['earned'], 'total': rec['total']
            })
        topics.sort(key=lambda x: (x['pct'], x['title']))
        gaps = [t for t in topics if t['status'] == 'gap']
        mastered = [t for t in topics if t['status'] == 'mastered']
        learning = [t for t in topics if t['status'] == 'learning']
        result[sid] = {
            'topics': topics, 'gaps': gaps, 'mastered': mastered,
            'learning': learning, 'diagnostics': diags_by_student.get(sid, []),
            'tested_topics': len(topics)
        }
    return result


def _topic_mastery(student):
    """Карта знаний одного ученика."""
    if not student:
        return {'topics': [], 'gaps': [], 'mastered': [], 'learning': [], 'diagnostics': [], 'tested_topics': 0}
    sid = student.id if hasattr(student, 'id') else int(student)
    return _topic_mastery_bulk([student]).get(sid, {'topics': [], 'gaps': [], 'mastered': [], 'learning': [], 'diagnostics': [], 'tested_topics': 0})


class SchoolMixin:
    """Actions ClassroomViewSet: посещаемость, расписание, замены, экспорт CSV, прогресс по темам."""

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

    # ---------- путь обучения ученика ----------
    @action(detail=False, methods=['get'])
    def my_progress(self, request):
        """Карта знаний ученика (привязка родителя — ?student=<ник>)."""
        student, err = _resolve_student(request)
        if err:
            return err
        prog = _topic_mastery(student)
        # персональные задания ученика (подтянуть темы)
        from apps.classroom.models import Assignment, Submission
        personal = (Assignment.objects.filter(assigned_to=student)
                    .select_related('classroom', 'topic').order_by('deadline', '-created_at'))
        sub_map = {s.assignment_id: s for s in
                   Submission.objects.filter(student=student, assignment__in=personal)}
        pers = []
        now = timezone.now()
        for a in personal:
            s = sub_map.get(a.id)
            if s:
                st = s.status
            elif a.deadline and a.deadline < now:
                st = 'overdue'
            else:
                st = 'pending'
            pers.append({'id': a.id, 'title': a.title, 'kind': a.kind,
                         'object_id': (a.lesson_id if a.kind == 'lesson' else
                                       a.test_id if a.kind == 'test' else a.id),
                         'classroom_id': a.classroom_id, 'classroom_title': a.classroom.title,
                         'topic_id': a.topic_id,
                         'topic_title': a.topic.title if a.topic else '', 'deadline': a.deadline,
                         'status': st, 'score': s.score if s else None, 'max_score': a.max_score})
        prog['personal_tasks'] = pers
        # общая успеваемость по всем заданиям (не только средний балл, но и связка с темами)
        all_subs = Submission.objects.filter(
            student=student, status__in=['submitted', 'late'], score__isnull=False
        ).select_related('assignment')
        pcts = [round((s.score / (s.assignment.max_score or 100)) * 100, 1)
                for s in all_subs if s.assignment]
        overall_avg = round(sum(pcts) / len(pcts), 1) if pcts else None
        prog['overall_avg'] = overall_avg
        prog['overall_kr_grade'] = (
            5 if overall_avg >= 85 else 4 if overall_avg >= 70 else 3 if overall_avg >= 50 else 2
        ) if overall_avg is not None else None
        prog['submitted_total'] = len(pcts)
        # доступные диагностики (ещё не пройденные)
        from apps.assessments.models import Test
        taken = {d['test_id'] for d in prog['diagnostics']}
        available = (Test.objects.filter(is_diagnostic=True)
                     .exclude(id__in=taken)
                     .select_related('subject'))[:10]
        prog['diagnostics_available'] = [
            {'id': t.id, 'title': t.title,
             'subject': t.subject.name if t.subject else '',
             'diagnostic_grade': t.diagnostic_grade}
            for t in available]
        prog['student'] = student.username
        return Response(prog)

    @action(detail=True, methods=['get'])
    def class_progress(self, request, pk=None):
        """Аналитика класса для учителя: % по темам на ученика, кто отстаёт, диагностика."""
        from apps.classroom.models import Enrollment
        room = self._school_room(pk)
        if not (_is_admin(request.user) or room.owner_id == request.user.id):
            raise PermissionDenied('Только владелец класса')
        students = [e.student for e in room.enrollments.exclude(access_granted=False)
                    .select_related('student').order_by('student__username')]
        rows = []
        gaps_all = {}
        prog_map = _topic_mastery_bulk(students)
        for stu in students:
            prog = prog_map.get(stu.id, {
                'topics': [], 'gaps': [], 'mastered': [], 'learning': [],
                'tested_topics': 0, 'diagnostics': []
            })
            avg = round(sum(t['pct'] for t in prog['topics']) / len(prog['topics']), 1) \
                if prog['topics'] else None
            for g in prog['gaps']:
                gaps_all.setdefault(g['topic_id'], {
                    'title': g['title'], 'students': []})['students'].append(stu.username)
            rows.append({'student': stu.id, 'username': stu.username,
                         'first_name': stu.first_name or '',
                         'avg': avg,
                         'tested_topics': prog['tested_topics'],
                         'gaps': [g['title'] for g in prog['gaps']],
                         'gap_topics': [{'topic_id': g['topic_id'], 'title': g['title'], 'pct': g['pct']} for g in prog['gaps']],
                         'mastered_topics': [{'topic_id': m['topic_id'], 'title': m['title'], 'pct': m['pct']} for m in prog['mastered']],
                         'diagnostics_taken': len(prog['diagnostics']),
                         'diagnostics': prog['diagnostics']})
        rows.sort(key=lambda r: (r['avg'] is None, r['avg']))
        return Response({'classroom': room.title, 'students': rows,
                         'class_gaps': [{'topic_id': tid, **v}
                                        for tid, v in gaps_all.items()]})

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
                writer.writerow([a.date.isoformat(), a.lesson_num or '', csv_safe(a.student.username),
                                 mk.get(a.status, a.status), csv_safe(a.note)])
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
                    writer.writerow([csv_safe(a.title), a.kind,
                                     a.deadline.strftime('%Y-%m-%d %H:%M') if a.deadline else '',
                                     a.max_score,
                                     csv_safe(a.topic.title) if a.topic else '',
                                     csv_safe(e.student.username), status,
                                     '' if s is None or s.score is None else s.score])
        else:
            raise ValidationError({'type': 'type: gradebook|attendance'})
        return response

    @action(detail=True, methods=['post'])
    def delete_substitution(self, request, pk=None):
        """POST {id} — удалить замену (владелец класса или админ)."""
        room = self._school_room(pk)
        if not (_is_admin(request.user) or room.owner_id == request.user.id):
            raise PermissionDenied('Замены удаляет владелец класса')
        sub_id = request.data.get('id')
        room.substitutions.filter(pk=sub_id).delete()
        return Response({'ok': True})

    # ---------- перенос учеников и расписания (Готовность к внедрению) ----------
    IMPORT_MAX_ROWS = 500

    @action(detail=True, methods=['post'])
    def import_students(self, request, pk=None):
        """Массовый перенос / зачисление учеников в класс.
        POST {text: 'логин;Имя Фамилия;пароль?\\n...'} или CSV-файл.

        Безопасность:
        - новый аккаунт: пароль из CSV (если проходит validate_password) или СЛУЧАЙНЫЙ
          (общего пароля по умолчанию больше нет); пароли возвращаются один раз (no-store);
        - существующий аккаунт зачисляется, только если это ученик, который уже учится у
          этого учителя (или запрос от админа) — иначе чужого ребёнка нельзя «забрать»
          в свой класс и получить доступ к его портфолио/прогрессу/родителям;
        - не больше IMPORT_MAX_ROWS строк за запрос."""
        room = self._school_room(pk)
        u = request.user
        if not (_is_admin(u) or room.owner_id == u.id):
            raise PermissionDenied('Импорт учеников доступен владельцу класса и админу')
        text = ''
        f = request.FILES.get('file')
        if f:
            if f.size > 2 * 1024 * 1024:
                raise ValidationError({'file': 'Файл больше 2 МБ'})
            text = f.read().decode('utf-8-sig', errors='replace')
        elif request.data.get('text'):
            text = str(request.data['text'])
        else:
            raise ValidationError({'text': 'Передай список учеников (text) или CSV-файл'})
        from django.contrib.auth import get_user_model
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjValidationError
        from apps.classroom.models import Enrollment
        import secrets
        U = get_user_model()
        lines = [ln.strip() for ln in text.replace('\r\n', '\n').split('\n') if ln.strip()]
        if not lines:
            raise ValidationError({'text': 'Список пуст'})
        if len(lines) > self.IMPORT_MAX_ROWS + 1:
            raise ValidationError({'text': f'Слишком много строк: максимум {self.IMPORT_MAX_ROWS} за один импорт'})
        is_admin = _is_admin(u)
        # ученики, которые уже учатся у этого учителя (в любом его классе)
        my_student_ids = set(Enrollment.objects.filter(classroom__owner=room.owner_id)
                             .values_list('student_id', flat=True))
        alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
        enrolled, created_users, skipped = 0, [], []
        for idx, line in enumerate(lines, start=1):
            delim = ';' if ';' in line else (',' if ',' in line else '\t')
            parts = [p.strip() for p in line.split(delim)]
            username = parts[0] if parts else ''
            if idx == 1 and username.lower() in ('username', 'логин', 'ник', 'ученик', 'login'):
                continue
            if not username or len(username) < 3:
                skipped.append(f'строка {idx}: логин короче 3 символов')
                continue
            first_name = parts[1] if len(parts) > 1 else ''
            user = U.objects.filter(username__iexact=username).first()
            if not user:
                clean_nick = ''.join(ch for ch in username if ch.isalnum() or ch in '_-.')[:100]
                if len(clean_nick) < 3:
                    skipped.append(f'строка {idx}: некорректный логин «{username}»')
                    continue
                if U.objects.filter(username__iexact=clean_nick).exists():
                    skipped.append(f'строка {idx}: логин «{clean_nick}» уже занят')
                    continue
                raw_pw = parts[2] if len(parts) > 2 else ''
                if raw_pw:
                    try:
                        validate_password(raw_pw)
                    except DjValidationError:
                        raw_pw = ''  # слабый пароль из CSV не используем — выдаём случайный
                if not raw_pw:
                    raw_pw = ''.join(secrets.choice(alphabet) for _ in range(10))
                user = U.objects.create_user(
                    username=clean_nick, password=raw_pw,
                    first_name=first_name[:150], role='student',
                )
                created_users.append({'username': user.username, 'first_name': user.first_name, 'password': raw_pw})
            else:
                if getattr(user, 'role', None) != 'student':
                    skipped.append(f'строка {idx}: «{user.username}» — не ученический аккаунт')
                    continue
                if not is_admin and user.id not in my_student_ids:
                    skipped.append(f'строка {idx}: аккаунт «{user.username}» уже существует — '
                                   f'пусть ученик вступит по коду класса')
                    continue
                if first_name and not user.first_name:
                    user.first_name = first_name[:150]
                    user.save(update_fields=['first_name'])
            if user.id == room.owner_id:
                continue
            Enrollment.objects.update_or_create(
                classroom=room, student=user,
                defaults={'status': 'active', 'access_granted': True}
            )
            enrolled += 1
        resp = Response({
            'enrolled': enrolled,
            'added_to_class': enrolled,
            'created_accounts': created_users,
            'created_count': len(created_users),
            'created_users': len(created_users),
            'skipped': skipped[:20],
            'total_skip': len(skipped),
        })
        resp['Cache-Control'] = 'no-store'
        return resp

    @action(detail=True, methods=['post'])
    def import_schedule_csv(self, request, pk=None):
        """Импорт расписания класса из CSV/текста: `день_недели;номер_урока;предмет;кабинет`.
        День недели: 1..6 или Пн/Вт/Ср/Чт/Пт/Сб."""
        room = self._school_room(pk)
        if not (_is_admin(request.user) or room.owner_id == request.user.id):
            raise PermissionDenied('Расписание импортирует владелец класса или админ')
        text = ''
        f = request.FILES.get('file')
        if f:
            text = f.read().decode('utf-8-sig', errors='replace')
        elif request.data.get('text'):
            text = str(request.data['text'])
        else:
            raise ValidationError({'text': 'Передай CSV расписания или поле text'})
        from apps.catalog.models import Subject
        wd_map = {
            '1': 1, 'пн': 1, 'понедельник': 1, 'mon': 1,
            '2': 2, 'вт': 2, 'вторник': 2, 'tue': 2,
            '3': 3, 'ср': 3, 'среда': 3, 'wed': 3,
            '4': 4, 'чт': 4, 'четверг': 4, 'thu': 4,
            '5': 5, 'пт': 5, 'пятница': 5, 'fri': 5,
            '6': 6, 'сб': 6, 'суббота': 6, 'sat': 6,
        }
        lines = [ln.strip() for ln in text.replace('\r\n', '\n').split('\n') if ln.strip()]
        imported, skipped = 0, []
        for idx, line in enumerate(lines, start=1):
            delim = ';' if ';' in line else (',' if ',' in line else '\t')
            parts = [p.strip() for p in line.split(delim)] + ['', '', '', '']
            wd_raw, num_raw, subj_raw, room_str = parts[0].lower(), parts[1], parts[2], parts[3]
            if idx == 1 and wd_raw in ('день', 'weekday', 'day', 'день_недели'):
                continue
            wd = wd_map.get(wd_raw)
            try:
                num = int(num_raw)
            except (TypeError, ValueError):
                num = 0
            if not wd or not (1 <= num <= 9):
                skipped.append(f'строка {idx}: неверный день «{parts[0]}» или урок «{num_raw}»')
                continue
            subj = (Subject.objects.filter(slug__iexact=subj_raw).first()
                    or Subject.objects.filter(name__iexact=subj_raw).first()
                    or Subject.objects.filter(name__icontains=subj_raw).first()) if subj_raw else None
            if not subj:
                skipped.append(f'строка {idx}: предмет «{subj_raw}» не найден')
                continue
            LessonSlot.objects.update_or_create(
                classroom=room, weekday=wd, num=num,
                defaults={'subject': subj, 'room': room_str[:50]}
            )
            imported += 1
        return Response({'imported': imported, 'skipped': skipped[:10]})

    # ---------- аналитика для учителя и администрации ----------
    @action(detail=False, methods=['get'])
    def school_analytics(self, request):
        """Сводная аналитика для учителя (по своим классам) и администрации (по всей школе):
        кто отстаёт, по каким темам, какие классы пропускают занятия."""
        u = request.user
        if not (_is_admin(u) or getattr(u, 'role', None) == 'teacher'):
            raise PermissionDenied('Аналитика доступна учителям и администрации')
        from apps.classroom.models import Assignment, Submission
        rooms_qs = Classroom.objects.select_related('subject', 'owner').all()
        if not _is_admin(u):
            rooms_qs = rooms_qs.filter(owner=u)
        rooms = list(rooms_qs)
        since_30 = timezone.localdate() - timedelta(days=30)
        classes_out = []
        lagging_students = []
        topic_gaps_agg = {}
        now = timezone.now()

        all_students_dict = {}
        for rm in rooms:
            for e in rm.enrollments.exclude(access_granted=False).select_related('student'):
                all_students_dict[e.student_id] = e.student
        mastery_map = _topic_mastery_bulk(list(all_students_dict.values()))

        for rm in rooms:
            enrolls = list(rm.enrollments.exclude(access_granted=False).select_related('student'))
            students = [e.student for e in enrolls]
            assignments = list(rm.assignments.select_related('topic').all())
            subs = list(Submission.objects.filter(assignment__in=assignments).select_related('assignment'))
            sub_by_stu = {}
            for s in subs:
                sub_by_stu.setdefault(s.student_id, []).append(s)

            atts = list(rm.attendance.filter(date__gte=since_30))
            att_counts = {'present': 0, 'absent': 0, 'late': 0, 'excused': 0}
            att_by_stu = {}
            for a in atts:
                att_counts[a.status] = att_counts.get(a.status, 0) + 1
                st_a = att_by_stu.setdefault(a.student_id, {'present': 0, 'absent': 0, 'late': 0})
                if a.status in st_a:
                    st_a[a.status] += 1

            total_att_marks = att_counts['present'] + att_counts['absent'] + att_counts['late']
            att_pct = round((att_counts['present'] + att_counts['late']) / total_att_marks * 100, 1) if total_att_marks else None

            class_pcts = []
            rm_lagging = 0
            for stu in students:
                stu_subs = sub_by_stu.get(stu.id, [])
                scored = [round((s.score / (s.assignment.max_score or 100)) * 100, 1)
                          for s in stu_subs if s.score is not None and s.assignment]
                stu_avg_pct = round(sum(scored) / len(scored), 1) if scored else None
                if stu_avg_pct is not None:
                    class_pcts.append(stu_avg_pct)
                done_ids = {s.assignment_id for s in stu_subs if s.status in ('submitted', 'late')}
                missed_tasks = sum(1 for a in assignments
                                   if a.kind != 'manual' and a.id not in done_ids
                                   and (not a.assigned_to_id or a.assigned_to_id == stu.id)
                                   and a.deadline and a.deadline < now)
                prog = mastery_map.get(stu.id, {
                    'topics': [], 'gaps': [], 'mastered': [], 'learning': [],
                    'tested_topics': 0, 'diagnostics': []
                })
                gap_titles = [g['title'] for g in prog['gaps']]
                for g in prog['gaps']:
                    rec = topic_gaps_agg.setdefault(g['topic_id'], {
                        'topic_id': g['topic_id'],
                        'title': g['title'],
                        'subject_name': g.get('subject_name', ''),
                        'students_count': 0,
                        'students': [],
                        'pcts': [],
                    })
                    if stu.username not in rec['students']:
                        rec['students'].append(stu.username)
                        rec['students_count'] += 1
                    rec['pcts'].append(g['pct'])

                stu_abs = att_by_stu.get(stu.id, {}).get('absent', 0)
                is_lagging = (
                    (stu_avg_pct is not None and stu_avg_pct < 60)
                    or len(gap_titles) > 0
                    or missed_tasks >= 2
                    or stu_abs >= 3
                )
                if is_lagging:
                    rm_lagging += 1
                    kr_g = (5 if stu_avg_pct >= 85 else 4 if stu_avg_pct >= 70 else 3 if stu_avg_pct >= 50 else 2) if stu_avg_pct is not None else None
                    lagging_students.append({
                        'student_id': stu.id,
                        'username': stu.username,
                        'first_name': stu.first_name or '',
                        'classroom_id': rm.id,
                        'classroom_title': rm.title,
                        'subject_name': rm.subject.name if rm.subject else '',
                        'avg_pct': stu_avg_pct,
                        'kr_grade': kr_g,
                        'gaps': gap_titles,
                        'missed_tasks': missed_tasks,
                        'absent_days': stu_abs,
                    })

            cls_avg = round(sum(class_pcts) / len(class_pcts), 1) if class_pcts else None
            classes_out.append({
                'id': rm.id,
                'title': rm.title,
                'subject': rm.subject.name if rm.subject else '',
                'owner': rm.owner.username if rm.owner else '',
                'students_count': len(students),
                'avg_pct': cls_avg,
                'lagging_count': rm_lagging,
                'present_count': att_counts['present'],
                'absent_count': att_counts['absent'],
                'late_count': att_counts['late'],
                'attendance_pct': att_pct,
            })

        classes_out.sort(key=lambda c: (-c['absent_count'], -c['lagging_count'], c['title']))
        lagging_students.sort(key=lambda s: (s['avg_pct'] is None, s['avg_pct'] or 0, -s['absent_days']))
        problem_topics = []
        for tid, rec in topic_gaps_agg.items():
            avg_p = round(sum(rec['pcts']) / len(rec['pcts']), 1) if rec['pcts'] else 0
            problem_topics.append({
                'topic_id': tid,
                'title': rec['title'],
                'subject_name': rec['subject_name'],
                'students_count': rec['students_count'],
                'students': rec['students'][:10],
                'avg_pct': avg_p,
            })
        problem_topics.sort(key=lambda t: (-t['students_count'], t['avg_pct']))

        return Response({
            'summary': {
                'classes_count': len(classes_out),
                'students_total': sum(c['students_count'] for c in classes_out),
                'lagging_total': len(lagging_students),
                'absent_total_30d': sum(c['absent_count'] for c in classes_out),
                'problem_topics_count': len(problem_topics),
            },
            'classes': classes_out,
            'lagging_students': lagging_students,
            'problem_topics': problem_topics,
        })

    @action(detail=False, methods=['get'])
    def school_export_csv(self, request):
        """Экспорт сводной аналитики школы / классов в CSV (UTF-8 BOM для Excel):
        ?type=classes|lagging|topics"""
        data = self.school_analytics(request).data
        ttype = (request.query_params.get('type') or 'lagging').strip()
        today = timezone.localdate().isoformat()
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="school-{ttype}-{today}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response, delimiter=';')
        if ttype == 'classes':
            writer.writerow(['Класс', 'Предмет', 'Учитель', 'Учеников', 'Средний %', 'Отстают', 'Пропусков (30д)', 'Опозданий (30д)', 'Посещаемость %'])
            for c in data.get('classes', []):
                writer.writerow([csv_safe(c['title']), csv_safe(c['subject']), csv_safe(c['owner']), c['students_count'],
                                 c['avg_pct'] if c['avg_pct'] is not None else '',
                                 c['lagging_count'], c['absent_count'], c['late_count'],
                                 c['attendance_pct'] if c['attendance_pct'] is not None else ''])
        elif ttype == 'topics':
            writer.writerow(['Тема программы КР', 'Предмет', 'Отстающих учеников', 'Средний % по теме', 'Ученики'])
            for t in data.get('problem_topics', []):
                writer.writerow([csv_safe(t['title']), csv_safe(t['subject_name']), t['students_count'], t['avg_pct'], csv_safe(', '.join(t['students']))])
        else:
            writer.writerow(['Ученик', 'Имя', 'Класс', 'Предмет', 'Средний %', 'Оценка КР', 'Пропущено заданий', 'Пропусков уроков (30д)', 'Пробелы по темам'])
            for s in data.get('lagging_students', []):
                writer.writerow([csv_safe(s['username']), csv_safe(s['first_name']), csv_safe(s['classroom_title']), csv_safe(s['subject_name']),
                                 s['avg_pct'] if s['avg_pct'] is not None else '',
                                 s['kr_grade'] or '', s['missed_tasks'], s['absent_days'],
                                 csv_safe(', '.join(s['gaps']))])
        return response

    # ---------- резервная копия (Готовность к внедрению) ----------
    @action(detail=False, methods=['get'])
    def backup_data(self, request):
        """Скачать резервную копию (JSON) учебной программы, расписания, классов, журнала и посещаемости."""
        u = request.user
        if not (_is_admin(u) or getattr(u, 'role', None) == 'teacher'):
            raise PermissionDenied('Резервная копия доступна учителям и администрации')
        import json as _json
        from apps.classroom.models import Submission
        rooms_qs = Classroom.objects.select_related('subject', 'owner').all()
        if not _is_admin(u):
            rooms_qs = rooms_qs.filter(owner=u)
        topics_data = [
            {'subject_slug': t.subject.slug, 'subject_name': t.subject.name,
             'grade': t.grade, 'num': t.num, 'title': t.title, 'description': t.description}
            for t in Topic.objects.select_related('subject').all()
        ]
        classes_data = []
        for rm in rooms_qs:
            classes_data.append({
                'id': rm.id,
                'title': rm.title,
                'subject': rm.subject.slug if rm.subject else '',
                'invite_code': rm.invite_code,
                'students': [
                    {'username': e.student.username, 'first_name': e.student.first_name}
                    for e in rm.enrollments.select_related('student')
                ],
                'schedule': [
                    {'weekday': s.weekday, 'num': s.num,
                     'subject': s.subject.slug if s.subject else '', 'room': s.room}
                    for s in rm.schedule_slots.select_related('subject')
                ],
                'assignments': [
                    {'id': a.id, 'title': a.title, 'kind': a.kind, 'max_score': a.max_score,
                     'topic': a.topic.title if a.topic else '',
                     'deadline': a.deadline.isoformat() if a.deadline else None}
                    for a in rm.assignments.select_related('topic')
                ],
                'submissions': [
                    {'assignment_id': s.assignment_id, 'student': s.student.username,
                     'score': s.score, 'mark': s.mark, 'status': s.status}
                    for s in Submission.objects.filter(assignment__classroom=rm).select_related('student')
                ],
                'attendance_count': rm.attendance.count(),
            })
        payload = {
            'version': '2.0-kr',
            'exported_at': timezone.now().isoformat(),
            'exported_by': u.username,
            'topics_count': len(topics_data),
            'classes_count': len(classes_data),
            'topics': topics_data,
            'classes': classes_data,
        }
        body = _json.dumps(payload, ensure_ascii=False, indent=2)
        resp = HttpResponse(body, content_type='application/json; charset=utf-8')
        resp['Content-Disposition'] = f'attachment; filename="eduplatform-backup-{timezone.localdate().isoformat()}.json"'
        return resp

    @action(detail=False, methods=['post'])
    def restore_backup(self, request):
        """Восстановление тем учебной программы из JSON резервной копии.
        Перезаписывает общую программу — только администратор."""
        u = request.user
        if not _is_admin(u):
            raise PermissionDenied('Восстановление общей программы из копии доступно администратору')
        import json as _json
        from apps.catalog.models import Subject
        data = request.data
        f = request.FILES.get('file')
        if f:
            if f.size > 10 * 1024 * 1024:
                raise ValidationError({'file': 'Файл больше 10 МБ'})
            try:
                data = _json.loads(f.read().decode('utf-8-sig', errors='replace'))
            except Exception:
                raise ValidationError({'file': 'Некорректный JSON-файл резервной копии'})
        topics_list = data.get('topics') if isinstance(data, dict) else []
        if not isinstance(topics_list, list):
            raise ValidationError({'topics': 'Ожидается список тем'})
        restored_topics = 0
        for tp in topics_list[:5000]:
            if not isinstance(tp, dict):
                continue
            slug = str(tp.get('subject_slug') or '')
            subj = Subject.objects.filter(slug=slug).first() or Subject.objects.filter(name__iexact=str(tp.get('subject_name') or '')).first()
            if not subj or not tp.get('title'):
                continue
            try:
                num = int(tp.get('num') or 1)
            except (TypeError, ValueError):
                continue
            Topic.objects.update_or_create(
                subject=subj, grade=str(tp.get('grade') or '')[:10], num=num,
                defaults={'title': str(tp['title'])[:500], 'description': str(tp.get('description') or '')[:2000], 'created_by': u}
            )
            restored_topics += 1
        return Response({'ok': True, 'restored_topics': restored_topics})


from rest_framework.views import APIView


def _build_teacher_student_analysis(user, classroom_id=None, student_id=None):
    """Собирает полную картину по ученикам учителя:
    кто как учится, у кого какие оценки (все баллы и отметки), кого нужно подтянуть,
    по каким темам пробелы и персональные советы для учителя."""
    from apps.classroom.models import Assignment, Submission
    rooms_qs = Classroom.objects.select_related('subject', 'owner').all()
    if not _is_admin(user):
        rooms_qs = rooms_qs.filter(owner=user)
    if classroom_id and str(classroom_id).isdigit():
        rooms_qs = rooms_qs.filter(pk=int(classroom_id))
    rooms = list(rooms_qs)
    since_30 = timezone.localdate() - timedelta(days=30)
    now = timezone.now()

    students_analysis = []
    class_summaries = []
    all_gaps_counter = {}

    all_students_dict = {}
    for rm in rooms:
        enrolls_pre = rm.enrollments.exclude(access_granted=False).select_related('student')
        if student_id and str(student_id).isdigit():
            enrolls_pre = enrolls_pre.filter(student_id=int(student_id))
        for e in enrolls_pre:
            all_students_dict[e.student_id] = e.student
    mastery_map = _topic_mastery_bulk(list(all_students_dict.values()))

    for rm in rooms:
        enrolls = list(rm.enrollments.exclude(access_granted=False).select_related('student').order_by('student__username'))
        if student_id and str(student_id).isdigit():
            enrolls = [e for e in enrolls if e.student_id == int(student_id)]
        assignments = list(rm.assignments.select_related('topic', 'lesson', 'test').order_by('deadline', 'id'))
        subs = list(Submission.objects.filter(assignment__in=assignments).select_related('assignment'))
        sub_map = {(s.assignment_id, s.student_id): s for s in subs}

        atts = list(rm.attendance.filter(date__gte=since_30))
        att_by_stu = {}
        for a in atts:
            st_a = att_by_stu.setdefault(a.student_id, {'present': 0, 'absent': 0, 'late': 0, 'excused': 0})
            st_a[a.status] = st_a.get(a.status, 0) + 1

        rm_pcts = []
        rm_pull_up = 0
        for e in enrolls:
            stu = e.student
            grades_list = []
            pct_scores = []
            raw_scores = []
            done_cnt, late_cnt, missed_cnt, pending_cnt = 0, 0, 0, 0

            for a in assignments:
                if a.assigned_to_id and a.assigned_to_id != stu.id:
                    continue
                s = sub_map.get((a.id, stu.id))
                mx = a.max_score or 100
                if s:
                    if s.status == 'submitted':
                        done_cnt += 1
                    elif s.status == 'late':
                        done_cnt += 1
                        late_cnt += 1
                    pct_val = round((s.score / mx) * 100, 1) if (s.score is not None and mx) else None
                    if pct_val is not None:
                        pct_scores.append(pct_val)
                        raw_scores.append(s.score)
                    grades_list.append({
                        'assignment_id': a.id,
                        'title': a.title,
                        'kind': a.kind,
                        'topic_title': a.topic.title if a.topic else '',
                        'score': s.score,
                        'max_score': mx,
                        'pct': pct_val,
                        'mark': s.mark or '',
                        'status': s.status,
                    })
                else:
                    is_overdue = bool(a.deadline and a.deadline < now)
                    if a.kind != 'manual':
                        if is_overdue:
                            missed_cnt += 1
                        else:
                            pending_cnt += 1
                    grades_list.append({
                        'assignment_id': a.id,
                        'title': a.title,
                        'kind': a.kind,
                        'topic_title': a.topic.title if a.topic else '',
                        'score': None,
                        'max_score': mx,
                        'pct': None,
                        'mark': '',
                        'status': 'overdue' if is_overdue else 'pending',
                    })

            avg_pct = round(sum(pct_scores) / len(pct_scores), 1) if pct_scores else None
            avg_raw = round(sum(raw_scores) / len(raw_scores), 1) if raw_scores else None
            if avg_pct is not None:
                rm_pcts.append(avg_pct)
            kr_grade = (
                5 if avg_pct >= 85 else 4 if avg_pct >= 70 else 3 if avg_pct >= 50 else 2
            ) if avg_pct is not None else None

            prog = mastery_map.get(stu.id, {
                'topics': [], 'gaps': [], 'mastered': [], 'learning': [],
                'tested_topics': 0, 'diagnostics': []
            })
            gaps = prog['gaps']
            mastered = prog['mastered']
            learning = prog['learning']
            for g in gaps:
                g_rec = all_gaps_counter.setdefault(g['topic_id'], {
                    'topic_id': g['topic_id'], 'title': g['title'], 'students': []
                })
                if stu.username not in g_rec['students']:
                    g_rec['students'].append(stu.username)

            stu_att = att_by_stu.get(stu.id, {'present': 0, 'absent': 0, 'late': 0, 'excused': 0})
            reasons = []
            if avg_pct is not None and avg_pct < 60:
                reasons.append(f'Низкий средний результат ({avg_pct}%, оценка КР «{kr_grade}»)')
            if gaps:
                reasons.append('Пробелы по темам: ' + ', '.join(g['title'] for g in gaps[:3]))
            if missed_cnt > 0:
                reasons.append(f'Не сдано в срок заданий: {missed_cnt}')
            if stu_att['absent'] >= 2:
                reasons.append(f'Пропусков занятий за 30 дней: {stu_att["absent"]}')
            if avg_pct is None and len(assignments) > 0:
                reasons.append('Нет оценённых работ')

            needs_pull_up = bool(
                (avg_pct is not None and avg_pct < 65)
                or len(gaps) > 0
                or missed_cnt >= 1
                or stu_att['absent'] >= 3
            )
            if needs_pull_up:
                rm_pull_up += 1
                status_level = 'pull_up'
            elif avg_pct is not None and avg_pct >= 80:
                status_level = 'leader'
            else:
                status_level = 'stable'

            # Персональный совет учителю по ученику
            advice_parts = []
            if gaps:
                top_gap = gaps[0]
                advice_parts.append(
                    f"Назначить персональное задание по теме «{top_gap['title']}» (сейчас освоено {top_gap['pct']}%)."
                )
            elif avg_pct is not None and avg_pct < 65:
                low_grades = [g['title'] for g in grades_list if g['pct'] is not None and g['pct'] < 60]
                if low_grades:
                    advice_parts.append(f"Разобрать ошибки в работах: {', '.join(low_grades[:2])}.")
                else:
                    advice_parts.append("Дать тренировочное задание базового уровня (на оценку «3»–«4» по стандарту КР).")
            if missed_cnt > 0:
                advice_parts.append(f"Проконтролировать сдачу {missed_cnt} просроченных заданий.")
            if stu_att['absent'] >= 2:
                advice_parts.append(f"Связаться с родителем в разделе «Сообщения» (пропусков: {stu_att['absent']}).")
            if not advice_parts:
                if status_level == 'leader':
                    advice_parts.append("Отличная динамика! Рекомендуется дать олимпиадное или проектное задание в портфолио.")
                else:
                    advice_parts.append("Учится стабильно. Для выхода на «5» (≥85%) закрепить текущие темы практическими задачами.")

            students_analysis.append({
                'student_id': stu.id,
                'username': stu.username,
                'first_name': stu.first_name or '',
                'classroom_id': rm.id,
                'classroom_title': rm.title,
                'subject_name': rm.subject.name if rm.subject else '',
                'avg_pct': avg_pct,
                'avg_raw': avg_raw,
                'kr_grade': kr_grade,
                'status_level': status_level,
                'needs_pull_up': needs_pull_up,
                'pull_up_reasons': reasons,
                'advice': ' '.join(advice_parts),
                'done_count': done_cnt,
                'late_count': late_cnt,
                'missed_count': missed_cnt,
                'pending_count': pending_cnt,
                'attendance': stu_att,
                'grades': grades_list,
                'mastered_topics': [{'topic_id': m['topic_id'], 'title': m['title'], 'pct': m['pct']} for m in mastered],
                'learning_topics': [{'topic_id': l['topic_id'], 'title': l['title'], 'pct': l['pct']} for l in learning],
                'gap_topics': [{'topic_id': g['topic_id'], 'title': g['title'], 'pct': g['pct']} for g in gaps],
            })

        class_summaries.append({
            'id': rm.id,
            'title': rm.title,
            'subject': rm.subject.name if rm.subject else '',
            'students_count': len(enrolls),
            'avg_pct': round(sum(rm_pcts) / len(rm_pcts), 1) if rm_pcts else None,
            'pull_up_count': rm_pull_up,
        })

    students_analysis.sort(key=lambda x: (not x['needs_pull_up'], x['avg_pct'] is None, x['avg_pct'] if x['avg_pct'] is not None else 999))
    all_pcts = [s['avg_pct'] for s in students_analysis if s['avg_pct'] is not None]
    summary = {
        'total_students': len(students_analysis),
        'leaders_count': sum(1 for s in students_analysis if s['status_level'] == 'leader'),
        'stable_count': sum(1 for s in students_analysis if s['status_level'] == 'stable'),
        'needs_pull_up_count': sum(1 for s in students_analysis if s['needs_pull_up']),
        'overall_avg_pct': round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else None,
        'top_gaps': list(all_gaps_counter.values())[:10],
    }
    return {
        'summary': summary,
        'classes': class_summaries,
        'students': students_analysis,
        'ai_policy': 'ИИ-помощник предназначен только для учителей. ИИ формирует аналитику, советы и черновики заданий/тестов. Учитель проверяет и утверждает материалы; ИИ не выставляет итоговые оценки.',
    }


class TeacherAIAssistantView(APIView):
    """Помощник учителя на базе ИИ (СТРОГО только для учителей и администрации).
    GET  /api/ai/teacher-assistant/?classroom_id=... -> полный анализ учеников, их оценок, кого подтянуть и советы.
    POST /api/ai/teacher-assistant/ {mode: 'analyze'|'draft_assignment'|'draft_explanation'|'draft_test', ...}
    """
    permission_classes = [permissions.IsAuthenticated]

    def _check_teacher(self, request):
        u = request.user
        if not (_is_admin(u) or getattr(u, 'role', None) == 'teacher'):
            raise PermissionDenied('ИИ-помощник доступен только для учителей и администрации')

    def get(self, request):
        self._check_teacher(request)
        cid = request.query_params.get('classroom_id')
        sid = request.query_params.get('student_id')
        data = _build_teacher_student_analysis(request.user, classroom_id=cid, student_id=sid)
        return Response(data)

    def post(self, request):
        self._check_teacher(request)
        from django.conf import settings as _dj
        from apps.assessments.services.gemini_text import generate_text
        import json as _json

        mode = str(request.data.get('mode') or 'analyze').strip()
        api_key = getattr(_dj, 'GEMINI_API_KEY', '')
        model_name = getattr(_dj, 'GEMINI_MODEL', 'gemini-2.5-flash')

        if mode == 'analyze':
            cid = request.data.get('classroom_id')
            sid = request.data.get('student_id')
            teacher_question = str(request.data.get('prompt') or '').strip()[:1000]
            data = _build_teacher_student_analysis(request.user, classroom_id=cid, student_id=sid)
            students = data['students']

            compact_students = []
            for s in students[:40]:
                compact_students.append({
                    'student': f"{s['first_name']} (@{s['username']})".strip(),
                    'class': s['classroom_title'],
                    'avg_pct': s['avg_pct'],
                    'kr_grade': s['kr_grade'],
                    'grades': [f"{g['title']}: {g['score']}/{g['max_score']}" if g['score'] is not None else f"{g['title']}: {g['mark'] or g['status']}" for g in s['grades'][:8]],
                    'gaps': [g['title'] for g in s['gap_topics']],
                    'mastered': [m['title'] for m in s['mastered_topics']],
                    'missed_tasks': s['missed_count'],
                    'absent_days': s['attendance']['absent'],
                    'needs_pull_up': s['needs_pull_up'],
                })

            prompt = (
                "Ты — опытный методист и ИИ-помощник учителя по образовательным стандартам Кыргызстана (МОиН КР). "
                "Проанализируй успеваемость учеников по реальным данным ниже и дай структурированный, понятный разбор для учителя:\n"
                "1) 📊 Общая картина и кто как учится (отличники/хорошисты и у кого какие оценки).\n"
                "2) ⚠️ Кого нужно подтянуть в первую очередь (конкретные имена, их текущие оценки, пропущенные задания и темы-пробелы).\n"
                "3) 💡 Персональные методические советы учителю: как объяснить сложные темы, какие индивидуальные задания дать отстающим и как повысить успеваемость.\n"
                + (f"\nДополнительный запрос учителя: {teacher_question}\n" if teacher_question else "")
                + "\nПиши только по реальным именам и оценкам из JSON, дружелюбно и профессионально.\n\nДАННЫЕ:\n"
                + _json.dumps(compact_students, ensure_ascii=False)
            )
            text, used = generate_text(prompt, api_key, model_name)
            if not text:
                # Надёжный офлайн-анализатор, если нет интернета или квоты API
                leaders = [s for s in students if s['status_level'] == 'leader']
                pull_up = [s for s in students if s['needs_pull_up']]
                stable = [s for s in students if s['status_level'] == 'stable']
                lines = [
                    f"📊 АНАЛИЗ УСПЕВАЕМОСТИ И ОЦЕНОК УЧЕНИКОВ (всего: {len(students)})",
                    f"Средний показатель освоения: {data['summary']['overall_avg_pct'] if data['summary']['overall_avg_pct'] is not None else '—'}%",
                    ""
                ]
                if leaders:
                    lines.append("🏆 Лидеры и отличники (освоение ≥80%, оценка «5»):")
                    for s in leaders[:8]:
                        gr_str = ', '.join(f"{g['title']}: {g['score']}/{g['max_score']}" for g in s['grades'] if g['score'] is not None)[:120]
                        lines.append(f"  • {s['first_name'] or s['username']} (@{s['username']}, {s['classroom_title']}) — средний {s['avg_pct']}% (оценка «{s['kr_grade']}»). Оценки: {gr_str or '—'}")
                    lines.append("")
                if stable:
                    lines.append("📘 Учатся стабильно (хорошисты и базовый уровень):")
                    for s in stable[:8]:
                        lines.append(f"  • {s['first_name'] or s['username']} (@{s['username']}, {s['classroom_title']}) — средний {s['avg_pct'] if s['avg_pct'] is not None else '—'}% (оценка «{s['kr_grade'] or '—'}»). Совет: {s['advice']}")
                    lines.append("")
                if pull_up:
                    lines.append("⚠️ КОГО НУЖНО ПОДТЯНУТЬ (группа внимания):")
                    for s in pull_up[:12]:
                        gr_str = ', '.join(
                            (f"{g['title']}: {g['score']}/{g['max_score']}" if g['score'] is not None else f"{g['title']}: не сдано")
                            for g in s['grades'][:5]
                        )
                        reasons = '; '.join(s['pull_up_reasons'])
                        lines.append(
                            f"  • {s['first_name'] or s['username']} (@{s['username']}, {s['classroom_title']}) — "
                            f"средний: {s['avg_pct'] if s['avg_pct'] is not None else 'нет оценок'}% "
                            f"(оценка КР: «{s['kr_grade'] or '—'}»).\n"
                            f"    Оценки: {gr_str or 'нет работ'}\n"
                            f"    Причины: {reasons}\n"
                            f"    💡 Совет учителю: {s['advice']}"
                        )
                    lines.append("")
                if data['summary']['top_gaps']:
                    lines.append("📚 Темы учебной программы КР, требующие повторения в классе:")
                    for tg in data['summary']['top_gaps'][:5]:
                        lines.append(f"  • «{tg['title']}» — отстают: {', '.join(tg['students'][:6])}")
                    lines.append("")
                lines.append("✅ Рекомендуемый план действий для учителя:")
                lines.append("  1. Назначить персональные задания ученикам из списка «Кого нужно подтянуть» (кнопка «+ Персональное задание» в таблице ниже).")
                lines.append("  2. Провести 10-минутный разбор тем-пробелов в начале следующего урока.")
                lines.append("  3. Отправить уведомление родителям учеников с пропусками через раздел «Сообщения».")
                text = '\n'.join(lines)
                used = 'offline'

            return Response({
                'report': text,
                'source': f'gemini:{used}' if used != 'offline' else 'offline',
                **data,
            })

        elif mode == 'draft_assignment':
            topic_title = str(request.data.get('topic_title') or 'Базовая тема').strip()
            grade = str(request.data.get('grade') or '8').strip()
            student_name = str(request.data.get('student_name') or '').strip()
            difficulty = str(request.data.get('difficulty') or 'базовый (подтянуть пробелы)').strip()
            extra = str(request.data.get('prompt') or '').strip()[:1000]

            prompt = (
                f"Ты — помощник учителя КР. Составь ЧЕРНОВИК учебного задания по теме «{topic_title}» ({grade} класс). "
                f"Уровень: {difficulty}. "
                + (f"Задание персональное для ученика {student_name}, чтобы подтянуть пробелы. " if student_name else "")
                + (f"Пожелание учителя: {extra}. " if extra else "")
                + "Включи: 1) Краткую памятку-подсказку по теме (2-3 предложения); "
                "2) 3 практических задания (от простого на «3» к заданию на «4» и «5»); "
                "3) Чёткие критерии оценивания по 5-балльной шкале стандарта КР. "
                "Учитель проверит и утвердит этот черновик перед отправкой ученику."
            )
            text, used = generate_text(prompt, api_key, model_name)
            if not text:
                text = (
                    f"📌 Памятка по теме «{topic_title}» ({grade} класс):\n"
                    f"Внимательно повтори основные определения и правила по теме «{topic_title}». "
                    f"Выполни задания по шагам от простого к сложному.\n\n"
                    f"✏️ Задания для выполнения:\n"
                    f"1. [Уровень «3» — Базовый] Сформулируй основное правило/понятие по теме «{topic_title}» и приведи 1 простой пример.\n"
                    f"2. [Уровень «4» — Основной] Реши типовую задачу по теме «{topic_title}», записав каждый шаг решения.\n"
                    f"3. [Уровень «5» — Повышенный] Составь и реши практическую задачу по теме «{topic_title}» и объясни полученный вывод.\n"
                    + (f"\nДополнительно: {extra}\n" if extra else "")
                    + "\n🇰🇬 Критерии оценивания (стандарт МОиН КР):\n"
                    "• Оценка «5» (85–100%): верно выполнены все 3 задания с полным пояснением.\n"
                    "• Оценка «4» (70–84%): верно выполнены задания 1 и 2, в 3-м возможна небольшая неточность.\n"
                    "• Оценка «3» (50–69%): выполнено базовое задание 1 и начато задание 2."
                )
                used = 'offline'
            draft_title = f"Отработка темы: {topic_title}" + (f" (для {student_name})" if student_name else "")
            return Response({
                'title': draft_title[:250],
                'instructions': text,
                'recommended_max_score': 5,
                'source': f'gemini:{used}' if used != 'offline' else 'offline',
                'notice': 'Черновик создан ИИ-помощником. Проверьте, при необходимости отредактируйте и утвердите задание.',
            })

        elif mode == 'draft_explanation':
            topic_title = str(request.data.get('topic_title') or 'Учебная тема').strip()
            grade = str(request.data.get('grade') or '8').strip()
            extra = str(request.data.get('prompt') or '').strip()[:1000]
            prompt = (
                f"Ты — помощник учителя КР. Составь ЧЕРНОВИК понятного объяснения учебного материала по теме «{topic_title}» ({grade} класс). "
                + (f"Указание учителя: {extra}. " if extra else "")
                + "Структура:\n"
                "1) Главная суть темы простыми словами (как объяснить за 2 минуты).\n"
                "2) Пошаговый разбор примера (особенно понятно для отстающих учеников).\n"
                "3) Частые ошибки учеников и как их избежать.\n"
                "4) 3 вопроса для быстрой самопроверки класса."
            )
            text, used = generate_text(prompt, api_key, model_name)
            if not text:
                text = (
                    f"📚 КОНСПЕКТ И ОБЪЯСНЕНИЕ ТЕМЫ: «{topic_title}» ({grade} класс)\n\n"
                    f"1️⃣ Главная идея простыми словами:\n"
                    f"Тема «{topic_title}» опирается на базовые понятия предмета и нужна для решения практических задач. "
                    f"Главное — понять алгоритм действий и не пропускать промежуточные шаги.\n\n"
                    f"2️⃣ Пошаговый алгоритм (для разбора с отстающими учениками):\n"
                    f"• Шаг 1: Определи исходные данные и что требуется найти.\n"
                    f"• Шаг 2: Запиши основное правило / формулу по теме «{topic_title}».\n"
                    f"• Шаг 3: Подставь значения и выполни проверку результата.\n\n"
                    f"3️⃣ Частые ошибки учеников:\n"
                    f"• Попытка решить задачу в уме без записи промежуточных действий.\n"
                    f"• Невнимательность к знакам и единицам измерения.\n\n"
                    f"4️⃣ Вопросы для быстрой проверки класса на уроке:\n"
                    f"1. Сформулируйте главное правило по теме «{topic_title}» своими словами.\n"
                    f"2. Где на практике применяется изученное правило?\n"
                    f"3. Какой шаг в решении самый важный для предотвращения ошибок?"
                )
                used = 'offline'
            return Response({
                'title': f"Объяснение темы: {topic_title} ({grade} кл.)",
                'explanation': text,
                'source': f'gemini:{used}' if used != 'offline' else 'offline',
                'notice': 'Черновик объяснения готов. Учитель проверяет и утверждает материал перед публикацией ученикам.',
            })

        raise ValidationError({'mode': 'Неизвестный режим mode'})
