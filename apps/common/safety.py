"""Утилиты безопасности ввода/вывода (CSV-санитизация, проверка файлов)."""
import io
from rest_framework.exceptions import ValidationError

SAFE_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}


def csv_safe(value):
    """Защита от CSV-инъекций (Formula Injection).

    Если значение начинается с опасных символов (=, +, -, @, \\t, \\r),
    Excel или LibreOffice могут интерпретировать его как формулу или макрос.
    Экранируем одинарной кавычкой.
    """
    if value is None:
        return ''
    s = str(value)
    if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + s
    return s


def validate_image_file(f, max_mb=5):
    """Строгая проверка загружаемой картинки по реальной сигнатуре через Pillow.

    Проверяет:
    1) Размер файла (не более max_mb).
    2) Формат по содержимому (JPEG, PNG, WEBP, GIF), а не по заголовкам клиента.
    Защищает от загрузки HTML/SVG/скриптов под видом картинок.
    """
    if not f:
        raise ValidationError({'file': 'Файл не прикреплен'})
    if f.size > max_mb * 1024 * 1024:
        raise ValidationError({'file': f'Размер файла превышает {max_mb} МБ'})
    try:
        from PIL import Image
        pos = f.tell() if hasattr(f, 'tell') else 0
        img_bytes = f.read(1024 * 1024)
        if hasattr(f, 'seek'):
            f.seek(pos)
        img = Image.open(io.BytesIO(img_bytes))
        fmt = (img.format or '').upper()
        if fmt not in SAFE_IMAGE_FORMATS:
            raise ValidationError({'file': 'Допустимы только изображения форматов JPEG, PNG, WEBP, GIF'})
    except ValidationError:
        raise
    except Exception:
        raise ValidationError({'file': 'Некорректный или повреждённый файл изображения'})
    return f


def validate_portfolio_file(f, max_mb=8):
    """Проверка файла для портфолио: изображение либо PDF."""
    if not f:
        return None
    if f.size > max_mb * 1024 * 1024:
        raise ValidationError({'file': f'Файл больше {max_mb} МБ'})
    name = (f.name or '').lower()
    ext = name.rsplit('.', 1)[-1] if '.' in name else ''
    if ext == 'pdf':
        pos = f.tell() if hasattr(f, 'tell') else 0
        header = f.read(5)
        if hasattr(f, 'seek'):
            f.seek(pos)
        if not header.startswith(b'%PDF-'):
            raise ValidationError({'file': 'Некорректный файл PDF'})
        return f
    return validate_image_file(f, max_mb=max_mb)

