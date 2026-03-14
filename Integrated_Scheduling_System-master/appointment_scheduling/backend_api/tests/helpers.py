"""
Shared test authentication helpers.

Generates JWT tokens directly (bypassing login endpoints) for use in tests.
Works with CookieJWTAuthentication's Authorization header fallback.
"""

from rest_framework_simplejwt.tokens import RefreshToken


def get_token_for_user(user, role):
    """Generate a JWT access token string for the given user and role."""
    refresh = RefreshToken()
    refresh["user_id"] = str(user.id)
    refresh["role"] = role
    return str(refresh.access_token)


def auth_client_as(client, user, role):
    """Authenticate an APIClient with a JWT for the given user/role."""
    token = get_token_for_user(user, role)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
