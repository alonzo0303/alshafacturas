"""Cliente HTTP con conexión persistente, cookies y CSRF por usuario virtual."""
import http.client
from http.cookies import SimpleCookie
import json
import ssl
from urllib.parse import urlsplit

class Fallo(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__('HTTP ' + str(status) if status else 'Error de conexión')

class Cliente:
    def __init__(self, url):
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path not in ('', '/'):
            raise ValueError('Usa el origen completo sin ruta, usuario ni parámetros')
        self.url = url.rstrip('/')
        self.parts = parts
        self.cookies = SimpleCookie()
        self.connection = None
        self.peticiones = 0

    def close(self):
        if self.connection:
            self.connection.close()
            self.connection = None

    def request(self, path, method='GET', data=None):
        headers = {'Accept': 'application/json'}
        if method not in ('GET', 'HEAD'):
            token = self.request('/auth/csrf')
            headers[token['headerName']] = token['token']
        if self.cookies:
            headers['Cookie'] = '; '.join(k + '=' + v.value for k, v in self.cookies.items())
        body = None if data is None else json.dumps(data).encode()
        if body is not None:
            headers['Content-Type'] = 'application/json'
        if self.connection is None:
            if self.parts.scheme == 'https':
                self.connection = http.client.HTTPSConnection(self.parts.hostname, self.parts.port, timeout=15, context=ssl.create_default_context())
            else:
                self.connection = http.client.HTTPConnection(self.parts.hostname, self.parts.port, timeout=15)
        self.peticiones += 1
        try:
            self.connection.request(method, '/api' + path, body, headers)
            response = self.connection.getresponse()
            raw = response.read()
            for name, value in response.getheaders():
                if name.lower() == 'set-cookie':
                    self.cookies.load(value)
            if not 200 <= response.status < 300:
                raise Fallo(response.status)
            return json.loads(raw) if raw else None
        except (OSError, http.client.HTTPException, ValueError) as error:
            self.close()
            raise Fallo(0) from error

    def verificar_pruebas(self):
        state = self.request('/entorno')
        if state != {'entorno': 'PRUEBAS', 'cargaHabilitada': True}:
            raise ValueError('Cancelado: el servidor debe ser PRUEBAS con carga habilitada. No se enviaron credenciales ni escrituras')

    def login(self, actor):
        result = self.request('/auth/login', 'POST', {'empresaId': actor['empresaId'], 'correo': actor['correo'], 'password': actor['password']})
        if result['empresaId'] != actor['empresaId']:
            raise ValueError('La sesión no corresponde al negocio ficticio')
        return result
