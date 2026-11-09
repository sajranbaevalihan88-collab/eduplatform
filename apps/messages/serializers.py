from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    recipient_name = serializers.CharField(source='recipient.username', read_only=True)
    recipient_role = serializers.CharField(source='recipient.role', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'sender_role',
                  'recipient', 'recipient_name', 'recipient_role',
                  'text', 'read_at', 'created_at']
        read_only_fields = ['id', 'sender', 'read_at', 'created_at']
