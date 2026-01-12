import time
from typing import Optional

_deny_until: float = 0.0
_reason: str = ""

def deny_for(seconds: int, reason: str) -> None:
    global _deny_until, _reason
    _deny_until = time.time() + seconds
    _reason = reason

def is_denied() -> bool:
    return time.time() < _deny_until

def remaining_seconds() -> int:
    return max(0, int(_deny_until - time.time()))

def reason() -> str:
    return _reason or "Rate limit"
