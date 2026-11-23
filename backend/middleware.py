"""Production security headers middleware for EduPlatform."""


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response.setdefault(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        )
        response.setdefault('X-Permitted-Cross-Domain-Policies', 'none')

        path = request.path or ''
        private_media_prefixes = (
            '/media/payment_receipts/',
            '/media/uploads/',
            '/media/achievements/',
        )
        if path.startswith(private_media_prefixes):
            response.setdefault('Cross-Origin-Resource-Policy', 'same-origin')
        elif path.startswith('/media/'):
            response.setdefault('Cross-Origin-Resource-Policy', 'cross-origin')
        else:
            response.setdefault('Cross-Origin-Resource-Policy', 'same-site')

        # Never cache authentication or token responses on shared school computers/proxies
        if path.startswith('/api/auth/'):
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response['Pragma'] = 'no-cache'

        return response
