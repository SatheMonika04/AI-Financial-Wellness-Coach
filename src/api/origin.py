import ipaddress
import re
from collections.abc import Iterable
from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp


_HOST_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
_LOCAL_DEV_ORIGIN = re.compile(r"^https?://(?:localhost|127\.0\.0\.1|\[::1\])(?::[1-9][0-9]{0,4})?$")
_STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def normalize_origin(value: str) -> str | None:
    if not value or value != value.strip() or "\\" in value:
        return None
    if any(ord(character) < 0x21 or ord(character) == 0x7F for character in value):
        return None

    try:
        parsed = urlsplit(value)
        scheme = parsed.scheme.lower()
        if (
            scheme not in {"http", "https"}
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or "?" in value
            or "#" in value
            or parsed.netloc.endswith(":")
        ):
            return None

        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return None

    if not hostname or "%" in hostname:
        return None

    try:
        address = ipaddress.ip_address(hostname)
        hostname = address.compressed.lower()
        is_ipv6 = address.version == 6
    except ValueError:
        try:
            hostname = hostname.encode("idna").decode("ascii").lower()
        except UnicodeError:
            return None
        labels = hostname.split(".")
        if len(hostname) > 253 or any(not _HOST_LABEL.fullmatch(label) for label in labels):
            return None
        is_ipv6 = False

    if port is not None and not 1 <= port <= 65535:
        return None
    if port == (80 if scheme == "http" else 443):
        port = None

    host = f"[{hostname}]" if is_ipv6 else hostname
    return f"{scheme}://{host}" + (f":{port}" if port is not None else "")


def normalize_origins(origins: Iterable[str]) -> list[str]:
    normalized: list[str] = []
    for origin in origins:
        candidate = normalize_origin(origin.strip())
        if candidate is None:
            raise ValueError("FRONTEND_ORIGINS must contain only valid HTTP(S) origins")
        if candidate not in normalized:
            normalized.append(candidate)
    return normalized


class AuthOriginMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        allowed_origins: Iterable[str],
        session_cookie: str,
        allow_localhost_origins: bool = False,
    ):
        super().__init__(app)
        self.allowed_origins = frozenset(allowed_origins)
        self.session_cookie = session_cookie
        self.allow_localhost_origins = allow_localhost_origins

    def _origin_is_allowed(self, origin: str | None) -> bool:
        return bool(
            origin
            and (
                origin in self.allowed_origins
                or (
                    self.allow_localhost_origins
                    and _LOCAL_DEV_ORIGIN.fullmatch(origin) is not None
                )
            )
        )

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if (
            request.url.path.startswith("/api/auth/")
            and request.method in _STATE_CHANGING_METHODS
        ):
            origin_headers = [
                value
                for name, value in request.scope["headers"]
                if name.lower() == b"origin"
            ]
            if len(origin_headers) > 1:
                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)

            if origin_headers:
                origin = normalize_origin(origin_headers[0].decode("latin-1"))
                if not self._origin_is_allowed(origin):
                    return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
            elif self.session_cookie in request.cookies:
                return JSONResponse(
                    {"detail": "Origin required for cookie-authenticated requests"},
                    status_code=403,
                )

        return await call_next(request)
