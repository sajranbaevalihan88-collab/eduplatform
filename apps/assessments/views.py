from rest_framework import viewsets, permissions, status, throttling
from rest_framework.decorators import action
from rest_framework.response import Response
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
        test = self.get_object()
        # Только одна попытка для авторизованных — как просили "только один раз и всё"
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
        for q in test.questions.all():
            total += q.points
            user_answer = answers.get(str(q.id)) or answers.get(q.id)
            is_correct = False
            try:
                if q.type == 'single':
                    correct = list(q.options.filter(is_correct=True).values_list('id', flat=True))
                    if user_answer is not None:
                        if isinstance(user_answer, list) and len(user_answer)==1:
                            user_answer = user_answer[0]
                        is_correct = int(user_answer) in correct if user_answer else False
                elif q.type == 'multiple':
                    correct = set(q.options.filter(is_correct=True).values_list('id', flat=True))
                    given = set(map(int, user_answer)) if user_answer else set()
                    is_correct = given == correct and len(given)>0
                elif q.type == 'true_false':
                    correct = list(q.options.filter(is_correct=True).values_list('id', flat=True))
                    is_correct = int(user_answer) in correct if user_answer else False
                elif q.type == 'text':
                    correct_opts = q.options.filter(is_correct=True)
                    if correct_opts.exists():
                        correct_texts = [o.text.strip().lower() for o in correct_opts]
                        given = str(user_answer).strip().lower() if user_answer else ""
                        is_correct = given in correct_texts
                    else:
                        is_correct = bool(user_answer)
            except:
                is_correct=False
            if is_correct:
                earned += q.points
            details.append({'question_id': q.id, 'correct': is_correct, 'points': q.points if is_correct else 0})
        
        score_pct = (earned/total*100) if total else 0
        passed = score_pct >= test.pass_score
        attempt = TestAttempt.objects.create(
            test=test,
            user=request.user if request.user.is_authenticated else None,
            score=round(score_pct,1),
            max_score=total,
            passed=passed,
            answers=answers
        )
        return Response({
            'attempt_id': attempt.id,
            'score': attempt.score,
            'earned': earned,
            'total': total,
            'passed': passed,
            'details': details
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
            except Exception as e:
                return Response({'error': f"Ошибка: {e}"}, status=400)
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
        except Exception as e:
            return Response({'error': f"Ошибка: {e}"}, status=500)

class AttemptViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TestAttempt.objects.all().order_by('-created_at')
    serializer_class = TestAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user,'role',None)=='admin':
            return super().get_queryset()
        return super().get_queryset().filter(user=user)
