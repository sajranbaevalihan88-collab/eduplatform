from rest_framework import serializers
from .models import CodeTask, CodeSubmission

class CodeTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeTask
        fields = ['id','title','description','language','starter_code','created_at']
        read_only_fields = ['id','created_at']

class CodeTaskDetailSerializer(serializers.ModelSerializer):
    # для владельца / админа — показывает solution/tests
    class Meta:
        model = CodeTask
        fields = ['id','title','description','language','starter_code','solution','tests','created_at']
        read_only_fields = ['id','created_at']

class CodeSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeSubmission
        fields = ['id','task','code','output','passed','created_at']
        read_only_fields = ['id','output','passed','created_at']
