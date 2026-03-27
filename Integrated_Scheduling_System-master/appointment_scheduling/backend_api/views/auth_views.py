"""
Cookie-based token refresh and logout views.

These replace the default simplejwt TokenRefreshView to read the refresh
token from an HTTP-only cookie and set the new tokens back as cookies.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..utils.jwt_cookies import REFRESH_COOKIE, set_jwt_cookies, clear_jwt_cookies


class CookieTokenRefreshView(APIView):
    """
    Read the refresh token from the HTTP-only cookie, rotate it,
    and set the new access + refresh tokens as cookies.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE)
        if not raw_refresh:
            return Response(
                {"detail": "Refresh token not found in cookies."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_refresh = RefreshToken(raw_refresh)
            # Blacklist the old token (requires token_blacklist app)
            old_refresh.blacklist()
        except TokenError:
            return Response(
                {"detail": "Token is invalid or expired."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Create a new refresh token preserving custom claims
        new_refresh = RefreshToken()
        # Copy custom claims from old token to the new refresh token
        for claim in ("user_id", "role"):
            value = old_refresh.payload.get(claim)
            if value is not None:
                new_refresh[claim] = value

        # Generate access token and explicitly copy custom claims onto it,
        # because simplejwt does NOT auto-propagate claims set on RefreshToken
        # to the lazily-generated access token.
        access_token = new_refresh.access_token
        for claim in ("user_id", "role"):
            value = old_refresh.payload.get(claim)
            if value is not None:
                access_token[claim] = value

        response = Response({"detail": "Token refreshed."}, status=status.HTTP_200_OK)
        set_jwt_cookies(response, str(access_token), str(new_refresh))
        return response


class CookieLogoutView(APIView):
    """
    Blacklist the current refresh token and clear JWT cookies.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE)
        logged_out = False
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
                logged_out = True
            except TokenError:
                logged_out = False

        response = Response(status=status.HTTP_200_OK)
        clear_jwt_cookies(response)
        if logged_out:
            response.data = {"detail": "Successfully logged out."}
        else:
            response.data = {"detail": "No active session found."}
        return response
