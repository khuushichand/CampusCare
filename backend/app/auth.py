"""
Demo Authentication & Authorization Dependencies
================================================
Prototype authorization mechanism using demo HTTP headers.

SECURITY & ARCHITECTURAL LIMITATION NOTICE:
------------------------------------------
This implementation relies on client-supplied headers (X-User-Role and X-Student-Id)
for demo and local development verification only. In a production environment,
all identity and role assertions MUST be derived from cryptographically signed
and verified tokens (e.g., JWT / OAuth2 Bearer tokens issued by an identity provider),
NEVER from untrusted client request headers.
"""

from typing import Optional
from fastapi import HTTPException, Header


def require_admin(
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> str:
    """
    Enforces admin role for administrative endpoints.
    - Missing role/header -> HTTP 401 Unauthorized
    - Non-admin role (e.g., 'student') -> HTTP 403 Forbidden
    """
    if not x_user_role or not x_user_role.strip():
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Authentication required. Please provide a valid role via the X-User-Role header.",
                "demo_note": "This demo uses the X-User-Role header for authorization simulation. Production requires JWT/OAuth2."
            },
        )

    role = x_user_role.strip().lower()

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden. Administrator privileges are required to perform this action.",
        )

    return role

