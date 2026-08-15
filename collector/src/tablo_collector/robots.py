from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from .pipeline import FetchJson

ROBOTS_TTL_SECONDS = 24 * 60 * 60

PERMISSION_OVERRIDE_HOSTS: frozenset[str] = frozenset(
    {
        "price.tlyn.ir",
        "pwa.hamrahgold.com",
        "api.talasea.ir",
    }
)

log = logging.getLogger("mazane.collector.robots")


class RobotsDisallowed(Exception):
    pass


class RobotsGate:

    def __init__(
        self,
        client: Any,
        *,
        user_agent: str,
        ttl_seconds: float = ROBOTS_TTL_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._user_agent = user_agent
        self._ttl = ttl_seconds
        self._clock = clock
        self._cache: dict[str, tuple[RobotFileParser | None, float]] = {}

    async def allows(self, url: str) -> bool:
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https"):
            return True
        if parts.hostname in PERMISSION_OVERRIDE_HOSTS:
            return True
        parser = await self._parser_for(f"{parts.scheme}://{parts.netloc}")
        if parser is None or parser.can_fetch(self._user_agent, url):
            return True
        log.warning(
            "host's robots.txt disallows path %s for %s — this fetch is rejected "
            "(staleness for that source, not error)",
            url,
            self._user_agent,
        )
        return False

    async def _parser_for(self, origin: str) -> RobotFileParser | None:
        cached = self._cache.get(origin)
        now = self._clock()
        if cached is not None and now - cached[1] < self._ttl:
            return cached[0]
        parser = await self._fetch_parser(f"{origin}/robots.txt")
        self._cache[origin] = (parser, now)
        return parser

    async def _fetch_parser(self, robots_url: str) -> RobotFileParser | None:
        try:
            response = await self._client.get(robots_url)
        except Exception:
            log.warning(
                "reading %s failed — fail-open until next TTL expiry",
                robots_url,
                exc_info=True,
            )
            return None
        status = int(response.status_code)
        if 200 <= status < 300:
            parser = RobotFileParser()
            parser.parse(str(response.text).splitlines())
            return parser
        if 400 <= status < 500:
            return None
        log.warning(
            "response %s for %s — fail-open until next TTL expiry (module docstring)",
            status,
            robots_url,
        )
        return None


def robots_checked_fetch(gate: RobotsGate, fetch_json: FetchJson) -> FetchJson:

    async def fetch(url: str) -> Any:
        if not await gate.allows(url):
            raise RobotsDisallowed(url)
        return await fetch_json(url)

    return fetch
