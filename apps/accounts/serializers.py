import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from rest_framework.validators import UniqueValidator

User = get_user_model()
_USERNAME_VALIDATOR = UnicodeUsernameValidator()
_UNSAFE_NAME_RE = re.compile(r'[<>"\'\x00-\x1f]')


def _clean_person_name(value: str, field_label: str) -> str:
    s = (value or '').strip()
    if _UNSAFE_NAME_RE.search(s):
        raise serializers.ValidationError(f'{field_label} содержит недопустимые символы')
    return s[:150]

class UserSerializer(serializers.ModelSerializer):
    is_staff = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    avatar = serializers.SerializerMethodField()
    banner = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        try:
            return obj.avatar.url if obj.avatar else ''
        except Exception:
            return ''

    def get_banner(self, obj):
        try:
            return obj.banner.url if obj.banner else ''
        except Exception:
            return ''

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role', 'bio',
            'avatar', 'banner', 'banner_preset', 'banner_position', 'date_joined',
            'is_staff', 'is_superuser',
        ]
        read_only_fields = ['id', 'role', 'username', 'date_joined', 'is_staff', 'is_superuser']

class MeUpdateSerializer(serializers.ModelSerializer):
    # ник можно менять, но со всеми проверками как при регистрации
    username = serializers.CharField(
        min_length=3,
        max_length=150,
        validators=[_USERNAME_VALIDATOR, UniqueValidator(User.objects.all(), message='Этот ник уже занят — придумай другой')]
    )
    banner_position = serializers.IntegerField(min_value=0, max_value=100, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'bio', 'banner_preset', 'banner_position']

    def validate_username(self, value):
        value = value.strip()
        if ' ' in value:
            raise serializers.ValidationError('Ник без пробелов')
        if len(value) < 3 or len(value) > 150:
            raise serializers.ValidationError('Ник от 3 до 150 символов')
        _USERNAME_VALIDATOR(value)
        # свой прежний ник не считается «занятым»
        if self.instance and self.instance.username.lower() == value.lower():
            return value
        if User.objects.filter(username__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('Этот ник уже занят — придумай другой')
        return value

    def validate_first_name(self, value):
        return _clean_person_name(value, 'Имя')

    def validate_last_name(self, value):
        return _clean_person_name(value, 'Фамилия')

    def validate_banner_preset(self, value):
        s = (value or '').strip()
        if s and not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', s):
            raise serializers.ValidationError('Некорректный пресет баннера')
        return s


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        min_length=3,
        max_length=150,
        validators=[_USERNAME_VALIDATOR, UniqueValidator(User.objects.all(), message='Этот ник уже занят — придумай другой')]
    )
    password = serializers.CharField(write_only=True, max_length=128)
    # при само-регистрации выдаём ТОЛЬКО student — teacher/admin создаёт администратор
    role = serializers.ChoiceField(choices=[('teacher','Учитель'),('student','Ученик')], default='student', required=False)

    def validate_username(self, value):
        value = (value or '').strip()
        if len(value) < 3 or len(value) > 150:
            raise serializers.ValidationError('Ник от 3 до 150 символов')
        _USERNAME_VALIDATOR(value)
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Этот ник уже занят — придумай другой')
        return value

    def validate_first_name(self, value):
        return _clean_person_name(value, 'Имя')

    def validate_last_name(self, value):
        return _clean_person_name(value, 'Фамилия')

    def validate(self, attrs):
        pw = attrs.get('password') or ''
        temp_user = User(
            username=attrs.get('username', ''),
            email=attrs.get('email', ''),
            first_name=attrs.get('first_name', ''),
            last_name=attrs.get('last_name', ''),
        )
        validate_password(pw, user=temp_user)
        return attrs

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'role', 'first_name', 'last_name']

    def validate_role(self, value):
        if value != 'student':
            raise serializers.ValidationError("Само-регистрация только для учеников — учительский аккаунт выдаёт администратор")
        return value

    def create(self, validated_data):
        # защита от privilege escalation: роль жёстко student, что бы ни прислал клиент
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email',''),
            password=validated_data['password'],
            role='student',
            first_name=validated_data.get('first_name',''),
            last_name=validated_data.get('last_name','')
        )
        return user
