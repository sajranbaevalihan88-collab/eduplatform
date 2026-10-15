from rest_framework import serializers
from .models import UploadedFile, Presentation, Slide

class UploadedFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    class Meta:
        model = UploadedFile
        fields = ['id','title','file','url','file_type','mime_type','size','created_at']
        read_only_fields = ['id','size','file_type','created_at']
    def get_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

class SlideSerializer(serializers.ModelSerializer):
    def validate_content(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("content должен быть объектом")
        blocks = value.get('blocks', [])
        if not isinstance(blocks, list) or len(blocks) > 200:
            raise serializers.ValidationError("blocks должен быть списком до 200")
        allowed_types = ['text','image','shape','table','chart','video','icon','group']
        for b in blocks:
            if not isinstance(b, dict) or b.get('type') not in allowed_types:
                raise serializers.ValidationError(f"Недопустимый блок типа {b.get('type')}")
            if b['type'] == 'text':
                c = b.get('content','')
                if isinstance(c, str):
                    import re
                    b['content'] = re.sub(r'<[^>]*>', '', c)[:5000]
                # paragraphs/runs уже санитизированы на бэке, пропускаем
            if b['type'] == 'image':
                src = b.get('src','')
                if isinstance(src, str):
                    if src.startswith('javascript:') or src.startswith('data:text/html'):
                        raise serializers.ValidationError("Недопустимый src")
                    if src.startswith('data:') and not src.startswith('data:image/'):
                        raise serializers.ValidationError("Только image data URL разрешены")
                    if src.startswith('javascript:') or 'onerror=' in src.lower():
                        raise serializers.ValidationError("Недопустимый src")
        return value

    def validate_background(self, value):
        import re
        if not isinstance(value, str):
            raise serializers.ValidationError("background должен быть строкой")
        # hex, gradient, rgb, theme
        if re.match(r'^#[0-9a-fA-F]{6}$', value) or re.match(r'^#[0-9a-fA-F]{3,8}$', value):
            return value
        if value.startswith('linear-gradient') or value.startswith('radial-gradient') or value.startswith('rgb') or value.startswith('url('):
            return value[:2000]
        if value in ['#ffffff','#000000','transparent']:
            return value
        # разрешаем любой hex-подобный с #
        if value.startswith('#'):
            return value[:200]
        raise serializers.ValidationError("background должен быть hex или gradient")

    def validate_gradient(self, value):
        if value and not isinstance(value, str):
            raise serializers.ValidationError("gradient должен быть строкой")
        return value[:2000] if value else ''

    def validate_bg_image(self, value):
        if value and not isinstance(value, str):
            raise serializers.ValidationError("bg_image должен быть строкой")
        if value and value.startswith('javascript:'):
            raise serializers.ValidationError("Недопустимый bg_image")
        return value[:4000] if value else ''

    class Meta:
        model = Slide
        fields = ['id','presentation','order','background','background_type','gradient','bg_image','layout','transition','width','height','content','notes','preview_image']
        read_only_fields = ['id']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not data.get('background_type'):
            data['background_type'] = 'solid'
        data['backgroundType'] = data.get('background_type', 'solid')
        data['bgImage'] = data.get('bg_image', '')
        data['preview_image'] = data.get('preview_image','')
        return data

    def to_internal_value(self, data):
        # поддержка camelCase от фронта (backgroundType → background_type, bgImage → bg_image)
        if isinstance(data, dict):
            mapped = {}
            for k, v in data.items():
                if k == 'backgroundType':
                    mapped['background_type'] = v
                elif k == 'bgImage':
                    mapped['bg_image'] = v
                else:
                    mapped[k] = v
            # если оба варианта — приоритет snake
            if 'backgroundType' in data and 'background_type' in data:
                mapped['background_type'] = data['background_type']
            if 'bgImage' in data and 'bg_image' in data:
                mapped['bg_image'] = data['bg_image']
            data = mapped
        return super().to_internal_value(data)

class PresentationSerializer(serializers.ModelSerializer):
    slides = SlideSerializer(many=True, read_only=True)
    slides_count = serializers.IntegerField(source='slides.count', read_only=True)
    owner = serializers.ReadOnlyField(source='owner.id')
    pdf_url = serializers.SerializerMethodField()
    def get_pdf_url(self, obj):
        try:
            if obj.pdf_file:
                return obj.pdf_file.url
        except Exception:
            pass
        return ''
    subject = serializers.PrimaryKeyRelatedField(queryset=__import__('apps.catalog.models', fromlist=['Subject']).Subject.objects.all(), required=True, allow_null=False)
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    subject_slug = serializers.CharField(source='subject.slug', read_only=True, default='')
    lesson = serializers.PrimaryKeyRelatedField(queryset=__import__('apps.lessons.models', fromlist=['Lesson']).Lesson.objects.all(), required=False, allow_null=True, default=None)
    class Meta:
        model = Presentation
        fields = ['id','title','description','subject','subject_name','subject_slug','is_public','is_lesson_private','lesson','owner','created_at','updated_at','slides','slides_count','pdf_url','pdf_pages']
        read_only_fields = ['id','created_at','updated_at','owner']

    def validate_subject(self, value):
        if not value:
            raise serializers.ValidationError("Выбери предмет — без него презентация не сохранится")
        return value

    def validate_lesson(self, value):
        if value is None:
            return value
        req = self.context.get('request')
        user = req.user if req else None
        is_admin = bool(user and user.is_authenticated and (user.is_staff or getattr(user, 'role', None) == 'admin'))
        if not is_admin and (not user or not user.is_authenticated or (value.owner_id is not None and value.owner_id != user.id)):
            raise serializers.ValidationError("Можно привязать только к своему уроку")
        return value
