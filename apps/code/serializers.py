from rest_framework import serializers
from .models import CodeTask, CodeSubmission


class CodeTaskSerializer(serializers.ModelSerializer):
    tests_count = serializers.SerializerMethodField()
    public_tests = serializers.SerializerMethodField()
    classroom_title = serializers.CharField(source='classroom.title', read_only=True, default='')
    owner_name = serializers.CharField(source='owner.username', read_only=True, default='')
    my_best_score = serializers.SerializerMethodField()
    my_passed = serializers.SerializerMethodField()

    class Meta:
        model = CodeTask
        fields = [
            'id', 'title', 'description', 'language', 'starter_code', 'schema_sql',
            'max_score', 'classroom', 'classroom_title', 'owner', 'owner_name',
            'tests_count', 'public_tests', 'my_best_score', 'my_passed', 'created_at',
        ]
        read_only_fields = ['id', 'owner', 'created_at']

    def get_tests_count(self, obj):
        return len(obj.tests) if isinstance(obj.tests, list) else 0

    def get_public_tests(self, obj):
        if not isinstance(obj.tests, list):
            return []
        out = []
        for idx, item in enumerate(obj.tests):
            if not isinstance(item, dict):
                continue
            hidden = bool(item.get('hidden'))
            label = str(item.get('label') or f'Тест {idx + 1}')
            if hidden:
                out.append({'label': label, 'hidden': True})
            else:
                safe = {'label': label, 'hidden': False}
                for key in ('input', 'expected', 'type', 'value', 'required_sql', 'expected_columns'):
                    if key in item:
                        safe[key] = item[key]
                out.append(safe)
        return out

    def _my_subs(self, obj):
        req = self.context.get('request')
        if not req or not req.user.is_authenticated:
            return None
        return obj.submissions.filter(user=req.user)

    def get_my_best_score(self, obj):
        qs = self._my_subs(obj)
        if qs is None:
            return None
        best = qs.order_by('-score', '-passed').first()
        return best.score if best else None

    def get_my_passed(self, obj):
        qs = self._my_subs(obj)
        if qs is None:
            return False
        return qs.filter(passed=True).exists()


class CodeTaskDetailSerializer(CodeTaskSerializer):
    """Для владельца / учителя / админа — показывает solution и полные tests."""
    class Meta(CodeTaskSerializer.Meta):
        fields = CodeTaskSerializer.Meta.fields + ['solution', 'tests']


class CodeSubmissionSerializer(serializers.ModelSerializer):
    task_title = serializers.CharField(source='task.title', read_only=True, default='')

    class Meta:
        model = CodeSubmission
        fields = [
            'id', 'task', 'task_title', 'code', 'output',
            'passed', 'score', 'passed_tests', 'total_tests', 'test_results', 'created_at',
        ]
        read_only_fields = ['id', 'output', 'passed', 'score', 'passed_tests', 'total_tests', 'test_results', 'created_at']
