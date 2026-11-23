"""Automated security & core feature test suite for EduPlatform.

Run with:
    USE_SQLITE=1 python manage.py test apps.tests_security
"""

from __future__ import annotations

import io
import os
import tempfile

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from pptx import Presentation as PptxPresentation
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.classroom.models import Classroom, Enrollment, Submission
from apps.code.models import CodeTask
from apps.content.models import Presentation, Slide, UploadedFile


def _make_png_bytes(width: int = 40, height: int = 40, color=(37, 99, 235)) -> bytes:
    buf = io.BytesIO()
    Image.new('RGB', (width, height), color).save(buf, format='PNG')
    return buf.getvalue()


def _make_jpeg_with_exif_bytes() -> bytes:
    img = Image.new('RGB', (60, 60), (20, 120, 200))
    exif = img.getexif()
    exif[271] = 'SecretCameraModel'  # Make tag
    buf = io.BytesIO()
    img.save(buf, format='JPEG', exif=exif.tobytes())
    return buf.getvalue()


class EduPlatformSecurityTestCase(APITestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(
            username='sec_teacher', password='StrongPassword123!', role='teacher'
        )
        self.student_a = User.objects.create_user(
            username='sec_student_a', password='StrongPassword123!', role='student'
        )
        self.student_b = User.objects.create_user(
            username='sec_student_b', password='StrongPassword123!', role='student'
        )
        self.admin = User.objects.create_user(
            username='sec_admin', password='StrongPassword123!', role='admin', is_staff=True
        )

    def test_self_registration_cannot_escalate_to_teacher_or_admin(self):
        c = APIClient()
        for bad_role in ('teacher', 'admin'):
            r = c.post(
                '/api/auth/register/',
                {'username': f'esc_{bad_role}', 'password': 'StrongPassword123!', 'role': bad_role},
                format='json',
            )
            self.assertEqual(r.status_code, 400)
            self.assertFalse(User.objects.filter(username=f'esc_{bad_role}').exists())

        ok = c.post(
            '/api/auth/register/',
            {'username': 'normal_pupil', 'password': 'StrongPassword123!', 'role': 'student'},
            format='json',
        )
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(User.objects.get(username='normal_pupil').role, 'student')

    def test_security_headers_and_auth_no_store(self):
        c = APIClient()
        r = c.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(r.headers.get('X-Frame-Options'), 'DENY')
        self.assertIn('camera=()', r.headers.get('Permissions-Policy', ''))
        self.assertEqual(r.headers.get('X-Permitted-Cross-Domain-Policies'), 'none')

        c.force_authenticate(user=self.student_a)
        r_me = c.get('/api/auth/me/')
        self.assertEqual(r_me.status_code, 200)
        self.assertIn('no-store', r_me.headers.get('Cache-Control', ''))

    @override_settings(BOOTSTRAP_ADMIN_KEY='')
    def test_bootstrap_admin_disabled_without_strong_key(self):
        c = APIClient()
        r = c.post('/api/auth/bootstrap-admin/', {'key': 'anything', 'username': 'sec_student_a'}, format='json')
        self.assertEqual(r.status_code, 403)

    @override_settings(BOOTSTRAP_ADMIN_KEY='short-key')
    def test_bootstrap_admin_rejects_short_key(self):
        c = APIClient()
        r = c.post('/api/auth/bootstrap-admin/', {'key': 'short-key', 'username': 'sec_student_a'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_private_uploaded_file_idor_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                uf = UploadedFile.objects.create(
                    title='Секретный экзамен',
                    file=SimpleUploadedFile('exam.txt', b'Secret Exam Answers', content_type='text/plain'),
                    owner=self.teacher,
                    is_public=False,
                )
                # Another student must NOT read private file via raw() or preview_text()
                cs = APIClient()
                cs.force_authenticate(user=self.student_a)
                self.assertEqual(cs.get(f'/api/files/{uf.id}/raw/').status_code, 404)
                self.assertEqual(cs.get(f'/api/files/{uf.id}/preview_text/').status_code, 404)

                # Unauthenticated guest also gets 404
                self.assertEqual(APIClient().get(f'/api/files/{uf.id}/raw/').status_code, 404)

                # Owner can read it
                ct = APIClient()
                ct.force_authenticate(user=self.teacher)
                r_own = ct.get(f'/api/files/{uf.id}/raw/')
                self.assertEqual(r_own.status_code, 200)
                self.assertIn(b'Secret Exam Answers', r_own.content)

    def test_payment_receipt_protected_from_unauth_and_other_students(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                room = Classroom.objects.create(title='Платный курс', owner=self.teacher, is_paid=True, price=1500)
                enr = Enrollment.objects.create(
                    classroom=room,
                    student=self.student_a,
                    receipt=SimpleUploadedFile('check.png', _make_png_bytes(), content_type='image/png'),
                )
                url = f'/media/{enr.receipt.name}'

                # Anonymous user -> 404
                self.assertEqual(APIClient().get(url).status_code, 404)

                # Another student -> 404
                c_b = APIClient()
                c_b.force_login(self.student_b)
                self.assertEqual(c_b.get(url).status_code, 404)

                # Student owner -> 200
                c_a = APIClient()
                c_a.force_login(self.student_a)
                r_a = c_a.get(url)
                self.assertEqual(r_a.status_code, 200)
                r_a.close()

                # Classroom teacher -> 200
                c_t = APIClient()
                c_t.force_login(self.teacher)
                r_t = c_t.get(url)
                self.assertEqual(r_t.status_code, 200)
                r_t.close()

    def test_upload_magic_bytes_rejects_disguised_html_as_png_and_pdf(self):
        c = APIClient()
        c.force_authenticate(user=self.teacher)
        fake_png = SimpleUploadedFile('evil.png', b'<script>alert(1)</script>', content_type='image/png')
        r1 = c.post('/api/files/', {'file': fake_png, 'title': 'fake'}, format='multipart')
        self.assertEqual(r1.status_code, 400)

        fake_pdf = SimpleUploadedFile('evil.pdf', b'<html>not a pdf</html>', content_type='application/pdf')
        r2 = c.post('/api/files/', {'file': fake_pdf, 'title': 'fake2'}, format='multipart')
        self.assertEqual(r2.status_code, 400)

    def test_avatar_upload_strips_exif_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                c = APIClient()
                c.force_authenticate(user=self.student_a)
                jpg = SimpleUploadedFile('photo.jpg', _make_jpeg_with_exif_bytes(), content_type='image/jpeg')
                r = c.patch('/api/auth/me/', {'avatar': jpg}, format='multipart')
                self.assertEqual(r.status_code, 200)
                self.student_a.refresh_from_db()
                with Image.open(self.student_a.avatar.path) as saved:
                    self.assertNotIn(271, saved.getexif())

    def test_code_sandbox_blocks_dangerous_python_js_and_pip(self):
        c = APIClient()
        c.force_authenticate(user=self.student_a)

        dangerous_py = [
            'import os\nprint(os.listdir("."))',
            'import subprocess\nsubprocess.run(["id"])',
            'print(open("/etc/passwd").read())',
            'print(().__class__.__bases__[0].__subclasses__())',
            'eval("1+1")',
        ]
        for snippet in dangerous_py:
            r = c.post('/api/code-tasks/run_code/', {'code': snippet, 'language': 'python'}, format='json')
            self.assertEqual(r.status_code, 400, f'Must block: {snippet}')
            self.assertFalse(r.data.get('passed'))

        dangerous_js = [
            'const fs = require("fs"); console.log(fs.readdirSync("."));',
            'console.log(process.env);',
            'Function("return this")();',
            'console.log(Reflect.ownKeys(this));',
        ]
        for snippet in dangerous_js:
            r = c.post('/api/code-tasks/run_code/', {'code': snippet, 'language': 'javascript'}, format='json')
            self.assertEqual(r.status_code, 400, f'Must block JS: {snippet}')

        # pip install via run_project is disabled by default
        r_pip = c.post(
            '/api/code-tasks/run_project/',
            {'files': [{'path': 'main.py', 'content': 'print(1)'}], 'entry': 'main.py', 'requirements': 'requests'},
            format='json',
        )
        self.assertFalse(r_pip.data.get('passed'))

    def test_private_presentation_export_idor_blocked_and_public_export_valid(self):
        priv = Presentation.objects.create(title='Приватная', owner=self.teacher, is_public=False)
        Slide.objects.create(presentation=priv, order=0, content={'blocks': []})

        cs = APIClient()
        cs.force_authenticate(user=self.student_a)
        self.assertEqual(cs.get(f'/api/presentations/{priv.id}/export_pptx/').status_code, 404)

        pub = Presentation.objects.create(title='Публичная', owner=self.teacher, is_public=True)
        Slide.objects.create(
            presentation=pub,
            order=0,
            notes='Подсказка',
            content={
                'blocks': [
                    {'type': 'text', 'content': 'Заголовок', 'style': {'x': 10, 'y': 10, 'w': 80, 'h': 15}},
                    {'type': 'table', 'style': {'x': 10, 'y': 30, 'w': 40, 'h': 30}, 'table': {'rows': 2, 'cols': 2, 'cells': [[{'text': 'A'}, {'text': 'B'}], [{'text': '1'}, {'text': '2'}]]}},
                ]
            },
        )
        r = cs.get(f'/api/presentations/{pub.id}/export_pptx/')
        self.assertEqual(r.status_code, 200)
        prs = PptxPresentation(io.BytesIO(r.content))
        self.assertEqual(len(prs.slides), 1)
        self.assertTrue(any(sh.has_table for sh in prs.slides[0].shapes))

    def test_code_and_sql_autograder_syncs_gradebook_and_masks_hidden_tests(self):
        room = Classroom.objects.create(title='Информатика 9А', owner=self.teacher)
        Enrollment.objects.create(classroom=room, student=self.student_a)

        ct = APIClient()
        ct.force_authenticate(user=self.teacher)

        r_py = ct.post(
            '/api/code-tasks/',
            {
                'title': 'Сумма A+B',
                'language': 'python',
                'max_score': 100,
                'classroom': room.id,
                'tests': [
                    {'label': 'T1', 'input': '2\n3\n', 'expected': '5', 'hidden': False},
                    {'label': 'T2', 'input': '100\n250\n', 'expected': '350', 'hidden': True},
                ],
            },
            format='json',
        )
        self.assertEqual(r_py.status_code, 201)
        task_id = r_py.data['id']

        cs = APIClient()
        cs.force_authenticate(user=self.student_a)
        r_sub = cs.post(
            f'/api/code-tasks/{task_id}/run/',
            {'code': 'a=int(input())\nb=int(input())\nprint(a+b)'},
            format='json',
        )
        self.assertEqual(r_sub.status_code, 200)
        self.assertTrue(r_sub.data['passed'])
        self.assertEqual(r_sub.data['score'], 100.0)
        self.assertTrue(r_sub.data['gradebook_synced'])
        # Hidden test details must NOT leak to student
        self.assertNotIn('expected', r_sub.data['test_results'][1])
        self.assertNotIn('input', r_sub.data['test_results'][1])

        # Verify score landed in Classroom Gradebook!
        task_obj = CodeTask.objects.get(pk=task_id)
        self.assertIsNotNone(task_obj.assignment_id)
        gb_sub = Submission.objects.get(assignment=task_obj.assignment, student=self.student_a)
        self.assertEqual(gb_sub.score, 100.0)

    def test_backup_and_restore_security_and_roundtrip(self):
        from apps.catalog.models import Subject
        from apps.school.models import Topic, LessonSlot, Attendance, Substitution
        from apps.classroom.models import Assignment
        import json as _json
        from datetime import date

        subj, _ = Subject.objects.get_or_create(slug='math', defaults={'name': 'Математика'})
        Topic.objects.get_or_create(subject=subj, grade='8', num=1, defaults={'title': 'Квадратные уравнения'})

        other_teacher = User.objects.create_user(
            username='sec_other_teacher', password='StrongPassword123!', role='teacher'
        )
        room = Classroom.objects.create(title='Алгебра 8А', subject=subj, owner=self.teacher)
        Enrollment.objects.create(classroom=room, student=self.student_a)
        LessonSlot.objects.create(classroom=room, weekday=1, num=2, subject=subj, room='204')
        Substitution.objects.create(classroom=room, date=date(2026, 9, 10), num=2, subject=subj, note='Замена')
        assign = Assignment.objects.create(classroom=room, kind='manual', manual_title='Контрольная №1', max_score=100)
        Submission.objects.create(assignment=assign, student=self.student_a, score=92.0, status='submitted')
        Attendance.objects.create(classroom=room, student=self.student_a, date=date(2026, 9, 10), lesson_num=2, status='present')

        # 1. Student cannot download or restore backups
        cs = APIClient()
        cs.force_authenticate(user=self.student_a)
        self.assertEqual(cs.get('/api/classrooms/backup_data/').status_code, 403)
        self.assertEqual(cs.post('/api/classrooms/restore_backup/', {'topics': []}, format='json').status_code, 403)

        # 2. Teacher downloads backup of their class
        ct = APIClient()
        ct.force_authenticate(user=self.teacher)
        r_dl = ct.get('/api/classrooms/backup_data/')
        self.assertEqual(r_dl.status_code, 200)
        backup_payload = _json.loads(r_dl.content.decode('utf-8'))
        self.assertEqual(backup_payload['classes_count'], 1)

        # 3. Other teacher attempting restore with teacher's invite_code MUST NOT overwrite teacher's class or global topics
        cot = APIClient()
        cot.force_authenticate(user=other_teacher)
        tampered = _json.loads(_json.dumps(backup_payload))
        tampered['topics'][0]['title'] = 'HACKED TOPIC'
        tampered['classes'][0]['title'] = 'HIJACKED CLASS'
        r_ot = cot.post('/api/classrooms/restore_backup/', tampered, format='json')
        self.assertEqual(r_ot.status_code, 200)
        self.assertEqual(r_ot.data['restored_topics'], 0)
        self.assertTrue(r_ot.data['topics_skipped_not_admin'])
        room.refresh_from_db()
        self.assertEqual(room.title, 'Алгебра 8А')
        self.assertEqual(Topic.objects.get(subject=subj, grade='8', num=1).title, 'Квадратные уравнения')

        # 4. Admin can restore full backup after wiping classroom + topic
        room.delete()
        Topic.objects.filter(subject=subj, grade='8', num=1).delete()
        ca = APIClient()
        ca.force_authenticate(user=self.admin)
        r_res = ca.post('/api/classrooms/restore_backup/', backup_payload, format='json')
        self.assertEqual(r_res.status_code, 200)
        self.assertEqual(r_res.data['restored_topics'], 1)
        self.assertEqual(r_res.data['restored_classes'], 1)
        self.assertEqual(r_res.data['restored_schedule'], 1)
        self.assertEqual(r_res.data['restored_substitutions'], 1)
        self.assertEqual(r_res.data['restored_assignments'], 1)
        self.assertEqual(r_res.data['restored_submissions'], 1)
        self.assertEqual(r_res.data['restored_attendance'], 1)
        restored_room = Classroom.objects.get(invite_code=backup_payload['classes'][0]['invite_code'])
        self.assertEqual(restored_room.title, 'Алгебра 8А')
        self.assertEqual(Submission.objects.get(assignment__classroom=restored_room, student=self.student_a).score, 92.0)

    def test_pptx_export_blocks_anon_and_private_media_lfi(self):
        import zipfile
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                os.makedirs(os.path.join(tmp, 'payment_receipts'), exist_ok=True)
                secret_png = os.path.join(tmp, 'payment_receipts', 'secret_receipt.png')
                with open(secret_png, 'wb') as fh:
                    fh.write(_make_png_bytes())

                payload = {
                    'title': 'Attack Deck',
                    'slides': [{
                        'background': '#ffffff',
                        'content': {
                            'blocks': [
                                {'type': 'image', 'src': '/media/payment_receipts/secret_receipt.png', 'style': {'x': 10, 'y': 10, 'w': 40, 'h': 40}},
                                {'type': 'image', 'src': '/media/pptx_images/../payment_receipts/secret_receipt.png', 'style': {'x': 10, 'y': 10, 'w': 40, 'h': 40}},
                                {'type': 'image', 'src': secret_png, 'style': {'x': 10, 'y': 10, 'w': 40, 'h': 40}},
                                {'type': 'image', 'src': 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+', 'style': {'x': 10, 'y': 10, 'w': 40, 'h': 40}},
                            ]
                        },
                    }],
                }
                # 1. Anonymous user must be rejected (401)
                self.assertEqual(APIClient().post('/api/presentations/export_pptx/', payload, format='json').status_code, 401)

                # 2. Authenticated user gets valid PPTX with ZERO leaked media files
                cs = APIClient()
                cs.force_authenticate(user=self.student_a)
                r = cs.post('/api/presentations/export_pptx/', payload, format='json')
                self.assertEqual(r.status_code, 200)
                with zipfile.ZipFile(io.BytesIO(r.content), 'r') as zf:
                    media_entries = [n for n in zf.namelist() if n.startswith('ppt/media/')]
                    self.assertEqual(media_entries, [], f'Leaked media entries into PPTX: {media_entries}')

    def test_slide_viewset_hides_private_slides_and_blocks_cross_pres_injection(self):
        priv_pres = Presentation.objects.create(title='Секрет учителя', owner=self.teacher, is_public=False)
        priv_slide = Slide.objects.create(presentation=priv_pres, order=0, content={'blocks': [{'type': 'text', 'content': 'SECRET'}]})

        # Anonymous guest must NOT see private slide in list or detail
        anon = APIClient()
        self.assertEqual(anon.get(f'/api/slides/{priv_slide.id}/').status_code, 404)
        r_list = anon.get('/api/slides/')
        self.assertEqual(r_list.status_code, 200)
        items = r_list.data if isinstance(r_list.data, list) else r_list.data.get('results', [])
        self.assertFalse(any(s['id'] == priv_slide.id for s in items))

        # Another teacher must NOT inject their own slide into teacher's presentation via PATCH
        other_teacher = User.objects.create_user(username='sec_slide_attacker', password='StrongPassword123!', role='teacher')
        own_pres = Presentation.objects.create(title='Своя', owner=other_teacher, is_public=False)
        own_slide = Slide.objects.create(presentation=own_pres, order=0, content={'blocks': []})

        cot = APIClient()
        cot.force_authenticate(user=other_teacher)
        r_inj = cot.patch(f'/api/slides/{own_slide.id}/', {'presentation': priv_pres.id}, format='json')
        self.assertEqual(r_inj.status_code, 403)
        own_slide.refresh_from_db()
        self.assertEqual(own_slide.presentation_id, own_pres.id)

    def test_import_pptx_blocks_students_and_svg_and_dot_media_traversal_blocked(self):
        cs = APIClient()
        cs.force_authenticate(user=self.student_a)
        dummy_pptx = SimpleUploadedFile('deck.pptx', b'PK\x03\x04fake', content_type='application/octet-stream')
        self.assertEqual(cs.post('/api/presentations/import/', {'file': dummy_pptx}, format='multipart').status_code, 403)

        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                os.makedirs(os.path.join(tmp, 'pptx_images'), exist_ok=True)
                os.makedirs(os.path.join(tmp, 'payment_receipts'), exist_ok=True)
                with open(os.path.join(tmp, 'pptx_images', 'xss.svg'), 'wb') as fh:
                    fh.write(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
                with open(os.path.join(tmp, 'payment_receipts', 'secret.png'), 'wb') as fh:
                    fh.write(_make_png_bytes())

                anon = APIClient()
                self.assertEqual(anon.get('/media/pptx_images/xss.svg').status_code, 404)
                self.assertEqual(anon.get('/media/./payment_receipts/secret.png').status_code, 404)

    def test_restore_backup_blocks_student_kidnapping_and_javascript_urls(self):
        from apps.classroom.models import Assignment
        room_a = Classroom.objects.create(title='Класс A', owner=self.teacher)
        Enrollment.objects.create(classroom=room_a, student=self.student_a)

        attacker = User.objects.create_user(username='sec_kidnapper', password='StrongPassword123!', role='teacher')
        c_att = APIClient()
        c_att.force_authenticate(user=attacker)
        r = c_att.post('/api/classrooms/restore_backup/', {
            'classes': [{
                'title': 'Ловушка',
                'invite_code': 'TRAP1234',
                'students': [{'username': self.student_a.username}],
                'assignments': [{'kind': 'link', 'title': 'XSS', 'url': 'javascript:alert(1)', 'max_score': 100}],
            }]
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['restored_enrollments'], 0)
        trap_room = Classroom.objects.get(invite_code='TRAP1234')
        self.assertFalse(Enrollment.objects.filter(classroom=trap_room, student=self.student_a).exists())
        asgn = Assignment.objects.get(classroom=trap_room)
        self.assertEqual(asgn.url, '')

    def test_diagnostic_oracle_blocked_and_live_quiz_idor_and_origin_validated(self):
        from apps.assessments.models import Test, Question, AnswerOption
        priv_test = Test.objects.create(title='Приватный экзамен', owner=self.teacher, is_public=False)
        q1 = Question.objects.create(test=priv_test, text='2+2?', type='single', order=0)
        AnswerOption.objects.create(question=q1, text='4', is_correct=True)
        AnswerOption.objects.create(question=q1, text='5', is_correct=False)

        diag_test = Test.objects.create(title='Входная диагностика', owner=self.teacher, is_public=True, is_diagnostic=True)
        q2 = Question.objects.create(test=diag_test, text='3+3?', type='single', order=0)
        opt_ok = AnswerOption.objects.create(question=q2, text='6', is_correct=True)
        AnswerOption.objects.create(question=q2, text='7', is_correct=False)

        # Anonymous cannot oracle-probe diagnostic test answers
        self.assertEqual(
            APIClient().post(f'/api/tests/{diag_test.id}/submit/', {'answers': {str(q2.id): opt_ok.id}}, format='json').status_code,
            401,
        )

        # Another teacher cannot launch LiveQuiz from someone else's private test
        other_teacher = User.objects.create_user(username='sec_quiz_other', password='StrongPassword123!', role='teacher')
        cot = APIClient()
        cot.force_authenticate(user=other_teacher)
        self.assertEqual(cot.post('/api/live-quiz/create/', {'test_id': priv_test.id}, format='json').status_code, 404)

        # Malicious QR origin is rejected (falls back to relative path)
        ct = APIClient()
        ct.force_authenticate(user=self.teacher)
        r_qr = ct.post('/api/live-quiz/create/', {'test_id': priv_test.id, 'origin': 'https://evil-phish.example'}, format='json')
        self.assertEqual(r_qr.status_code, 201)
        self.assertTrue(r_qr.data['join_url'].startswith('/live?pin='))

    def test_rotated_refresh_revoked_on_password_change_and_admin_privilege_guards(self):
        c = APIClient()
        r_login = c.post('/api/auth/jwt/create/', {'username': 'sec_student_a', 'password': 'StrongPassword123!'}, format='json')
        self.assertEqual(r_login.status_code, 200)
        ref1 = r_login.data['refresh']

        # Rotate refresh token (SimpleJWT 5.3.1 rotated tokens were previously missed on password change!)
        r_rot = c.post('/api/auth/jwt/refresh/', {'refresh': ref1}, format='json')
        self.assertEqual(r_rot.status_code, 200)
        acc2 = r_rot.data['access']
        ref2 = r_rot.data['refresh']

        # Change password using new access token
        c_auth = APIClient()
        c_auth.credentials(HTTP_AUTHORIZATION=f'Bearer {acc2}')
        r_pw = c_auth.post('/api/auth/change-password/', {
            'old_password': 'StrongPassword123!',
            'new_password': 'EvenStrongerPassword456!',
        }, format='json')
        self.assertEqual(r_pw.status_code, 200)

        # Rotated pre-change refresh2 MUST be rejected immediately!
        r_revoked = APIClient().post('/api/auth/jwt/refresh/', {'refresh': ref2}, format='json')
        self.assertEqual(r_revoked.status_code, 401)

        # Non-superuser admin cannot mint another admin ('assistant')
        c_adm = APIClient()
        c_adm.force_authenticate(user=self.admin)
        r_asst = c_adm.post('/api/auth/create-assistant/', {
            'username': 'shadow_admin',
            'password': 'StrongPassword123!',
            'role': 'assistant',
        }, format='json')
        self.assertEqual(r_asst.status_code, 403)

        # Bootstrap endpoint must be disabled once ANY superuser exists
        User.objects.create_superuser(username='root_super', email='', password='StrongPassword123!', role='admin')
        with override_settings(BOOTSTRAP_ADMIN_KEY='a-very-long-random-secret-key-32chars'):
            r_boot = APIClient().post('/api/auth/bootstrap-admin/', {
                'key': 'a-very-long-random-secret-key-32chars',
                'username': 'sec_student_b',
            }, format='json')
            self.assertEqual(r_boot.status_code, 403)

    def test_sandbox_blocks_advanced_escapes_and_windows_traversal_while_allowing_safe_code(self):
        c = APIClient()
        c.force_authenticate(user=self.student_a)

        advanced_py_attacks = [
            '# coding: raw_unicode_escape\nprint(1)',
            'if (',  # SyntaxError must fail closed
            'import posix\nprint(posix.listdir("."))',
            'from sys import modules\nprint(modules)',
            'f = open\nprint(f("/etc/passwd").read())',
            'import random\nprint(random._os)',
        ]
        for snippet in advanced_py_attacks:
            r = c.post('/api/code-tasks/run_code/', {'code': snippet, 'language': 'python'}, format='json')
            self.assertEqual(r.status_code, 400, f'Must block Python escape: {snippet}')

        # Legitimate school Python still works cleanly!
        r_ok = c.post('/api/code-tasks/run_code/', {'code': 'import math\nprint(int(math.sqrt(81)))', 'language': 'python'}, format='json')
        self.assertEqual(r_ok.status_code, 200)
        self.assertTrue(r_ok.data['passed'])
        self.assertEqual(r_ok.data['output'].strip(), '9')

        advanced_js_attacks = [
            'const r = require; console.log(r("fs"));',
            'console.log(process["env"]);',
            'console.log(global);',
            'fetch("http://127.0.0.1");',
        ]
        for snippet in advanced_js_attacks:
            r = c.post('/api/code-tasks/run_code/', {'code': snippet, 'language': 'javascript'}, format='json')
            self.assertEqual(r.status_code, 400, f'Must block JS escape: {snippet}')

        # run_project must NOT skip AST check when filename is omitted, and must block Windows C:/ traversal
        r_anon_file = c.post('/api/code-tasks/run_project/', {'files': [{'content': 'import posix\nprint(1)'}]}, format='json')
        self.assertEqual(r_anon_file.status_code, 400)
        r_win_trav = c.post('/api/code-tasks/run_project/', {'files': [{'path': 'C:/evil.py', 'content': 'print(1)'}]}, format='json')
        self.assertEqual(r_win_trav.status_code, 400)

    def test_media_achievements_protected_and_word_meta_and_zip_bomb_blocked(self):
        import zipfile
        from apps.portfolio.models import Achievement
        from apps.word.views import sanitize_html
        from apps.common.safety import validate_ooxml_zip

        # 1. Achievements media is strictly behind auth & portfolio visibility
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(MEDIA_ROOT=tmp):
                ach = Achievement.objects.create(
                    student=self.student_a,
                    title='Олимпиада 1 место',
                    file=SimpleUploadedFile('diploma.png', _make_png_bytes(), content_type='image/png'),
                )
                url = f'/media/{ach.file.name}'
                self.assertEqual(APIClient().get(url).status_code, 404)

                c_b = APIClient()
                c_b.force_login(self.student_b)
                self.assertEqual(c_b.get(url).status_code, 404)

                c_a = APIClient()
                c_a.force_login(self.student_a)
                r_a = c_a.get(url)
                self.assertEqual(r_a.status_code, 200)
                r_a.close()

        # 2. Word data-word-meta strips CSS injection values
        dirty = '<div class="word-meta" data-word-meta="{&quot;ps&quot;:&quot;A4&quot;,&quot;pbc&quot;:&quot;#111; } body{background:url(x)}&quot;}"></div><p>OK</p>'
        cleaned = sanitize_html(dirty)
        self.assertNotIn('background:url', cleaned)
        self.assertIn('&quot;ps&quot;: &quot;A4&quot;', cleaned)

        # 3. OOXML zip bomb protection rejects extreme compression ratio
        bomb_buf = io.BytesIO()
        with zipfile.ZipFile(bomb_buf, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('word/document.xml', b'0' * (5 * 1024 * 1024))
        bomb_buf.seek(0)
        with self.assertRaises(ValueError):
            validate_ooxml_zip(bomb_buf)
