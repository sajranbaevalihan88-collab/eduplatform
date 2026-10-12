from rest_framework import serializers
from .models import WordDocument


class WordDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = WordDocument
        fields = [
            'id', 'title', 'body_html', 'source_name', 'page_size',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
