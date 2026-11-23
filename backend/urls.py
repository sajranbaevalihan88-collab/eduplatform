import os
import posixpath
from django.contrib import admin
from django.http import Http404, HttpResponse, FileResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def health(request):
    return Response({"status": "ok", "service": "EduPlatform API", "version": "1.0.0"})


_PRIVATE_MEDIA_ROOTS = {'payment_receipts', 'uploads', 'achievements'}
_BLOCKED_MEDIA_EXTS = {'.svg', '.html', '.htm', '.js', '.mjs'}


def safe_public_media(request, subpath=''):
    """Безопасная раздача публичных медиа (аватары, баннеры и т.п.):
    нормализует путь, блокирует обход auth через /media/./payment_receipts/... и активные SVG/HTML.
    При промахе на диске (эфемерный диск Render после редеплоя) отдаёт файл из MediaBlob и восстанавливает на диск."""
    norm = posixpath.normpath('/' + (subpath or '').replace('\\', '/')).lstrip('/')
    if not norm or norm.startswith('..') or '/..' in norm:
        raise Http404()
    top = norm.split('/', 1)[0].lower()
    if top in _PRIVATE_MEDIA_ROOTS:
        raise Http404()
    ext = os.path.splitext(norm)[1].lower()
    if ext in _BLOCKED_MEDIA_EXTS:
        raise Http404()
    disk = os.path.join(str(getattr(settings, 'MEDIA_ROOT', 'media')), norm.replace('/', os.sep))
    if os.path.isfile(disk):
        resp = static_serve(request, norm, document_root=settings.MEDIA_ROOT)
        resp['X-Content-Type-Options'] = 'nosniff'
        resp['Cache-Control'] = 'public, max-age=86400'
        return resp
    try:
        from apps.content.models import MediaBlob
        from apps.content.views import _MEDIA_MIME
        blob = MediaBlob.objects.filter(key=norm).first()
        if blob and blob.data:
            raw = bytes(blob.data)
            try:
                os.makedirs(os.path.dirname(disk), exist_ok=True)
                with open(disk, 'wb') as fh:
                    fh.write(raw)
            except Exception:
                pass
            ctype = _MEDIA_MIME.get(ext, blob.mime or 'application/octet-stream')
            resp = HttpResponse(raw, content_type=ctype)
            resp['X-Content-Type-Options'] = 'nosniff'
            resp['Cache-Control'] = 'public, max-age=86400'
            return resp
    except Exception:
        pass
    raise Http404()


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health),
    path('api/', include('apps.urls')),
]

# DB-backed медиа (переживает редеплои Render free): раньше fallback, иначе 404 с диска
# media_uploads, media_payment_receipts и media_achievements — приватные файлы строго за auth!
from apps.content.views import media_images, media_pdf, media_uploads, media_payment_receipts, media_achievements
urlpatterns += [
    path('media/pptx_images/<path:name>', media_images),
    path('media/pptx_pdf/<path:name>', media_pdf),
    path('media/uploads/<path:name>', media_uploads),
    path('media/payment_receipts/<path:name>', media_payment_receipts),
    path('media/achievements/<path:name>', media_achievements),
    path('media/<path:subpath>', safe_public_media),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
