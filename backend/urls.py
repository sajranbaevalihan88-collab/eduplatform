from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def health(request):
    return Response({"status": "ok", "service": "EduPlatform AI API", "version": "1.0.0"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health),
    path('api/', include('apps.urls')),
]

# DB-backed медиа (переживает редеплои Render free): раньше static(), иначе 404 с диска
from apps.content.views import media_images, media_pdf
urlpatterns += [
    path('media/pptx_images/<path:name>', media_images),
    path('media/pptx_pdf/<path:name>', media_pdf),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    # В проде (Render) тоже отдаём /media из MEDIA_ROOT — иначе загруженные pptx-картинки 404
    # WhiteNoise раздаёт static, media — через django serve (для демо достаточно, для высокой нагрузки — S3)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
