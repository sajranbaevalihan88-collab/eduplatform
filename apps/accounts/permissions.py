"""Роли: учитель пишет, ученик только читает/играет.

Ученик МОЖЕТ: открывать уроки/презентации/тесты, проходить тесты (submit),
играть в Аркан (answer), запускать код (run/run_code/run_project/explain),
пользоваться Word и заметками (свои).
Ученик НЕ МОЖЕТ: создавать/править/удалять уроки, презентации, слайды,
тесты, доски, задачи на код; генерировать вопросы через ИИ (квота).
"""
from rest_framework import permissions

TEACHER_ROLES = ('teacher', 'admin')


class IsTeacherOrAdmin(permissions.BasePermission):
    message = 'Только для учителей'

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated
            and (u.is_staff or getattr(u, 'role', None) in TEACHER_ROLES)
        )


class IsAdmin(permissions.BasePermission):
    message = 'Только для администратора'

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or getattr(u, 'role', None) == 'admin'))


class AdminWriteMixin:
    """Справочники (предметы/курсы): писать может только админ, читать — все."""

    def get_permissions(self):
        if getattr(self, 'action', None) in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsAdmin()]
        return super().get_permissions()


class TeacherWriteMixin:
    """CRUD только учителям. Остальные actions — как было.

    Подмешать ПЕРВЫМ: class XViewSet(TeacherWriteMixin, viewsets.ModelViewSet).
    generate_ai_only: extra actions, тоже закрытые для учеников (напр. 'generate').
    """
    teacher_only_actions = frozenset({'create', 'update', 'partial_update', 'destroy'})
    teacher_extra_actions = frozenset()

    def get_permissions(self):
        if getattr(self, 'action', None) in (self.teacher_only_actions | self.teacher_extra_actions):
            return [permissions.IsAuthenticated(), IsTeacherOrAdmin()]
        return super().get_permissions()
