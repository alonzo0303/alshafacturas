"""Wait for a usable admin session, not just an open HTTP port (disposable CI only)."""
import os
import time
import urllib.request
from test_api import Client

for attempt in range(30):
    try:
        client = Client()
        status, _ = client.request('/auth/admin/login', 'POST', {
            'correo': os.environ['TEST_SUPERADMIN_EMAIL'],
            'password': os.environ['TEST_SUPERADMIN_PASSWORD'],
        })
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(os.environ.get('TEST_WEB_URL', 'http://127.0.0.1:5173'), timeout=2) as response:
            if status == 200 and response.status == 200:
                print('API, administrador e interfaz disponibles')
                break
    except (OSError, AssertionError, ValueError):
        pass
    time.sleep(2)
else:
    raise SystemExit('La aplicación no completó el inicio y el acceso administrativo')
