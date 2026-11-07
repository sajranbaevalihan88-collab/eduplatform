from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """page_size=20 по умолчанию + ?page_size=N (до 200) — фронт может попросить
    весь список для классов (>20 заданий/учеников иначе невидимы)."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200
