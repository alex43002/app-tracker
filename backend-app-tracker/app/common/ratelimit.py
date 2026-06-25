"""Shared rate limiter (SEC-3).

Keyed by client address. Limits are configurable via ``Settings.auth_rate_limit``
so they can be tuned per environment (and relaxed in tests).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
