# Для уже развёрнутых БД — добавляет новые предметы из запроса пользователя
from django.db import migrations

def seed_new(apps, schema_editor):
    Subject = apps.get_model('catalog', 'Subject')
    Course = apps.get_model('catalog', 'Course')
    new = [
        {"name":"НВП","slug":"nvp","description":"Начальная военная подготовка","icon":"🪖","color":"#4B5563"},
        {"name":"Кыргызский язык и адабият","slug":"kyrgyz-til-adaabiyat","description":"Кыргыз тили жана адабияты","icon":"🇰🇬","color":"#E11D48"},
        {"name":"Русский язык и литература","slug":"russkiy-yazyk-i-literatura","description":"Русский язык и литература","icon":"📖","color":"#DC2626"},
        {"name":"Мировая литература","slug":"mirovaya-literatura","description":"Зарубежная и мировая классика","icon":"🌍","color":"#7C3AED"},
        {"name":"ЧИО","slug":"chio","description":"Человек и общество","icon":"👥","color":"#0EA5E9"},
    ]
    for d in new:
        obj, created = Subject.objects.get_or_create(slug=d["slug"], defaults=d)
        if created:
            Course.objects.get_or_create(subject=obj, title=f"Введение в {d['name']}", defaults={"description": d["description"]})

def unseed_new(apps, schema_editor):
    Subject = apps.get_model('catalog', 'Subject')
    Subject.objects.filter(slug__in=["nvp","kyrgyz-til-adaabiyat","russkiy-yazyk-i-literatura","mirovaya-literatura","chio"]).delete()

class Migration(migrations.Migration):
    dependencies = [('catalog', '0002_seed_subjects')]
    operations = [migrations.RunPython(seed_new, unseed_new)]
