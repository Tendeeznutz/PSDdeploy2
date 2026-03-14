"""
Cookie-based token refresh and logout endpoints.

These replace the default SimpleJWT TokenRefreshView so that tokens
are read from / written to HTTP-only cookies instead of the request body.
"""

import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken

from ..utils.jwt_cookies import (
    REFRESH_COOKIE,
    set_jwt_cookies,
    clear_jwt_cookies,
)

logger = logging.getLogger(__name__)


class CookieTokenRefreshView(APIView):
    """
    Read the refresh token from the HTTP-only cookie, rotate it,
    and set the new access + refresh cookies on the response.

    Also accepts refresh token in the request body for backwards
    compatibility with clients that haven't migrated yet.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE) or request.data.get(
            "refresh"
        )
        if not raw_refresh:
            return Response(
                {"detail": "Refresh token not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_token = RefreshToken(raw_refresh)
            # Rotate: blacklist old, issue new pair
            new_access = str(old_token.access_token)

            # If rotation is enabled in settings, issue a new refresh too
            old_token.blacklist()
            new_refresh_token = RefreshToken()
            # Copy claims from old token
            for claim in ("user_id", "role"):
                if claim in old_token:
                    new_refresh_token[claim] = old_token[claim]
            new_refresh = str(new_refresh_token)
            new_access = str(new_refresh_token.access_token)

            response = Response(
                {"detail": "Token refreshed."},
                status=status.HTTP_200_OK,
            )
            set_jwt_cookies(response, new_access, new_refresh)
            return response

        except (TokenError, InvalidToken) as e:
            logger.warning("Token refresh failed: %s", e)
            response = Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_jwt_cookies(response)
            return response


class CookieLogoutView(APIView):
    """
    Blacklist the refresh token and clear both JWT cookies.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE) or request.data.get(
            "refresh"
        )
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
            except (TokenError, InvalidToken):
                pass  # Token already expired/blacklisted — still clear cookies

        response = Response(
            {"detail": "Logged out."}, status=status.HTTP_200_OK
        )
        clear_jwt_cookies(response)
        return response
