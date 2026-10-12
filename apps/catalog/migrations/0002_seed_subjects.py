# Generated for prod deploy — seed базовых предметов, иначе LessonBuilder показывает "Загрузка предметов..."
from django.db import migrations

def seed_subjects(apps, schema_editor):
    Subject = apps.get_model('catalog', 'Subject')
    Course = apps.get_model('catalog', 'Course')
    defaults = [
        {"name":"Математика","slug":"matematika","description":"Алгебра, геометрия, анализ","icon":"📐","color":"#3B82F6"},
        {"name":"Физика","slug":"fizika","description":"Механика, термодинамика, оптика","icon":"⚛️","color":"#8B5CF6"},
        {"name":"Информатика","slug":"informatika","description":"Программирование, алгоритмы","icon":"💻","color":"#06B6D4"},
        {"name":"Химия","slug":"himiya","description":"Органическая и неорганическая","icon":"🧪","color":"#10B981"},
        {"name":"Биология","slug":"biologiya","description":"Ботаника, зоология, анатомия","icon":"🌱","color":"#84CC16"},
        {"name":"История","slug":"istoriya","description":"Всеобщая и отечественная","icon":"📜","color":"#F59E0B"},
        {"name":"Русский язык","slug":"russkiy-yazyk","description":"Грамматика, литература","icon":"📚","color":"#EF4444"},
        {"name":"Английский язык","slug":"angliyskiy-yazyk","description":"Grammar, vocabulary","icon":"🇬🇧","color":"#6366F1"},
        # Новые по запросу пользователя — Кыргызстан
        {"name":"НВП","slug":"nvp","description":"Начальная военная подготовка","icon":"🪖","color":"#4B5563"},
        {"name":"Кыргызский язык и адабият","slug":"kyrgyz-til-adaabiyat","description":"Кыргыз тили жана адабияты","icon":"🇰🇬","color":"#E11D48"},
        {"name":"Русский язык и литература","slug":"russkiy-yazyk-i-literatura","description":"Русский язык и литература","icon":"📖","color":"#DC2626"},
        {"name":"Мировая литература","slug":"mirovaya-literatura","description":"Зарубежная и мировая классика","icon":"🌍","color":"#7C3AED"},
        {"name":"ЧИО","slug":"chio","description":"Человек и общество","icon":"👥","color":"#0EA5E9"},
    ]
    for d in defaults:
        obj, created = Subject.objects.get_or_create(slug=d["slug"], defaults=d)
        if created and obj.name != d["name"]:
            obj.name = d["name"]; obj.save(update_fields=["name"])
        # курс по умолчанию чтобы счётчик не 0
        Course.objects.get_or_create(subject=obj, title=f"Введение в {d['name']}", defaults={"description": d["description"]})

def unseed_subjects(apps, schema_editor):
    Subject = apps.get_model('catalog', 'Subject')
    Subject.objects.filter(slug__in=["matematika","fizika","informatika","himiya","biologiya","istoriya","russkiy-yazyk","angliyskiy-yazyk","nvp","kyrgyz-til-adaabiyat","russkiy-yazyk-i-literatura","mirovaya-literatura","chio"]).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_subjects, unseed_subjects),
    ]
