from rest_framework import serializers
from .models import Lesson

class LessonListSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default=None)
    subject_color = serializers.CharField(source='subject.color', read_only=True, default='#6366F1')
    subject_icon = serializers.CharField(source='subject.icon', read_only=True, default='📚')
    course_title = serializers.CharField(source='course.title', read_only=True, default=None)
    blocks_count = serializers.SerializerMethodField()
    owner = serializers.ReadOnlyField(source='owner.id')
    class Meta:
        model = Lesson
        fields = ['id','title','description','subject','subject_name','subject_color','subject_icon','course','course_title','is_published','blocks_count','created_at','updated_at','owner']
        read_only_fields = ['id','created_at','updated_at','owner']
    def get_blocks_count(self, obj):
        return len(obj.blocks) if obj.blocks else 0

class LessonSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default=None)
    subject_color = serializers.CharField(source='subject.color', read_only=True, default='#6366F1')
    subject_icon = serializers.CharField(source='subject.icon', read_only=True, default='📚')
    course_title = serializers.CharField(source='course.title', read_only=True, default=None)
    blocks_count = serializers.SerializerMethodField()
    owner = serializers.ReadOnlyField(source='owner.id')
    class Meta:
        model = Lesson
        fields = ['id','title','description','subject','subject_name','subject_color','subject_icon','course','course_title','is_published','blocks','blocks_count','created_at','updated_at','owner']
        read_only_fields = ['id','created_at','updated_at','owner']
    def get_blocks_count(self, obj):
        return len(obj.blocks) if obj.blocks else 0
    def validate_blocks(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("blocks must be a list")
        if len(value) > 50:
            raise serializers.ValidationError("Слишком много блоков (макс 50)")
        allowed_types = {'text','file','presentation','test','code','board','video'}
        for b in value:
            if not isinstance(b, dict):
                raise serializers.ValidationError("Каждый блок должен быть объектом")
            t = b.get('type')
            if t not in allowed_types:
                raise serializers.ValidationError(f"Недопустимый тип блока: {t}")
            data = b.get('data')
            if not isinstance(data, dict):
                raise serializers.ValidationError("data должен быть объектом")
            # санитизация текстовых полей
            if t == 'text':
                title = data.get('title','')[:200] if isinstance(data.get('title'), str) else ''
                content = data.get('content','')[:5000] if isinstance(data.get('content'), str) else ''
                # убираем теги
                import re
                title = re.sub(r'<[^>]*>', '', title)
                content = re.sub(r'<[^>]*>', '', content)
                b['data']['title'] = title
                b['data']['content'] = content
            if t == 'video':
                url = (data.get('url','') or '').strip()
                if url:
                    # авто-конверт youtu.be / watch?v= / shorts → embed
                    import re as _re
                    m = _re.search(r'youtu\.be/([a-zA-Z0-9_-]+)', url)
                    if m:
                        url = f"https://www.youtube.com/embed/{m.group(1)}"
                    else:
                        m = _re.search(r'[?&]v=([a-zA-Z0-9_-]+)', url)
                        if m:
                            url = f"https://www.youtube.com/embed/{m.group(1)}"
                        else:
                            m = _re.search(r'youtube\.com/shorts/([a-zA-Z0-9_-]+)', url)
                            if m:
                                url = f"https://www.youtube.com/embed/{m.group(1)}"
                    if not url.startswith('https://'):
                        raise serializers.ValidationError("Видео URL должен начинаться с https://")
                    # вайтлист youtube/vimeo — разрешаем любой https, но нормализуем
                    if not any(url.startswith(p) for p in ['https://www.youtube.com/embed/','https://player.vimeo.com/','https://www.youtube-nocookie.com/embed/']):
                        if 'youtube.com' in url or 'youtu.be' in url or 'vimeo.com' in url:
                            pass
                        else:
                            # разрешаем любой https для гибкости
                            pass
                    b['data']['url'] = url
        return value

    def validate_title(self, value):
        import re
        clean = re.sub(r'<[^>]*>', '', value)
        if len(clean) > 300:
            raise serializers.ValidationError("Заголовок слишком длинный")
        return clean
