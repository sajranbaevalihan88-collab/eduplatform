from rest_framework import serializers
from .models import Subject, Course

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id','subject','title','description','level','created_at']
        read_only_fields = ['id','created_at']

class SubjectSerializer(serializers.ModelSerializer):
    courses = CourseSerializer(many=True, read_only=True)
    courses_count = serializers.IntegerField(read_only=True)
    class Meta:
        model = Subject
        fields = ['id','name','slug','description','icon','color','courses','courses_count','created_at']
        read_only_fields = ['id','created_at']
