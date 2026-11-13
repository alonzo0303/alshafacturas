"""Rubro and subscription regressions against a disposable instance."""
import unittest,os,uuid,base64,concurrent.futures
from datetime import date,timedelta
import test_api as helpers
from test_api import Client,PASSWORD
class SubscriptionRegression(unittest.TestCase):
    company=classmethod(helpers.ApiRegression.company.__func__)
    payment=classmethod(helpers.ApiRegression.payment.__func__)
    @classmethod
    def setUpClass(cls):
        cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
    def new_rubro(self,rubro):
        email=uuid.uuid4().hex+'@test.local'
        e=self.platform.ok('/empresas/alta','POST',{'razonSocial':'Rubro '+uuid.uuid4().hex,'rubroNegocio':rubro,'administradorNombre':'Principal de rubro','administradorCorreo':email,'administradorPassword':PASSWORD})
        c=Client();c.ok('/auth/login','POST',{'empresaId':e['id'],'correo':email,'password':PASSWORD});return e,email,c
    def pay(self,e,desde,hasta):
        return self.platform.ok(f"/empresas/{e['id']}/pagos",'POST',{'plan':'INICIO','importe':35,'desde':str(desde),'hasta':str(hasta),'referencia':uuid.uuid4().hex,'confirmado':True})
    def test_company_rubro_auto_enables_seed_services_and_keeps_own_copy(self):
        e,email,c=self.new_rubro('Barbería')
        templates=c.ok('/catalogo-comun');self.assertGreaterEqual(len(templates),2);self.assertEqual({r['rubro'] for r in templates},{'Barbería'})
        copied=c.ok(f"/catalogo-comun/{templates[0]['id']}/incorporar",'POST',{'nombre':'Servicio propio conservado','precio':20,'minimo':0,'activo':True})
        own=c.ok('/servicios');self.assertIn(copied['id'],[r['id'] for r in own])
        updated=self.platform.ok(f"/empresas/{e['id']}",'PUT',{'razonSocial':e['razonSocial'],'direccion':'Nueva','rubroNegocio':'Spa'})
        self.assertEqual(updated['rubroNegocio'],'Spa');self.assertEqual({r['rubro'] for r in c.ok('/catalogo-comun')},{'Spa'});self.assertEqual(c.ok('/servicios'),own)
        self.assertEqual(c.request('/productos','POST',{'nombre':'Otro acceso','precio':20,'activo':True,'minimo':0,'catalogoId':templates[0]['id']})[0],404)
        self.assertEqual(c.request(f"/catalogo-comun/{templates[0]['id']}/incorporar",'POST',{'nombre':'Ajeno','precio':20,'activo':True,'minimo':0})[0],404)
    def test_local_override_inheritance_and_direct_image_scope(self):
        e,email,c=self.new_rubro('Barbería');first=c.ok('/catalogo-comun')[0]
        image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
        self.assertEqual(self.platform.raw(f"/catalogo-comun/{first['id']}/imagen",'PUT',image)[0],200)
        locales=self.platform.ok(f"/locales?empresaId={e['id']}",'POST',{'nombre':'Local Spa','rubroNegocio':'Spa'})
        main=locales[0];second=locales[-1]
        self.assertEqual(c.request('/locales','POST',{'nombre':'No permitido','rubroNegocio':'Restaurante'})[0],403)
        c.ok('/locales/seleccionar','POST',{'localId':second['id']});self.assertEqual({r['rubro'] for r in c.ok('/catalogo-comun')},{'Spa'})
        self.assertEqual(c.raw(f"/catalogo-comun/{first['id']}/imagen")[0],404)
        self.platform.ok(f"/locales/{second['id']}?empresaId={e['id']}",'PUT',{'nombre':'Hereda','rubroNegocio':''})
        self.assertEqual({r['rubro'] for r in c.ok('/catalogo-comun')},{'Barbería'})
        self.assertEqual(c.raw(f"/catalogo-comun/{first['id']}/imagen")[0],200)
    def test_rubro_validation_and_admin_only_assignment(self):
        e,email,c=self.new_rubro('Restaurante');own=c.ok('/empresas/mi-empresa')
        self.assertEqual(c.request(f"/empresas/{e['id']}",'PUT',{'razonSocial':'No','rubroNegocio':'Spa'})[0],403)
        self.assertEqual(self.platform.request(f"/empresas/{e['id']}",'PUT',{'razonSocial':e['razonSocial'],'rubroNegocio':'<script>'})[0],400)
        self.assertEqual(c.ok('/empresas/mi-empresa'),own);self.assertEqual(c.request('/rubros-negocio')[0],403)
    def test_future_one_day_payment_shows_price_dates_and_programmed_status(self):
        e,email,c=self.company('Plan programado',paid=False)
        today=date.fromisoformat(self.platform.ok(f"/empresas/{e['id']}/plan")['fechaActual'])
        tomorrow=today+timedelta(days=1);state=self.pay(e,tomorrow,tomorrow)
        self.assertEqual((state['plan'],state['estadoSuscripcion'],state['limiteEmpleados']),('INICIO','PROGRAMADO',2));self.assertFalse(state['vigente']);self.assertEqual(state['pagoReferencia']['importe'],35);self.assertEqual(state['pagoReferencia']['hasta'],str(tomorrow))
        self.assertEqual(c.request('/productos')[0],402)
        fresh=Client();status,body=fresh.request('/auth/login','POST',{'empresaId':e['id'],'correo':email,'password':PASSWORD});self.assertEqual(status,402);self.assertEqual(body['codigo'],'MEMBRESIA_PROGRAMADA')
    def test_expired_owner_session_and_login_block_then_renew_restore_without_data_loss(self):
        e,email,c=self.company('Vencimiento real',paid=False)
        p=c.ok('/productos','POST',{'nombre':'Se conserva','precio':10,'minimo':1,'activo':True})
        today=date.fromisoformat(self.platform.ok(f"/empresas/{e['id']}/plan")['fechaActual']);self.pay(e,today-timedelta(days=30),today-timedelta(days=1))
        status,body=c.request('/productos');self.assertEqual(status,402);self.assertEqual(body['codigo'],'MEMBRESIA_VENCIDA');self.assertIn('Tu membresía ha vencido.',body['mensaje']);self.assertEqual(c.request('/productos')[0],401)
        wrong=Client();status,body=wrong.request('/auth/login','POST',{'empresaId':e['id'],'correo':email,'password':'incorrecta'});self.assertEqual(status,401);self.assertNotIn('instruccionesPago',body)
        good=Client();self.assertEqual(good.request('/auth/login','POST',{'empresaId':e['id'],'correo':email,'password':PASSWORD})[0],402)
        state=self.pay(e,today,today+timedelta(days=30));self.assertEqual(state['estadoSuscripcion'],'ACTIVO');self.assertEqual(state['pagoActual']['importe'],35)
        restored=Client();restored.ok('/auth/login','POST',{'empresaId':e['id'],'correo':email,'password':PASSWORD});self.assertIn(p['id'],[r['id'] for r in restored.ok('/productos')])
    def test_daily_review_idempotency_notices_and_tenant_scope(self):
        e,email,c=self.company('Avisos de cobro',paid=False);other,_,b=self.company('Otro aviso')
        today=date.fromisoformat(self.platform.ok(f"/empresas/{e['id']}/plan")['fechaActual']);self.pay(e,today-timedelta(days=10),today+timedelta(days=5))
        self.assertEqual(c.request('/admin/suscripciones/revisar','POST',{})[0],403)
        def run(_):
            root=Client();root.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']});return root.ok('/admin/suscripciones/revisar','POST',{})
        with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(run,range(2)))
        avisos=c.ok('/notificaciones-suscripcion')['avisos'];self.assertEqual(len(avisos),1);self.assertEqual(avisos[0]['dias_restantes'],5)
        self.assertEqual(b.request(f"/notificaciones-suscripcion?empresaId={e['id']}")[0],403)
        self.assertEqual(self.platform.ok(f"/notificaciones-suscripcion?empresaId={e['id']}")['avisos'],avisos)
        self.pay(e,today+timedelta(days=6),today+timedelta(days=35));self.assertTrue(c.ok('/notificaciones-suscripcion')['avisos'][0]['resuelto'])
        self.assertGreaterEqual(self.platform.ok('/admin/suscripciones/resumen')['activos'],1)
    def test_payment_instructions_are_configurable_without_tenant_escalation(self):
        e,email,c=self.company('Opciones de pago')
        before=self.platform.ok('/admin/suscripciones/configuracion')['instruccionesPago'];new='Pago de prueba '+uuid.uuid4().hex
        try:
            self.assertEqual(c.request('/admin/suscripciones/configuracion','PUT',{'instruccionesPago':new})[0],403)
            self.platform.ok('/admin/suscripciones/configuracion','PUT',{'instruccionesPago':new});self.assertEqual(c.ok('/notificaciones-suscripcion')['instruccionesPago'],new)
        finally:self.platform.ok('/admin/suscripciones/configuracion','PUT',{'instruccionesPago':before})
    def test_manual_suspension_is_not_undone_by_renewal(self):
        e,email,c=self.company('Suspensión manual',paid=False);today=date.fromisoformat(self.platform.ok(f"/empresas/{e['id']}/plan")['fechaActual'])
        self.platform.ok(f"/empresas/{e['id']}/estado",'PATCH',{'estado':'SUSPENDIDA'});self.pay(e,today,today+timedelta(days=30))
        self.assertEqual(next(r for r in self.platform.ok('/empresas') if r['id']==e['id'])['estado'],'SUSPENDIDA')
        fresh=Client();self.assertEqual(fresh.request('/auth/login','POST',{'empresaId':e['id'],'correo':email,'password':PASSWORD})[0],401)
if __name__=='__main__':unittest.main(verbosity=2)
