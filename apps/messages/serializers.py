from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    recipient_name = serializers.CharField(source='recipient.username', read_only=True)
    recipient_role = serializers.CharField(source='recipient.role', read_only=True)
    status = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'sender_role',
                  'recipient', 'recipient_name', 'recipient_role',
                  'text', 'status', 'read_at', 'delivered_at',
                  'is_deleted', 'created_at']
        read_only_fields = ['id', 'sender', 'read_at', 'delivered_at',
                            'is_deleted', 'created_at']

    def get_text(self, obj):
        # после «удалить у всех» содержимое не показываем никому
        return '' if obj.is_deleted else obj.text

    def get_status(self, obj):
        if obj.read_at:
            return 'read'
        if obj.delivered_at:
            return 'delivered'
        return 'sent'
