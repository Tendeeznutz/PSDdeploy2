"""
Utilities for setting and clearing JWT tokens as HTTP-only cookies.

Tokens are stored in HTTP-only, Secure cookies instead of being returned
in the response body.  This prevents XSS attacks from stealing JWTs.

For VPS deployment (same-origin frontend/backend), SameSite=Lax is used.
Secure=True is set in production since Apache handles SSL termination.
"""

from django.conf import settings

# Cookie names
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"

# How long (in seconds) each cookie lives — mirrors the JWT lifetimes
# defined in settings.SIMPLE_JWT.
_ACCESS_MAX_AGE = int(
    settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()
)
_REFRESH_MAX_AGE = int(
    settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()
)


def _is_secure() -> bool:
    """Use Secure cookies only when HTTPS is available."""
    return getattr(settings, "CSRF_COOKIE_SECURE", not settings.DEBUG)


def _cookie_kwargs(max_age: int) -> dict:
    """Base keyword arguments shared by set/delete helpers."""
    return {
        "max_age": max_age,
        "httponly": True,
        "secure": _is_secure(),
        "samesite": "Lax",
        "path": "/",
    }


def set_jwt_cookies(response, access: str, refresh: str):
    """Attach access & refresh JWTs as HTTP-only cookies on *response*."""
    response.set_cookie(
        ACCESS_COOKIE, access, **_cookie_kwargs(_ACCESS_MAX_AGE)
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh, **_cookie_kwargs(_REFRESH_MAX_AGE)
    )
    return response


def clear_jwt_cookies(response):
    """Delete both JWT cookies from the browser."""
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(
            name,
            path="/",
            samesite="Lax",
            secure=_is_secure(),
        )
    return response
