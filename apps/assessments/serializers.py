from rest_framework import serializers
from .models import Test, Question, AnswerOption, TestAttempt

class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ['id','text','is_correct','order']
        read_only_fields = ['id']

class AnswerOptionPublicSerializer(serializers.ModelSerializer):
    # для взятия теста — скрываем is_correct
    class Meta:
        model = AnswerOption
        fields = ['id','text','order']
        read_only_fields = ['id']

class QuestionSerializer(serializers.ModelSerializer):
    options = AnswerOptionSerializer(many=True, required=False)

    def validate_type(self, value):
        allowed = {'single', 'multiple', 'true_false'}
        if value not in allowed:
            raise serializers.ValidationError("Текстовые вопросы отключены. Доступны: single, multiple, true_false")
        return value

    class Meta:
        model = Question
        fields = ['id','text','type','points','order','explanation','options']
        read_only_fields = ['id']
    
    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        question = Question.objects.create(**validated_data)
        for opt in options_data:
            AnswerOption.objects.create(question=question, **opt)
        return question
    
    def update(self, instance, validated_data):
        from django.db import transaction
        with transaction.atomic():
            options_data = validated_data.pop('options', None)
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()
            if options_data is not None:
                instance.options.all().delete()
                for opt in options_data:
                    AnswerOption.objects.create(question=instance, **opt)
            return instance

class QuestionPublicSerializer(serializers.ModelSerializer):
    options = AnswerOptionPublicSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ['id','text','type','points','order','options']
        read_only_fields = ['id']

def _lesson_field():
    return serializers.PrimaryKeyRelatedField(queryset=__import__('apps.lessons.models', fromlist=['Lesson']).Lesson.objects.all(), required=False, allow_null=True, default=None)

def _validate_lesson_owner(serializer, value):
    if value is None:
        return value
    req = serializer.context.get('request')
    user = req.user if req else None
    is_admin = bool(user and user.is_authenticated and (user.is_staff or getattr(user, 'role', None) == 'admin'))
    if not is_admin and (not user or not user.is_authenticated or (value.owner_id is not None and value.owner_id != user.id)):
        raise serializers.ValidationError("Можно привязать только к своему уроку")
    return value

class TestSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    lesson = _lesson_field()
    def validate_lesson(self, value):
        return _validate_lesson_owner(self, value)
    class Meta:
        model = Test
        fields = ['id','title','description','pass_score','time_limit','time_per_question','is_public','is_lesson_private','lesson','owner','questions','questions_count','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at','owner']

class TestPublicSerializer(serializers.ModelSerializer):
    questions = QuestionPublicSerializer(many=True, read_only=True)
    questions_count = serializers.IntegerField(source='questions.count', read_only=True)
    lesson = _lesson_field()
    class Meta:
        model = Test
        fields = ['id','title','description','pass_score','time_limit','time_per_question','is_public','is_lesson_private','lesson','owner','questions','questions_count','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at','owner']

class TestDetailSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)
    lesson = _lesson_field()
    def validate_lesson(self, value):
        return _validate_lesson_owner(self, value)
    class Meta:
        model = Test
        fields = ['id','title','description','pass_score','time_limit','time_per_question','is_public','is_lesson_private','lesson','owner','questions','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at','owner']

    def create(self, validated_data):
        from django.db import transaction
        with transaction.atomic():
            questions_data = validated_data.pop('questions', [])
            test = Test.objects.create(**validated_data)
            for q_data in questions_data:
                opts = q_data.pop('options', [])
                q = Question.objects.create(test=test, **q_data)
                for o in opts:
                    AnswerOption.objects.create(question=q, **o)
            return test

    def update(self, instance, validated_data):
        from django.db import transaction
        with transaction.atomic():
            # вложенные вопросы: id в validated_data нет (read-only),
            # поэтому честно пересоздаём набор (старые попытки хранят свой слепок).
            questions_data = validated_data.pop('questions', None)
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()
            if questions_data is not None:
                instance.questions.all().delete()
                for q_data in questions_data:
                    opts = q_data.pop('options', [])
                    q = Question.objects.create(test=instance, **q_data)
                    for o in opts:
                        AnswerOption.objects.create(question=q, **o)
            return instance

class TestAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAttempt
        fields = ['id','test','score','max_score','passed','answers','created_at']
        read_only_fields = ['id','score','max_score','passed','created_at']
