from __future__ import annotations

import time
from threading import Lock

_lock = Lock()
_deny_until = 0.0
_reason = ""


def deny_for(seconds: int, reason: str) -> None:
    global _deny_until, _reason
    with _lock:
        _deny_until = time.time() + seconds
        _reason = reason


def is_denied() -> bool:
    with _lock:
        return time.time() < _deny_until


def remaining_seconds() -> int:
    with _lock:
        return max(0, int(_deny_until - time.time()))


def reason() -> str:
    with _lock:
        return _reason or "Rate limit"
