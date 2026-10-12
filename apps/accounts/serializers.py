from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    is_staff = serializers.BooleanField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'bio', 'is_staff']
        read_only_fields = ['id', 'role', 'username', 'is_staff']

class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'bio']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    # role нельзя ставить admin при регистрации
    role = serializers.ChoiceField(choices=[('teacher','Учитель'),('student','Ученик')], default='teacher')
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'role', 'first_name', 'last_name']
    
    def validate_role(self, value):
        if value == 'admin':
            raise serializers.ValidationError("Нельзя зарегистрироваться как admin")
        return value

    def create(self, validated_data):
        # защита от privilege escalation: только teacher/student
        role = validated_data.get('role','teacher')
        if role not in ['teacher','student']:
            role = 'teacher'
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email',''),
            password=validated_data['password'],
            role=role,
            first_name=validated_data.get('first_name',''),
            last_name=validated_data.get('last_name','')
        )
        return user
