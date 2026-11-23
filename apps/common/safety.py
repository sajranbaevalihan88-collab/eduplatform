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


def validate_ooxml_zip(
    source,
    max_uncompressed_bytes: int = 80 * 1024 * 1024,
    max_files: int = 800,
    max_entry_bytes: int = 20 * 1024 * 1024,
):
    """Защита от ZIP-бомб и path-traversal при разборе OOXML (.docx / .pptx).

    Проверяет метаданные центрального каталога ДО распаковки содержимого.
    Бросает ValueError при подозрительном архиве.
    """
    import zipfile

    try:
        with zipfile.ZipFile(source, 'r') as zf:
            infos = zf.infolist()
            if len(infos) > max_files:
                raise ValueError('Архив документа содержит слишком много файлов')
            total_uncompressed = 0
            for info in infos:
                name = (info.filename or '').replace('\\', '/')
                if name.startswith('/') or '..' in name.split('/'):
                    raise ValueError('Недопустимый путь внутри архива документа')
                if info.file_size > max_entry_bytes:
                    raise ValueError('Внутренний файл документа превышает лимит размера')
                total_uncompressed += info.file_size
                if total_uncompressed > max_uncompressed_bytes:
                    raise ValueError('Распакованный размер документа превышает лимит безопасности')
                if info.file_size > 1024 * 1024 and info.compress_size > 0:
                    if (info.file_size / info.compress_size) > 100:
                        raise ValueError('Обнаружена подозрительная степень сжатия архива (ZIP-бомба)')
    except zipfile.BadZipFile:
        raise ValueError('Повреждённый или некорректный архив документа')

