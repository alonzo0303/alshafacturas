"""Profiles, real workflows and modal deliveries against a disposable test instance."""
import os,unittest,uuid,copy,concurrent.futures
import test_api as helpers
from test_api import Client,PASSWORD

class ExperienciaRegression(unittest.TestCase):
    company=classmethod(helpers.ApiRegression.company.__func__)
    payment=classmethod(helpers.ApiRegression.payment.__func__)
    product=helpers.ApiRegression.product
    sale=helpers.ApiRegression.sale
    stock=helpers.ApiRegression.stock
    @classmethod
    def setUpClass(cls):
        cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
        cls.a_company,cls.a_email,cls.a=cls.company('Experiencia A')
        cls.b_company,cls.b_email,cls.b=cls.company('Experiencia B')
        cls.bases={r['codigo']:r for r in cls.platform.ok('/experiencia/plantillas')}
    def assign(self,company,code,local=None,custom=False):
        template=code if isinstance(code,dict) else self.bases[code]
        q=f"?empresaId={company['id']}"+(f'&localId={local}' if local else '')
        self.platform.ok('/experiencia/configuracion'+q,'PUT',{'modo':'PERSONALIZADO' if custom else 'ESPECIFICO','plantillaId':template['id']})
    def template(self,company):
        return {'idempotencia':str(uuid.uuid4()),'empresaPropietariaId':company['id'],'codigo':'P_'+uuid.uuid4().hex[:12].upper(),'nombre':'Mini park','rubro':'Entretenimiento','definicion':{'metricas':[{'clave':'atenciones','titulo':'Atenciones completadas','operacion':'ACTIVIDADES_COMPLETADAS','flujoCodigo':'JUEGO','clase':None,'meta':10}], 'flujos':[{'codigo':'JUEGO','nombre':'Atención juego','clase':'ATENCION','etapas':[{'codigo':'ESPERA','nombre':'En espera'},{'codigo':'EN_CURSO','nombre':'En juego'},{'codigo':'FINALIZADO','nombre':'Finalizado'}]}]}}
    def rule(self,company,**patch):
        body={'idempotencia':str(uuid.uuid4()),'empresaId':company['id'],'nombre':'Aviso prueba','titulo':'Hola {{negocio}}','mensaje':'Información segura <script>alert(1)</script>','disparadores':['PAGE_OPEN'],'paginas':['ACTIVIDADES'],'roles':['ADMIN'],'condicion':'SIEMPRE','frecuencia':'DIA','prioridad':100,'accion':'VER_ACTIVIDADES','activa':True,**patch}
        return self.platform.ok('/experiencia/reglas','POST',body),body
    def claim(self,c,trigger='PAGE_OPEN',page='ACTIVIDADES'):
        return c.ok('/experiencia/avisos/reclamar','POST',{'trigger':trigger,'pagina':page})['aviso']
    def test_profiles_versions_local_inheritance_and_ownership(self):
        co,_,c=self.company('Versiones');local=c.ok('/auth/me')['localId'];path=f"/experiencia/configuracion?empresaId={co['id']}"
        self.assertEqual(c.ok('/experiencia/configuracion')['modo'],'GENERAL')
        body=self.template(co);t=self.platform.ok('/experiencia/plantillas','POST',body)
        self.assertEqual(self.platform.ok('/experiencia/plantillas','POST',body)['id'],t['id'])
        self.assertEqual(self.platform.request('/experiencia/plantillas','POST',{**body,'nombre':'Otro'})[0],409)
        self.assign(co,t,custom=True);self.assertTrue(c.ok('/experiencia/configuracion')['heredado'])
        t2=self.platform.ok('/experiencia/plantillas','POST',{**body,'baseId':t['id'],'idempotencia':str(uuid.uuid4()),'nombre':'Mini park v2'})
        self.assertEqual((t2['version'],t2['familia']),(2,t['familia']));self.assertEqual(c.ok('/experiencia/configuracion')['plantilla']['id'],t['id'])
        self.assign(co,'BARBERIA',local);self.assertFalse(c.ok('/experiencia/configuracion')['heredado'])
        self.platform.ok(path+f'&localId={local}','DELETE');self.assertEqual(c.ok('/experiencia/configuracion')['plantilla']['id'],t['id'])
        self.assertEqual(self.platform.request(f"/experiencia/configuracion?empresaId={self.b_company['id']}",'PUT',{'modo':'PERSONALIZADO','plantillaId':t['id']})[0],404)
        self.assertEqual(c.request('/experiencia/plantillas')[0],403)
        self.assertEqual(c.request('/experiencia/configuracion?empresaId='+str(self.b_company['id']))[0],403)
        self.assertEqual(self.platform.request('/experiencia/plantillas','POST',{**body,'idempotencia':str(uuid.uuid4()),'codigo':'INVALID_'+uuid.uuid4().hex[:6].upper(),'definicion':{'metricas':[{**body['definicion']['metricas'][0],'operacion':'SQL_INJECT'}],'flujos':[]}})[0],400)
    def test_workflow_real_metrics_order_retries_staff_and_historical_attribution(self):
        co,_,c=self.company('Cortes reales');self.assign(co,'BARBERIA')
        staffrow=c.ok('/usuarios','POST',{'nombre':'Barbero','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'})
        staff=Client();staff.login(co['ruc'],staffrow['correo'])
        body={'idempotencia':str(uuid.uuid4()),'flujoCodigo':'CORTE','titulo':'Corte real','ejecutorId':staffrow['id']}
        a=c.ok('/experiencia/actividades','POST',body);path=f"/experiencia/actividades/{a['id']}"
        self.assertEqual(c.ok('/experiencia/actividades','POST',body)['id'],a['id'])
        self.assertEqual(self.b.request(path)[0],404)
        self.assertEqual(staff.request('/experiencia/actividades/responsables')[0],403)
        self.assertEqual(c.request(path+'/etapa','POST',{'version':0,'estado':'FINALIZADO'})[0],400)
        a=staff.ok(path+'/etapa','POST',{'version':0,'estado':'EN_ATENCION'})
        self.assertIsNotNone(a['iniciada']);self.assertFalse(a['finalizada'])
        self.assertEqual(staff.ok(path+'/etapa','POST',{'version':0,'estado':'EN_ATENCION'})['version'],1)
        self.assertEqual(staff.request(path+'/etapa','POST',{'version':0,'estado':'FINALIZADO'})[0],409)
        a=staff.ok(path+'/etapa','POST',{'version':1,'estado':'FINALIZADO'});self.assertTrue(a['finalizada'])
        self.assertEqual(len(c.ok(path)['eventos']),3)
        report=c.ok('/rendimiento')['personalizado'];vals={m['clave']:m['valor'] for m in report['metricas']}
        self.assertEqual(vals['cortes'],1);self.assertIsNotNone(vals['duracion'])
        own=staff.ok('/rendimiento')['personalizado'];self.assertEqual([r['id'] for r in own['colaboradores']],[staffrow['id']])
        other=c.ok('/experiencia/actividades','POST',{**body,'idempotencia':str(uuid.uuid4()),'ejecutorId':c.ok('/auth/me')['id']})
        self.assertEqual(staff.request('/experiencia/actividades/'+str(other['id']))[0],404)
        self.assertEqual(staff.request('/experiencia/actividades','POST',{**body,'idempotencia':str(uuid.uuid4()),'ejecutorId':c.ok('/auth/me')['id']})[0],403)
        self.assertEqual(c.request('/experiencia/actividades/'+str(other['id'])+'/etapa','POST',{'version':0,'estado':'CANCELADA'})[0],400)
        c.ok('/experiencia/actividades/'+str(other['id'])+'/etapa','POST',{'version':0,'estado':'CANCELADA','motivo':'Cliente se retiró'})
        self.assertEqual({m['clave']:m['valor'] for m in c.ok('/rendimiento')['personalizado']['metricas']}['cortes'],1)
    def test_custom_flow_snapshot_reassignment_and_delete_protection(self):
        co,_,c=self.company('Flujo propio');body=self.template(co);t=self.platform.ok('/experiencia/plantillas','POST',body);self.assign(co,t,custom=True)
        u=c.ok('/usuarios','POST',{'nombre':'Operador','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'})
        a=c.ok('/experiencia/actividades','POST',{'idempotencia':str(uuid.uuid4()),'flujoCodigo':'JUEGO','titulo':'Turno','ejecutorId':u['id']})
        root=f"/admin/personal/{u['id']}?empresaId={co['id']}"
        self.platform.ok(f"/admin/personal/{u['id']}/estado?empresaId={co['id']}",'PATCH',{'activo':False,'confirmado':True})
        self.assertEqual(self.platform.request(root,'DELETE',{'confirmado':True})[0],409)
        c.ok(f"/experiencia/actividades/{a['id']}/responsable",'POST',{'version':0,'ejecutorId':c.ok('/auth/me')['id']})
        self.platform.ok(root,'DELETE',{'confirmado':True})
        a=c.ok(f"/experiencia/actividades/{a['id']}");self.assertEqual(a['eventos'][0]['estado'],'ESPERA');self.assertEqual(a['eventos'][1]['tipo'],'REASIGNADA')
        revised=copy.deepcopy(body);revised['idempotencia']=str(uuid.uuid4());revised['baseId']=t['id'];revised['definicion']['flujos'][0]['etapas'][1]['codigo']='NUEVA'
        t2=self.platform.ok('/experiencia/plantillas','POST',revised);self.assign(co,t2,custom=True)
        old=c.ok(f"/experiencia/actividades/{a['id']}/etapa",'POST',{'version':1,'estado':'EN_CURSO'});self.assertEqual(old['estado'],'EN_CURSO')
        c.ok(f"/experiencia/actividades/{a['id']}/etapa",'POST',{'version':2,'estado':'FINALIZADO'})
        self.assertEqual(c.ok('/rendimiento')['personalizado']['metricas'][0]['valor'],1)
    def test_restaurant_first_delivery_is_real_once_and_does_not_charge(self):
        co,_,c=self.company('Primer servicio');self.assign(co,'RESTAURANTE')
        table=c.ok('/mesas','POST',{'nombre':'Mesa primera','capacidad':2,'activo':True});p=self.product(5,c,price=10)
        a=c.ok('/pedidos','POST',{'clase':'MESA','mesaId':table['id'],'idempotencia':str(uuid.uuid4())})
        path='/pedidos/'+str(a['id']);self.assertEqual(c.request(path+'/servir','POST',{'version':0})[0],400)
        a=c.ok(path,'PUT',{'version':0,'lineas':[{'productoId':p['id'],'cantidad':1}],'observacion':''})
        self.assertEqual(c.request(path+'/servir','POST',{'version':0})[0],409)
        served=c.ok(path+'/servir','POST',{'version':a['version']});self.assertIsNotNone(served['servido_en'])
        self.assertEqual(c.ok(path+'/servir','POST',{'version':a['version']})['servido_en'],served['servido_en'])
        self.assertEqual(self.stock(p,c),5);self.assertEqual(c.ok('/ventas'),[])
        metrics={r['clave']:r for r in c.ok('/rendimiento')['personalizado']['metricas']};self.assertEqual(metrics['pedidos']['valor'],1);self.assertTrue(metrics['atencion']['disponible'])
    def test_retail_empty_ratios_stock_query_and_staff_restriction(self):
        co,_,c=self.company('Rotación');self.assign(co,'FERRETERIA')
        metrics={r['clave']:r for r in c.ok('/rendimiento')['personalizado']['metricas']};self.assertIsNone(metrics['ticket']['valor']);self.assertIsNone(metrics['rotacion']['valor'])
        p=self.product(10,c,price=10);c.ok('/ventas','POST',self.sale(p,2))
        metrics={r['clave']:r for r in c.ok('/rendimiento')['personalizado']['metricas']};self.assertEqual(metrics['ticket']['valor'],20);self.assertEqual(metrics['unidades_ticket']['valor'],2);self.assertTrue(metrics['rotacion']['disponible'])
        u=c.ok('/usuarios','POST',{'nombre':'Empleado','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});staff=Client();staff.login(co['ruc'],u['correo'])
        rotation=next(r for r in staff.ok('/rendimiento')['personalizado']['metricas'] if r['clave']=='rotacion');self.assertFalse(rotation['disponible']);self.assertIn('restringido',rotation['detalle'])
    def test_notices_scope_release_frequency_session_and_receipt_security(self):
        co,email,c=self.company('Avisos seguros');rule,body=self.rule(co)
        self.assertIsNone(self.claim(self.b));self.assertIsNone(self.claim(c,page='RENDIMIENTO'))
        self.assertIsNone(self.claim(c,trigger='EXIT_INTENT'))
        first=self.claim(c);self.assertIn('Avisos seguros',first['titulo']);self.assertIn('<script>',first['mensaje'])
        self.assertIsNone(self.claim(c));path=f"/experiencia/avisos/{first['entregaId']}/respuesta"
        self.assertEqual(self.b.request(path,'POST',{'estado':'MOSTRADO'})[0],404)
        c.ok(path,'POST',{'estado':'LIBERAR'});again=self.claim(c);self.assertEqual(first['entregaId'],again['entregaId'])
        c.ok(path,'POST',{'estado':'MOSTRADO'});c.ok(path,'POST',{'estado':'ACEPTADO'});self.assertIsNone(self.claim(c))
        another=Client();another.login(co['ruc'],email);self.assertEqual(another.request(path,'POST',{'estado':'MOSTRADO'})[0],404);self.assertIsNone(self.claim(another))
        v2=self.platform.ok('/experiencia/reglas','POST',{**body,'baseId':rule['id'],'idempotencia':str(uuid.uuid4()),'mensaje':'Versión 2'})
        self.assertEqual(v2['version'],2);self.assertIsNone(self.claim(another))
        self.assertEqual(c.request('/experiencia/reglas')[0],403)
        self.assertEqual(self.platform.request('/experiencia/reglas','POST',{**body,'idempotencia':str(uuid.uuid4()),'mensaje':'{{noPermitida}}'})[0],400)
    def test_notice_profile_role_and_once_per_version(self):
        co,email,c=self.company('Una vez');self.assign(co,'BARBERIA');rule,body=self.rule(co,plantillaId=self.bases['SPA']['id'],frecuencia='UNA_VEZ')
        self.assertIsNone(self.claim(c));self.assign(co,'SPA');first=self.claim(c);self.assertIsNotNone(first)
        c.ok(f"/experiencia/avisos/{first['entregaId']}/respuesta",'POST',{'estado':'CERRADO'})
        other=Client();other.login(co['ruc'],email);self.assertIsNone(self.claim(other))
        self.platform.ok('/experiencia/reglas','POST',{**body,'baseId':rule['id'],'idempotencia':str(uuid.uuid4()),'mensaje':'Nueva versión'})
        self.assertIsNotNone(self.claim(other))
        u=c.ok('/usuarios','POST',{'nombre':'Staff','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});staff=Client();staff.login(co['ruc'],u['correo']);self.assertIsNone(self.claim(staff))

    def test_parallel_tabs_single_reservation_and_local_scope(self):
        co,email,c=self.company('Pestañas');local=c.ok('/auth/me')['localId']
        second=next(r for r in c.ok('/locales','POST',{'nombre':'Local B','direccion':'B','activo':True}) if r['id']!=local)
        self.rule(co,localId=second['id'])
        self.assertIsNone(self.claim(c))
        c.ok('/locales/seleccionar','POST',{'localId':second['id']})
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            answers=list(executor.map(lambda _:self.claim(c),range(2)))
        self.assertEqual(sum(a is not None for a in answers),1)
        self.assertEqual(c.request('/experiencia/actividades?localId='+str(local))[0],403)
        self.assertEqual(self.platform.request(f"/experiencia/configuracion?empresaId={self.b_company['id']}&localId={local}",'PUT',{'modo':'GENERAL'})[0],400)

if __name__=='__main__':unittest.main(verbosity=2)
