"""
Custom JWT authentication that reads tokens from HTTP-only cookies.

Falls back to the standard Authorization header so that API clients
(tests, Postman, mobile apps) continue to work.
"""

from rest_framework_simplejwt.authentication import JWTStatelessUserAuthentication

from .utils.jwt_cookies import ACCESS_COOKIE


class CookieJWTAuthentication(JWTStatelessUserAuthentication):
    """
    Try the Authorization header first (parent class behaviour).
    If absent, look for the access token in an HTTP-only cookie.
    """

    def authenticate(self, request):
        # 1. Try the standard header
        result = super().authenticate(request)
        if result is not None:
            return result

        # 2. Fall back to cookie
        raw_token = request.COOKIES.get(ACCESS_COOKIE)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
