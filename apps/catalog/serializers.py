from rest_framework import serializers
from django.utils.text import slugify
from .models import Subject, Course

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id','subject','title','description','level','created_at']
        read_only_fields = ['id','created_at']

class SubjectSerializer(serializers.ModelSerializer):
    courses = CourseSerializer(many=True, read_only=True)
    courses_count = serializers.IntegerField(read_only=True)
    # slug не обязателен со стороны клиента: генерируем из «name» с гарантией уникальности
    slug = serializers.CharField(required=False)
    class Meta:
        model = Subject
        fields = ['id','name','slug','description','icon','color','courses','courses_count','created_at']
        read_only_fields = ['id','created_at']

    def _unique_slug(self, name: str) -> str:
        base = slugify(name, allow_unicode=True) or 'predmet'
        slug, i = base, 1
        while Subject.objects.filter(slug=slug).exists():
            i += 1
            slug = f'{base}-{i}'
        return slug

    def validate(self, attrs):
        # при создании slug берём из названия (учитываем транслит-запас, если пусто — «predmet-N»)
        if self.instance is None and not attrs.get('slug'):
            attrs['slug'] = self._unique_slug(attrs.get('name', ''))
        return attrs
