import ipaddress
from collections.abc import Iterator, Mapping

_HEADERS = ("CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP")


def client_ip(headers: Mapping[str, str], peer: str | None) -> str | None:
    """The first globally routable address among proxy headers and the socket peer.

    Headers are client-controlled when nobody strips them, so the worst a forged
    value can do is show the visitor someone else's weather.
    """
    for candidate in _candidates(headers, peer):
        address = _global_address(candidate)
        if address is not None:
            return address
    return None


def _candidates(headers: Mapping[str, str], peer: str | None) -> Iterator[str]:
    for name in _HEADERS:
        value = headers.get(name)
        if value:
            yield from value.split(",")
    if peer:
        yield peer


def _global_address(raw: str) -> str | None:
    try:
        address = ipaddress.ip_address(raw.strip())
    except ValueError:
        return None
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return str(address) if address.is_global else None
