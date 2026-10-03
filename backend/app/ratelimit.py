"""Tiny in-memory sliding-window limiter for auth endpoints.

Per-process: good enough for a single instance. Behind several workers or a
proxy, move this to Redis and read the real client IP from X-Forwarded-For.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class SlidingWindow:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            retry = max(1, int(self.window - (now - q[0])))
            raise HTTPException(
                429, "Too many attempts. Try again shortly.", headers={"Retry-After": str(retry)}
            )
        q.append(now)

    def reset(self) -> None:
        self.hits.clear()


auth_limiter = SlidingWindow(limit=10, window_seconds=60)


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"
