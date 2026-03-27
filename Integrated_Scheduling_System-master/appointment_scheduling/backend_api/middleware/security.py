"""
Security middleware for Content-Security-Policy and other headers.
"""


class ContentSecurityPolicyMiddleware:
    """
    Adds Content-Security-Policy header to all responses.
    This mitigates XSS by restricting which scripts, styles, and
    resources the browser is allowed to load.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        # Only add CSP to HTML responses (not API JSON responses)
        content_type = response.get("Content-Type", "")
        if "text/html" in content_type:
            response["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
        return response
