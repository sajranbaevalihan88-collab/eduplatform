from rest_framework import viewsets, permissions, status, throttling
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Test, TestAttempt, Question
from .serializers import TestSerializer, TestDetailSerializer, TestAttemptSerializer, TestPublicSerializer
from apps.accounts.permissions import TeacherWriteMixin

class TestViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    teacher_extra_actions = frozenset({'generate'})
    queryset = Test.objects.prefetch_related('questions__options').all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]
    
    def get_serializer_class(self):
        if self.action in ['create','update','partial_update']:
            return TestDetailSerializer
        # для list/retrieve показываем public без is_correct если не владелец/админ
        if self.action in ['list','retrieve']:
            user = self.request.user
            if user.is_authenticated and (user.is_staff or getattr(user,'role',None)=='admin'):
                return TestSerializer
            # владелец теста видит ответы
            if self.action == 'retrieve' and user.is_authenticated:
                try:
                    obj = self.get_object()
                    if obj.owner == user:
                        return TestSerializer
                except: pass
            return TestPublicSerializer
        return TestSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('lesson')
        user = self.request.user
        from django.db.models import Q
        # гость: публичное + уроковое из опубликованных уроков (ответы скрывает сериалайзер)
        # зарегистрированный: + своё (черновики/приватное — только владелец)
        lesson_visible = Q(is_lesson_private=True, lesson__is_published=True)
        if not user.is_authenticated:
            qs = qs.filter(Q(is_public=True) | lesson_visible)
        elif not (user.is_staff or getattr(user, 'role', None) == 'admin'):
            qs = qs.filter(Q(owner=user) | Q(is_public=True) | lesson_visible)
        is_pub = self.request.query_params.get('is_public')
        if is_pub is not None and is_pub != '':
            if is_pub.lower() in ('true', '1', 'yes'):
                qs = qs.filter(is_public=True)
            elif is_pub.lower() in ('false', '0', 'no'):
                qs = qs.filter(is_public=False)
        is_lesson = self.request.query_params.get('is_lesson_private')
        if is_lesson is not None and is_lesson != '':
            if is_lesson.lower() in ('true', '1', 'yes'):
                qs = qs.filter(is_lesson_private=True)
            elif is_lesson.lower() in ('false', '0', 'no'):
                qs = qs.filter(is_lesson_private=False)
        owner = self.request.query_params.get('owner')
        if owner == 'me' and user.is_authenticated:
            qs = qs.filter(owner=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user if self.request.user.is_authenticated else None)

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user,'role',None)=='admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец может редактировать")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец может редактировать")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user,'role',None)=='admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle])
    def submit(self, request, pk=None):
        from django.db import transaction
        import logging
        logger = logging.getLogger(__name__)
        test = self.get_object()
        # Только одна попытка для авторизованных — как просили "только один раз и всё"
        # (двойная защита: проверка + транзакция + unique на уровне приложения)
        if request.user.is_authenticated and TestAttempt.objects.filter(test=test, user=request.user).exists():
            return Response({'error':'Вы уже проходили этот тест. Повторное прохождение запрещено — только один раз.', 'already_attempted': True}, status=403)
        answers = request.data.get('answers', {})
        if not isinstance(answers, dict):
            return Response({'error':'answers должен быть объектом'}, status=400)
        # лимит размера answers
        if len(str(answers)) > 10000:
            return Response({'error':'Слишком много данных'}, status=400)
        total = 0
        earned = 0
        details = []
        # используем prefetched options из queryset (prefetch_related), без N+1
        questions = list(test.questions.all())
        # собрать все options одним запросом
        from .models import AnswerOption
        q_ids = [q.id for q in questions]
        opts_by_q = {}
        if q_ids:
            for opt in AnswerOption.objects.filter(question_id__in=q_ids).only('id', 'question_id', 'is_correct', 'text'):
                opts_by_q.setdefault(opt.question_id, []).append(opt)
        for q in questions:
            total += q.points
            # явная проверка ключей: ответ 0/""/[] не должен теряться через `or`
            key_str, key_int = str(q.id), q.id
            if key_str in answers:
                user_answer = answers[key_str]
            elif key_int in answers:
                user_answer = answers[key_int]
            else:
                user_answer = None
            is_correct = False
            try:
                q_opts = opts_by_q.get(q.id, [])
                if q.type == 'single':
                    correct = [o.id for o in q_opts if o.is_correct]
                    if user_answer is not None and user_answer != '':
                        if isinstance(user_answer, list) and len(user_answer) == 1:
                            user_answer = user_answer[0]
                        try:
                            is_correct = int(user_answer) in correct
                        except (TypeError, ValueError):
                            is_correct = False
                elif q.type == 'multiple':
                    correct = {o.id for o in q_opts if o.is_correct}
                    given = set()
                    if user_answer:
                        # нормализация: list | int | str (строку "1,2" парсим, а не разбиваем на символы)
                        if isinstance(user_answer, (list, tuple)):
                            raw = list(user_answer)
                        elif isinstance(user_answer, str):
                            raw = [p.strip() for p in user_answer.replace(';', ',').split(',') if p.strip() != '']
                        else:
                            raw = [user_answer]
                        try:
                            given = {int(x) for x in raw}
                        except (TypeError, ValueError):
                            given = set()
                    is_correct = given == correct and len(given) > 0
                elif q.type == 'true_false':
                    correct = [o.id for o in q_opts if o.is_correct]
                    if user_answer is not None and user_answer != '':
                        try:
                            is_correct = int(user_answer) in correct
                        except (TypeError, ValueError):
                            is_correct = False
                elif q.type == 'text':
                    # legacy: текстовый тип отключён для новых вопросов,
                    # ветка оставлена чтобы старые тесты продолжали оцениваться
                    correct_opts = [o for o in q_opts if o.is_correct]
                    if correct_opts:
                        correct_texts = [o.text.strip().lower() for o in correct_opts]
                        given = str(user_answer).strip().lower() if user_answer not in (None, '') else ""
                        is_correct = given in correct_texts
                    else:
                        is_correct = bool(user_answer)
            except Exception:
                logger.exception("submit scoring failed q=%s", q.id)
                is_correct = False
            if is_correct:
                earned += q.points
            details.append({'question_id': q.id, 'correct': is_correct, 'points': q.points if is_correct else 0})
        
        score_pct = (earned/total*100) if total else 0
        passed = score_pct >= test.pass_score
        with transaction.atomic():
            # повторная проверка внутри транзакции против race двойного сабмита
            if request.user.is_authenticated and TestAttempt.objects.filter(test=test, user=request.user).exists():
                return Response({'error':'Вы уже проходили этот тест. Повторное прохождение запрещено — только один раз.', 'already_attempted': True}, status=403)
            attempt = TestAttempt.objects.create(
                test=test,
                user=request.user if request.user.is_authenticated else None,
                score=round(score_pct,1),
                max_score=total,
                passed=passed,
                answers=answers
            )
            # Класс-рум: тест назначен заданием — отметка «Сдано» происходит сразу здесь,
            # а не отдельным кликом в классе. Счётчик отдаём фронту для тоста.
            assigned_done = 0
            if request.user.is_authenticated:
                try:
                    from apps.classroom.models import Assignment, Submission
                    from django.utils import timezone as _tz
                    for a in Assignment.objects.filter(kind='test', test=test,
                                                       classroom__enrollments__student=request.user).only('id', 'deadline'):
                        late = bool(a.deadline and _tz.now() > a.deadline)
                        Submission.objects.update_or_create(
                            assignment=a, student=request.user,
                            defaults={'status': 'late' if late else 'submitted',
                                      'score': attempt.score, 'attempt': attempt})
                        assigned_done += 1
                except Exception:
                    logger.exception('classroom auto-submit failed for test %s', test.id)
        return Response({
            'attempt_id': attempt.id,
            'score': attempt.score,
            'earned': earned,
            'total': total,
            'passed': passed,
            'details': details,
            'assignments_done': assigned_done
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle])
    def answer(self, request, pk=None):
        """Проверка одного ответа для игр (Аркан): POST {question_id, option_id} -> {correct}.
        Правильные ответы не отдаём — только да/нет, читерить через devtools не выйдет."""
        test = self.get_object()
        try:
            qid = int(request.data.get('question_id'))
            oid = int(request.data.get('option_id'))
        except Exception:
            return Response({'error': 'question_id и option_id обязательны'}, status=400)
        try:
            q = test.questions.get(id=qid)
        except Question.DoesNotExist:
            return Response({'error': 'Вопрос не из этого теста'}, status=400)
        if q.type not in ('single', 'true_false'):
            return Response({'error': 'В игре только вопросы с вариантами'}, status=400)
        try:
            opt = q.options.get(id=oid)
        except Exception:
            return Response({'error': 'Нет такого варианта'}, status=400)
        return Response({'correct': bool(opt.is_correct)})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[])
    def generate(self, request):
        """AI-генерация вопросов из текста урока.
        Сначала пробуем настоящий Gemini (если задан GEMINI_API_KEY),
        иначе — честный офлайн-генератор. Ответ всегда содержит source:
        'gemini:<model>' или 'offline' — фронт показывает это учителю.
        POST /api/tests/generate/ {lesson_id?, text?, count?, prompt?} -> {questions:[...], source}.
        Вопросы НЕ сохраняются — учитель правит их в конструкторе и сохраняет как обычно."""
        from .services.generator import generate_questions
        from .services.gemini_gen import generate_with_gemini
        from django.conf import settings as _dj
        text = request.data.get('text', '')
        lesson_id = request.data.get('lesson_id')
        if lesson_id and not text:
            try:
                from apps.lessons.models import Lesson
                lesson = Lesson.objects.get(id=int(lesson_id))
                user = request.user
                is_admin = user.is_staff or getattr(user, 'role', None) == 'admin'
                if lesson.owner_id is not None and lesson.owner_id != user.id and not is_admin:
                    # чужие уроки тоже можно использовать как источник, если они опубликованы/публичны
                    if not getattr(lesson, 'is_published', False):
                        return Response({'error': 'Нет доступа к уроку'}, status=403)
                parts = []
                for b in (lesson.blocks or []):
                    if isinstance(b, dict) and b.get('type') == 'text':
                        d = b.get('data') or {}
                        if d.get('title'):
                            parts.append(str(d['title']))
                        if d.get('content'):
                            parts.append(str(d['content']))
                text = '\n'.join(parts)
            except Lesson.DoesNotExist:
                return Response({'error': 'Урок не найден'}, status=404)
            except Exception:
                import logging as _lg
                _lg.getLogger(__name__).exception("generate lesson load failed")
                return Response({'error': 'Не удалось загрузить урок'}, status=400)
        prompt = request.data.get('prompt', '')
        if not isinstance(prompt, str):
            prompt = ''
        prompt = prompt.strip()[:2000]
        has_text = isinstance(text, str) and len(text.strip()) >= 100
        has_prompt = len(prompt) >= 10
        if not has_text and not has_prompt:
            return Response({'error': 'Напиши указание для ИИ (от 10 символов) или дай текст от 100 символов (или выбери урок)'}, status=400)
        try:
            count = int(request.data.get('count') or 5)
        except Exception:
            count = 5
        count = max(1, min(40, count))
        try:
            api_key = getattr(_dj, 'GEMINI_API_KEY', '')
            model = getattr(_dj, 'GEMINI_MODEL', 'gemini-2.5-flash')
            questions, used = (None, None)
            if api_key:
                questions, used = generate_with_gemini((text or '')[:20000], count, api_key, model, prompt)
            if questions:
                return Response({'questions': questions, 'count': len(questions), 'source': f'gemini:{used}'})
            if not has_text:
                return Response({'error': 'Без текста офлайн-режим не умеет — напиши текст от 100 символов или проверь связь с Gemini'}, status=400)
            offline = generate_questions(text[:20000], count)
            if not offline:
                return Response({'error': 'Из этого текста вопросы не получились — добавь определений вида «Термин — что это»'}, status=400)
            return Response({'questions': offline, 'count': len(offline), 'source': 'offline'})
        except Exception:
            import logging as _lg2
            _lg2.getLogger(__name__).exception("generate failed")
            return Response({'error': 'Не удалось сгенерировать вопросы, попробуй позже'}, status=500)

class AttemptViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TestAttempt.objects.all().order_by('-created_at')
    serializer_class = TestAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user,'role',None)=='admin':
            return super().get_queryset()
        return super().get_queryset().filter(user=user)


class WordGenView(APIView):
    """AI-подбор СЛОВ для игр (Найди слово / Виселица): тема -> список слов.
    POST /api/ai/words/ {prompt, count} -> {words:[...], source}. Без GEMINI_API_KEY -> 503."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.conf import settings as _dj
        from .services.gemini_text import generate_text
        prompt = str(request.data.get('prompt') or '').strip()[:300]
        if len(prompt) < 3:
            return Response({'error': 'Напиши тему минимум из 3 символов'}, status=400)
        try:
            count = int(request.data.get('count') or 10)
        except Exception:
            count = 10
        count = max(3, min(20, count))
        api_key = getattr(_dj, 'GEMINI_API_KEY', '')
        if not api_key:
            return Response({'error': 'ИИ не подключён на сервере (нет GEMINI_API_KEY) — введи слова сам или возьми из урока'}, status=503)
        gprompt = (
            f"Дай РОВНО {count} отдельных коротких СЛОВ по теме: «{prompt}». "
            "Это для школьной игры «угадай слово». Правила: только реальные существительные/имена; "
            "Маленькими буквами; каждое слово отдельно; БЕЗ фраз из нескольких слов, БЕЗ знаков препинания; "
            "длина 3-12 букв; дубликаты запрещены; язык роли — как в теме (русский/кыргызский/английский). "
            "Ответ — ТОЛЬКО JSON-массив строк, без пояснений."
        )
        items, used = generate_text(gprompt, api_key, getattr(_dj, 'GEMINI_MODEL', ''), expect_json=True)
        import re as _re
        words = []
        seen = set()
        if isinstance(items, list):
            for it in items:
                w = _re.sub(r'[^\w\u0400-\u04FF\u0600-\u06FF\u0900-\u097F]', '', str(it)).strip().lower() if isinstance(it, str) else ''
                if 3 <= len(w) <= 12 and w not in seen:
                    words.append(w)
                    seen.add(w)
                if len(words) >= count:
                    break
        if not words:
            return Response({'error': 'ИИ не вернул слов — попробуй другую тему'}, status=502)
        return Response({'words': words, 'count': len(words), 'source': f'gemini:{used}'})
