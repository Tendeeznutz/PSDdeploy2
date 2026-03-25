"""
Simple audit logging for security-sensitive coordinator actions.
Logs to a dedicated 'audit' logger which can be directed to a separate file.
"""

import logging

audit_logger = logging.getLogger("audit")


def log_admin_action(request, action: str, target_type: str, target_id: str, details: str = ""):
    """
    Log a coordinator/admin action for audit trail.

    Args:
        request: The DRF request object (for extracting user info)
        action: What was done (e.g., "password_reset", "account_delete", "account_deactivate")
        target_type: Type of target (e.g., "customer", "technician")
        target_id: ID of the affected entity
        details: Additional context
    """
    actor_id = "unknown"
    actor_role = "unknown"
    if hasattr(request, "auth") and request.auth:
        payload = getattr(request.auth, "payload", {})
        actor_id = payload.get("user_id", "unknown")
        actor_role = payload.get("role", "unknown")

    audit_logger.info(
        "AUDIT | action=%s | actor_id=%s | actor_role=%s | target_type=%s | target_id=%s | ip=%s | details=%s",
        action,
        actor_id,
        actor_role,
        target_type,
        target_id,
        _get_client_ip(request),
        details,
    )


def _get_client_ip(request):
    """Extract client IP, accounting for proxies."""
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")
