from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework.validators import UniqueValidator

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    is_staff = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'bio', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'role', 'username', 'is_staff', 'is_superuser']

class MeUpdateSerializer(serializers.ModelSerializer):
    # ник можно менять, но со всеми проверками как при регистрации
    username = serializers.CharField(
        min_length=3,
        validators=[UniqueValidator(User.objects.all(), message='Этот ник уже занят — придумай другой')]
    )
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'bio']

    def validate_username(self, value):
        value = value.strip()
        if ' ' in value:
            raise serializers.ValidationError('Ник без пробелов')
        if len(value) < 3:
            raise serializers.ValidationError('Ник минимум 3 символа')
        # свой прежний ник не считается «занятым»
        if self.instance and self.instance.username.lower() == value.lower():
            return value
        if User.objects.filter(username__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('Этот ник уже занят — придумай другой')
        return value


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        max_length=150,
        validators=[UniqueValidator(User.objects.all(), message='Этот ник уже занят — придумай другой')]
    )
    password = serializers.CharField(write_only=True, validators=[validate_password])
    # при само-регистрации выдаём ТОЛЬКО student — teacher/admin создаёт администратор
    role = serializers.ChoiceField(choices=[('teacher','Учитель'),('student','Ученик')], default='student', required=False)

    def validate_username(self, value):
        value = (value or '').strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Этот ник уже занят — придумай другой')
        return value
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
