from rest_framework import serializers
from .models import Board

class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = ['id','title','data','lesson','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at']
