"""Regression tests against a disposable running PostgreSQL-backed AlshaFacturas.
Run only against a test instance. Requires TEST_SUPERADMIN_EMAIL and TEST_SUPERADMIN_PASSWORD.
"""
import concurrent.futures
import http.cookiejar
import json
import os
import unittest
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('TEST_API_URL', 'http://127.0.0.1:8080/api')
PASSWORD = 'AlshaTestUser2026'


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, path, method='GET', body=None, csrf=True):
        headers = {'Accept': 'application/json'}
        if method != 'GET' and csrf:
            status, token = self.request('/auth/csrf')
            assert status == 200, token
            headers[token['headerName']] = token['token']
        if body is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
        try:
            res = self.opener.open(req, timeout=20)
        except urllib.error.HTTPError as e:
            res = e
        raw = res.read()
        return res.code, json.loads(raw) if raw else None

    def ok(self, path, method='GET', body=None):
        status, data = self.request(path, method, body)
        assert status in (200, 201, 204), (path, status, data)
        return data

    def login(self, ruc, email):
        return self.ok('/auth/login', 'POST', {'ruc': ruc, 'correo': email, 'password': PASSWORD})


class ApiRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.platform = Client()
        cls.platform.ok('/auth/admin/login', 'POST', {'correo': os.environ['TEST_SUPERADMIN_EMAIL'], 'password': os.environ['TEST_SUPERADMIN_PASSWORD']})
        cls.a_company, cls.a_email, cls.a = cls.company('Empresa A')
        cls.b_company, cls.b_email, cls.b = cls.company('Empresa B')
        cls.vendor_email = str(uuid.uuid4()) + '@test.local'
        cls.vendor_user = cls.a.ok('/usuarios', 'POST', {'nombre': 'Vendedor', 'correo': cls.vendor_email, 'password': PASSWORD, 'rol': 'VENDEDOR'})
        cls.vendor = Client()
        cls.vendor.login(cls.a_company['ruc'], cls.vendor_email)

    @classmethod
    def company(cls, name):
        ruc = '20' + str(uuid.uuid4().int)[:9]
        email = str(uuid.uuid4()) + '@test.local'
        empresa = cls.platform.ok('/empresas/alta', 'POST', {'ruc': ruc, 'razonSocial': name, 'direccion': 'Dirección de prueba', 'administradorNombre': 'Administrador', 'administradorCorreo': email, 'administradorPassword': PASSWORD})
        client = Client()
        client.login(ruc, email)
        return empresa, email, client

    def product(self, stock=0, client=None, price=11.80):
        client = client or self.a
        p = client.ok('/productos', 'POST', {'sku': 'P-' + uuid.uuid4().hex[:10], 'nombre': 'Producto de prueba', 'precio': price, 'minimo': 2, 'activo': True})
        if stock:
            client.ok('/inventario/ajustes', 'POST', {'productoId': p['id'], 'cantidad': stock, 'motivo': 'Existencias iniciales de prueba'})
        return p

    def sale(self, product, quantity=1, **kwargs):
        return {'idempotencia': str(uuid.uuid4()), 'tipo': 'TICKET', 'metodoPago': 'EFECTIVO', 'lineas': [{'productoId': product['id'], 'cantidad': quantity}], **kwargs}

    def stock(self, product, client=None):
        return next(p['stock'] for p in (client or self.a).ok('/productos') if p['id'] == product['id'])

    def test_anonymous_csrf_and_login(self):
        client = Client()
        self.assertEqual(client.request('/productos')[0], 401)
        self.assertEqual(client.request('/auth/login', 'POST', {}, csrf=False)[0], 403)
        self.assertEqual(client.request('/auth/login', 'POST', {'ruc': self.a_company['ruc'], 'correo': self.a_email, 'password': 'incorrecta'})[0], 401)
        client.login(self.a_company['ruc'], self.a_email)
        self.assertEqual(client.ok('/auth/me')['rol'], 'ADMIN')
        client.ok('/auth/logout', 'POST')
        self.assertEqual(client.request('/auth/me')[0], 401)

    def test_tenant_isolation(self):
        p = self.product(5)
        self.assertNotIn(p['id'], [x['id'] for x in self.b.ok('/productos')])
        self.assertEqual(self.b.request('/ventas', 'POST', self.sale(p))[0], 404)
        self.assertEqual(self.b.request('/productos/' + str(p['id']), 'PUT', {'sku': p['sku'], 'nombre': 'Intrusión', 'precio': 1, 'minimo': 0, 'activo': True})[0], 404)
        sale = self.a.ok('/ventas', 'POST', self.sale(p))
        self.assertEqual(self.b.request('/ventas/' + str(sale['id']))[0], 404)
        self.assertEqual(self.b.request('/ventas/' + str(sale['id']) + '/anular', 'POST', {'motivo': 'intrusión'})[0], 404)
        self.assertEqual(self.stock(p), 4)

    def test_roles_and_escalation(self):
        self.assertEqual(self.a.request('/empresas')[0], 403)
        self.assertEqual(self.vendor.request('/usuarios')[0], 403)
        self.assertEqual(self.vendor.request('/compras')[0], 403)
        self.assertEqual(self.vendor.request('/inventario')[0], 403)
        self.assertEqual(self.platform.request('/productos')[0], 403)
        status, _ = self.a.request('/usuarios', 'POST', {'nombre': 'Intruso', 'correo': 'bad@test.local', 'password': PASSWORD, 'rol': 'SUPERADMIN'})
        self.assertEqual(status, 403)
        self.assertEqual(self.vendor.request('/productos', 'POST', {'sku': 'BAD', 'nombre': 'No permitido', 'precio': 1, 'minimo': 1, 'activo': True})[0], 403)
        p = self.product(2)
        self.assertEqual(self.vendor.request('/ventas', 'POST', self.sale(p))[0], 200)

    def test_sale_totals_stock_and_idempotency(self):
        p = self.product(10)
        payload = self.sale(p, 3)
        sale = self.a.ok('/ventas', 'POST', payload)
        retry = self.a.ok('/ventas', 'POST', payload)
        self.assertEqual(sale['id'], retry['id'])
        self.assertEqual(self.stock(p), 7)
        self.assertEqual(sale['total'], 35.40)
        self.assertEqual(sale['subtotal'], 30)
        self.assertEqual(sale['igv'], 5.40)
        self.assertEqual(sale['estado_fiscal'], 'NO_APLICA')
        self.assertTrue(sale['numero'].startswith('NV01-'))
        self.assertEqual(sale['lineas'][0]['precio'], 11.80)
        payload['lineas'][0]['cantidad'] = 2
        self.assertEqual(self.a.request('/ventas', 'POST', payload)[0], 409)
        self.assertEqual(self.stock(p), 7)

    def test_stock_and_atomic_rollback(self):
        p = self.product(2)
        q = self.product(0)
        payload = self.sale(p)
        payload['lineas'].append({'productoId': q['id'], 'cantidad': 1})
        before = len(self.a.ok('/ventas'))
        self.assertEqual(self.a.request('/ventas', 'POST', payload)[0], 400)
        self.assertEqual(self.stock(p), 2)
        self.assertEqual(len(self.a.ok('/ventas')), before)
        self.assertEqual(self.a.request('/inventario/ajustes', 'POST', {'productoId': p['id'], 'cantidad': -3, 'motivo': 'Prueba'})[0], 400)
        self.assertEqual(self.stock(p), 2)

    def test_concurrent_sales_cannot_oversell(self):
        p = self.product(1)
        clients = [Client(), Client()]
        for client in clients:
            client.login(self.a_company['ruc'], self.a_email)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda c: c.request('/ventas', 'POST', self.sale(p))[0], clients))
        self.assertEqual(sorted(results), [200, 400])
        self.assertEqual(self.stock(p), 0)

    def test_purchase_updates_stock_once(self):
        p = self.product()
        payload = {'idempotencia': str(uuid.uuid4()), 'proveedor': 'Proveedor de prueba', 'referencia': uuid.uuid4().hex, 'lineas': [{'productoId': p['id'], 'cantidad': 5, 'costo': 4.20}]}
        purchase = self.a.ok('/compras', 'POST', payload)
        self.assertEqual(purchase['total'], 21)
        self.assertEqual(self.a.ok('/compras', 'POST', payload)['id'], purchase['id'])
        self.assertEqual(self.stock(p), 5)
        changed = {**payload, 'referencia': 'different'}
        self.assertEqual(self.a.request('/compras', 'POST', changed)[0], 409)
        payload['idempotencia'] = str(uuid.uuid4())
        self.assertEqual(self.a.request('/compras', 'POST', payload)[0], 409)
        self.assertEqual(self.stock(p), 5)

    def test_cancellation_returns_stock_once(self):
        p = self.product(3)
        sale = self.a.ok('/ventas', 'POST', self.sale(p, 2))
        self.assertEqual(self.vendor.request('/ventas/' + str(sale['id']) + '/anular', 'POST', {'motivo': 'Prueba'})[0], 403)
        for _ in range(2):
            result = self.a.ok('/ventas/' + str(sale['id']) + '/anular', 'POST', {'motivo': 'Cliente desistió'})
            self.assertEqual(result['estado'], 'ANULADA')
        self.assertEqual(self.stock(p), 3)

    def test_fiscal_draft_requires_ruc_and_is_never_accepted(self):
        p = self.product(2)
        self.assertEqual(self.a.request('/ventas', 'POST', self.sale(p, tipo='FACTURA'))[0], 400)
        c = self.a.ok('/clientes', 'POST', {'documento': '20' + str(uuid.uuid4().int)[:9], 'nombre': 'Cliente RUC', 'correo': '', 'direccion': ''})
        sale = self.a.ok('/ventas', 'POST', self.sale(p, tipo='FACTURA', clienteId=c['id']))
        self.assertEqual(sale['estado_fiscal'], 'PENDIENTE_CONFIGURACION')
        self.assertEqual(self.stock(p), 1)
        foreign = self.b.ok('/clientes', 'POST', {'documento': '20' + str(uuid.uuid4().int)[:9], 'nombre': 'Cliente ajeno'})
        self.assertEqual(self.a.request('/ventas', 'POST', self.sale(p, clienteId=foreign['id']))[0], 404)

    def test_suspension_revokes_existing_session(self):
        company, email, client = self.company('Empresa suspendida')
        self.platform.ok('/empresas/' + str(company['id']) + '/estado', 'PATCH', {'estado': 'SUSPENDIDA'})
        self.assertEqual(client.request('/productos')[0], 403)
        self.assertEqual(client.request('/auth/login', 'POST', {'ruc': company['ruc'], 'correo': email, 'password': PASSWORD})[0], 401)
        self.platform.ok('/empresas/' + str(company['id']) + '/estado', 'PATCH', {'estado': 'ACTIVA'})
        client.login(company['ruc'], email)
        self.assertEqual(client.request('/productos')[0], 200)

    def test_disabled_user_loses_existing_session(self):
        email = str(uuid.uuid4()) + '@test.local'
        u = self.a.ok('/usuarios', 'POST', {'nombre': 'Temporal', 'correo': email, 'password': PASSWORD, 'rol': 'VENDEDOR'})
        client = Client()
        client.login(self.a_company['ruc'], email)
        self.a.ok('/usuarios/' + str(u['id']) + '/activo', 'PATCH', {'activo': False})
        self.assertEqual(client.request('/productos')[0], 403)
        self.assertEqual(self.a.request('/usuarios/' + str(self.a.ok('/auth/me')['id']) + '/activo', 'PATCH', {'activo': False})[0], 409)

    def without_ruc(self, ruc=None, email=None):
        email = email or str(uuid.uuid4()) + '@test.local'
        payload = {'razonSocial': 'Negocio sin RUC', 'administradorNombre': 'Responsable', 'administradorCorreo': email, 'administradorPassword': PASSWORD}
        if ruc is not None:
            payload['ruc'] = ruc
        company = self.platform.ok('/empresas/alta', 'POST', payload)
        self.assertIsNone(company['ruc'])
        return company, email

    def test_no_ruc_registration_login_and_internal_sales(self):
        company, email = self.without_ruc()
        other, _ = self.without_ruc('')
        self.assertNotEqual(company['id'], other['id'])
        client = Client()
        user = client.ok('/auth/login', 'POST', {'correo': email.upper(), 'password': PASSWORD})
        self.assertEqual(user['empresaId'], company['id'])
        self.assertIsNone(client.ok('/empresas/mi-empresa')['ruc'])
        product = self.product(4, client=client)
        sale = client.ok('/ventas', 'POST', self.sale(product))
        self.assertEqual(sale['estado_fiscal'], 'NO_APLICA')
        self.assertIsNone(sale['ruc'])
        self.assertEqual(sale['igv'], 0)
        self.assertEqual(sale['subtotal'], sale['total'])
        self.assertEqual(self.stock(product, client), 3)
        self.assertEqual(client.request('/ventas', 'POST', self.sale(product, tipo='BOLETA'))[0], 400)
        self.assertEqual(client.request('/ventas', 'POST', self.sale(product, tipo='FACTURA'))[0], 400)
        self.assertEqual(self.stock(product, client), 3)
        self.assertFalse(client.ok('/sunat/configuracion')['configurado'])
        self.assertEqual(client.request('/sunat/ventas/' + str(sale['id']) + '/emitir', 'POST')[0], 412)

    def test_shared_email_requires_business_code_without_creating_session(self):
        email = str(uuid.uuid4()) + '@test.local'
        first, _ = self.without_ruc(email=email)
        second, _ = self.without_ruc(email=email)
        client = Client()
        self.assertEqual(client.request('/auth/login', 'POST', {'correo': email, 'password': 'wrong'})[0], 401)
        self.assertEqual(client.request('/auth/login', 'POST', {'correo': email, 'password': PASSWORD})[0], 409)
        self.assertEqual(client.request('/auth/me')[0], 401)
        user = client.ok('/auth/login', 'POST', {'empresaId': first['id'], 'correo': email, 'password': PASSWORD})
        self.assertEqual(user['empresaId'], first['id'])
        product = self.product(1, client=client)
        another = Client()
        user = another.ok('/auth/login', 'POST', {'empresaId': second['id'], 'correo': email, 'password': PASSWORD})
        self.assertEqual(user['empresaId'], second['id'])
        self.assertNotIn(product['id'], [p['id'] for p in another.ok('/productos')])

    def test_sunat_configuration_and_permissions(self):
        config = self.a.ok('/sunat/configuracion')
        self.assertFalse(config['configurado'])
        self.assertNotIn('password', str(config).lower())
        self.assertEqual(self.a.ok('/sunat/comprobantes'), [])
        self.assertEqual(self.a.request('/sunat/ventas/1/emitir', 'POST')[0], 412)
        self.assertEqual(self.vendor.request('/sunat/ventas/1/emitir', 'POST')[0], 403)
        self.assertEqual(self.b.request('/sunat/comprobantes/999999/xml')[0], 404)

    def test_validation_and_duplicate_products(self):
        p = self.product()
        self.assertEqual(self.a.request('/productos', 'POST', {'sku': p['sku'], 'nombre': 'Duplicado', 'precio': 1, 'minimo': 0, 'activo': True})[0], 409)
        self.assertEqual(self.a.request('/productos', 'POST', {'sku': 'X', 'nombre': 'Inválido', 'precio': -1, 'minimo': 0, 'activo': True})[0], 400)
        self.assertEqual(self.a.request('/ventas', 'POST', self.sale(p, 0))[0], 400)
        self.assertEqual(self.a.request('/usuarios', 'POST', {'nombre': 'X', 'correo': 'x@test.local', 'password': '123', 'rol': 'ADMIN'})[0], 400)
        self.assertEqual(self.a.request('/usuarios', 'POST', {'nombre': 'X', 'correo': 'unicode@test.local', 'password': '界' * 30, 'rol': 'ADMIN'})[0], 400)
        self.assertEqual(self.platform.request('/empresas/' + str(self.a_company['id']) + '/estado', 'PATCH', {'estado': 'INVALIDO'})[0], 400)


if __name__ == '__main__':
    unittest.main(verbosity=2)
