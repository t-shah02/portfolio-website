import threading
from collections import OrderedDict
from collections.abc import Hashable
from typing import Generic, TypeVar

V = TypeVar("V")

_MISSING = object()


class TtlCache(Generic[V]):
    """Thread-safe map whose entries expire. Evicts the oldest entry once full."""

    def __init__(self, max_entries: int = 2048) -> None:
        self._max = max_entries
        self._lock = threading.Lock()
        self._items: OrderedDict[Hashable, tuple[float, V]] = OrderedDict()

    def get(self, key: Hashable, now: float) -> tuple[bool, V | None]:
        with self._lock:
            item = self._items.get(key, _MISSING)
            if item is _MISSING:
                return False, None
            expires, value = item  # type: ignore[misc]
            if expires <= now:
                del self._items[key]
                return False, None
            return True, value

    def put(self, key: Hashable, value: V, ttl: float, now: float) -> None:
        with self._lock:
            self._items.pop(key, None)
            self._items[key] = (now + ttl, value)
            while len(self._items) > self._max:
                self._items.popitem(last=False)

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)
