import threading
import time
from collections import OrderedDict


class TTLCache:
    def __init__(self, ttl=900, max_items=5000):
        self.ttl = ttl
        self.max_items = max_items
        self._data = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return None
            expires, value = item
            if expires < time.time():
                del self._data[key]
                return None
            return value

    def set(self, key, value):
        with self._lock:
            self._data[key] = (time.time() + self.ttl, value)
            self._data.move_to_end(
                key
            )  # moving to the end to maintain the order (based on time)
            while len(self._data) > self.max_items:
                self._data.popitem(last=False)
