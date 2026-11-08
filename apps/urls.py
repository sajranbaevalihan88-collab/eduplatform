from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounts.views import RegisterView, login_view, me_view, list_users, logout_view, create_assistant_view, change_password_view, delete_user_view, bootstrap_admin_view, set_user_password_view, list_children_view, parents_list_view, parents_create_view, parents_link_view, ThrottledTokenObtainPairView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from apps.catalog.views import SubjectViewSet, CourseViewSet
from apps.content.views import UploadedFileViewSet, PresentationViewSet, SlideViewSet
from apps.assessments.views import TestViewSet, AttemptViewSet, WordGenView
from apps.lessons.views import LessonViewSet
from apps.code.views import CodeTaskViewSet, CodeSubmissionViewSet, SharedCodeView
from apps.board.views import BoardViewSet
from apps.classroom.views import ClassroomViewSet, AssignmentViewSet, SubmissionViewSet, AnnouncementViewSet, AnnouncementCommentViewSet
from apps.notes.views import NoteViewSet
from apps.word.views import WordDocumentViewSet

router = DefaultRouter()
router.register(r'subjects', SubjectViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'files', UploadedFileViewSet)
router.register(r'presentations', PresentationViewSet)
router.register(r'slides', SlideViewSet)
router.register(r'tests', TestViewSet)
router.register(r'attempts', AttemptViewSet)
router.register(r'lessons', LessonViewSet)
router.register(r'code-tasks', CodeTaskViewSet)
router.register(r'code-submissions', CodeSubmissionViewSet)
router.register(r'boards', BoardViewSet)
router.register(r'classrooms', ClassroomViewSet, basename='classroom')
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'announcement-comments', AnnouncementCommentViewSet, basename='announcement-comment')
router.register(r'notes', NoteViewSet)
router.register(r'word-docs', WordDocumentViewSet)

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', login_view, name='login'),  # теперь возвращает JWT (access+refresh), оставлен для совместимости
    path('auth/logout/', logout_view, name='logout'),
    path('auth/me/', me_view, name='me'),
    path('auth/change-password/', change_password_view, name='change-password'),
    path('auth/users/', list_users, name='users'),
    path('auth/create-assistant/', create_assistant_view, name='create-assistant'),
    path('auth/delete-user/', delete_user_view, name='delete-user'),
    path('auth/set-user-password/', set_user_password_view, name='set-user-password'),
    path('auth/children/', list_children_view, name='children'),
    path('auth/parents/', parents_list_view, name='parents'),
    path('auth/parents/create/', parents_create_view, name='parents-create'),
    path('auth/parents/link/', parents_link_view, name='parents-link'),
    path('auth/bootstrap-admin/', bootstrap_admin_view, name='bootstrap-admin'),
    path('auth/jwt/create/', ThrottledTokenObtainPairView.as_view(), name='jwt-create'),
    path('auth/jwt/refresh/', TokenRefreshView.as_view(), name='jwt-refresh'),
    path('auth/jwt/verify/', TokenVerifyView.as_view(), name='jwt-verify'),
    path('shared/', SharedCodeView.as_view(), name='shared-create'),
    path('shared/<str:token>/', SharedCodeView.as_view(), name='shared-detail'),
    path('ai/words/', WordGenView.as_view(), name='ai-words'),
    path('', include(router.urls)),
]
