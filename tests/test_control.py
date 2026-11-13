"""Operational/security regressions. Disposable running PostgreSQL-backed test instance only."""
import os
import unittest
import uuid
import json
import base64
import concurrent.futures
import test_api as helpers
from test_api import Client, PASSWORD

class ControlRegression(unittest.TestCase):
    company=classmethod(helpers.ApiRegression.company.__func__)
    payment=classmethod(helpers.ApiRegression.payment.__func__)
    product=helpers.ApiRegression.product
    sale=helpers.ApiRegression.sale
    stock=helpers.ApiRegression.stock

    @classmethod
    def setUpClass(cls):
        cls.platform=Client()
        cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
        cls.a_company,cls.a_email,cls.a=cls.company('Control A')
        cls.b_company,cls.b_email,cls.b=cls.company('Control B')

    def employee(self,owner,role='VENDEDOR',name='Colaborador'):
        return owner.ok('/usuarios','POST',{'nombre':name,'correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':role})

    def config(self,company,**kwargs):
        self.platform.ok(f"/operacion/configuracion?empresaId={company['id']}",'PUT',{'preparacionHabilitada':False,'cajaObligatoria':False,'rendimientoModo':'AMBOS',**kwargs})

    def test_grace_hard_delete_preserves_sales_and_releases_slot(self):
        company,email,owner=self.company('Gracia y baja',paid=False)
        self.payment(company['id'],'INICIO',35)
        u=self.employee(owner,name='Autor histórico');self.employee(owner)
        actor=Client();actor.login(company['ruc'],u['correo'])
        p=self.product(3,owner,price=10);sale=actor.ok('/ventas','POST',self.sale(p))
        owner.ok(f"/usuarios/{u['id']}/activo",'PATCH',{'activo':False})
        state=owner.ok('/plan');self.assertEqual((state['empleadosActivos'],state['cuposOcupados'],state['cuposReservados']),(1,2,1))
        self.assertEqual(owner.request('/usuarios','POST',{'nombre':'No cupo','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'})[0],409)
        path=f"/admin/personal/{u['id']}?empresaId={company['id']}"
        self.assertEqual(owner.request(path,'DELETE',{'confirmado':True})[0],403)
        self.assertEqual(self.platform.request(path,'DELETE',{'confirmado':False})[0],400)
        self.platform.ok(f"/admin/personal/{u['id']}/estado?empresaId={company['id']}",'PATCH',{'activo':True,'confirmado':True})
        self.assertEqual(owner.ok('/plan')['cuposReservados'],0)
        self.assertEqual(self.platform.request(path,'DELETE',{'confirmado':True})[0],409)
        self.platform.ok(f"/admin/personal/{u['id']}/estado?empresaId={company['id']}",'PATCH',{'activo':False,'confirmado':True})
        self.assertEqual(self.platform.request(f"/admin/personal/{u['id']}?empresaId={self.b_company['id']}",'DELETE',{'confirmado':True})[0],404)
        self.platform.ok(path,'DELETE',{'confirmado':True})
        self.assertNotIn(u['id'],[r['id'] for r in owner.ok('/usuarios')])
        self.assertEqual(owner.ok('/plan')['cuposOcupados'],1)
        new=self.employee(owner);self.assertNotEqual(new['id'],u['id'])
        previous=owner.ok(f"/ventas/{sale['id']}")
        self.assertIsNone(previous['usuario_id']);self.assertEqual(previous['usuario_original_id'],u['id']);self.assertEqual(previous['usuario_nombre'],'Autor histórico');self.assertEqual(previous['total'],10)
        self.assertEqual(self.stock(p,owner),2)
        self.assertIn(actor.request('/auth/me')[0],(401,403))
        audit=self.platform.ok(f"/auditoria?empresaId={company['id']}")
        self.assertTrue(any(r['evento']=='USUARIO_ELIMINADO' and r['objetivo']==str(u['id']) for r in audit))
        self.assertNotIn('password_hash',json.dumps(audit))

    def test_superadmin_roles_owner_transfer_and_credential_reset(self):
        company,email,owner=self.company('Roles y principal')
        old=owner.ok('/auth/me');other=self.employee(owner,'ADMIN','Administrador sustituto')
        path=f"/admin/personal/{old['id']}?empresaId={company['id']}"
        self.assertEqual(self.platform.request(f"/admin/personal/{old['id']}/rol?empresaId={company['id']}",'PATCH',{'rol':'VENDEDOR'})[0],409)
        self.platform.ok('/admin/personal/propietario?empresaId='+str(company['id']),'PATCH',{'usuarioId':other['id']})
        self.platform.ok(f"/admin/personal/{old['id']}/rol?empresaId={company['id']}",'PATCH',{'rol':'VENDEDOR'})
        self.assertEqual(owner.ok('/auth/me')['rol'],'VENDEDOR')
        self.assertEqual(owner.request('/usuarios')[0],403)
        cred=f"/admin/visualizaciones/{old['id']}/credenciales?empresaId={company['id']}"
        self.assertEqual(self.platform.request(cred,'PATCH',{'correo':email,'password':'        '})[0],400)
        self.assertEqual(self.platform.request(cred,'PATCH',{'correo':email,'password':'💜'*20})[0],400)
        new='NuevaClaveControl2026'
        self.platform.ok(cred,'PATCH',{'correo':email,'password':new})
        self.assertIn(owner.request('/auth/me')[0],(401,403))
        client=Client();session=client.ok('/auth/login','POST',{'empresaId':company['id'],'correo':email,'password':new});self.assertEqual(session['id'],old['id'])
        self.platform.ok(f"/admin/personal/{old['id']}/estado?empresaId={company['id']}",'PATCH',{'activo':False,'confirmado':True})
        self.platform.ok(cred,'PATCH',{'correo':email,'password':new+'x'})
        self.assertEqual(Client().request('/auth/login','POST',{'empresaId':company['id'],'correo':email,'password':new+'x'})[0],401)
        self.platform.ok(f"/admin/personal/{old['id']}/estado?empresaId={company['id']}",'PATCH',{'activo':True,'confirmado':True})
        self.assertEqual(Client().ok('/auth/login','POST',{'empresaId':company['id'],'correo':email,'password':new+'x'})['id'],old['id'])

    def test_cash_closing_metrics_and_immutability(self):
        company,email,owner=self.company('Caja verificable');self.config(company,cajaObligatoria=True)
        p=self.product(10,owner,price=10)
        self.assertEqual(owner.request('/ventas','POST',self.sale(p))[0],409)
        caja=owner.ok('/cajas','POST',{'fondo':20})
        self.assertEqual(owner.request('/cajas','POST',{'fondo':0})[0],409)
        u=self.employee(owner,name='Vendedor de prueba');staff=Client();staff.login(company['ruc'],u['correo'])
        self.assertEqual(staff.request(f"/cajas/{caja['id']}")[0],403)
        self.assertEqual(staff.request(f"/cajas/{caja['id']}/cerrar",'POST',{'efectivoContado':20})[0],403)
        first=owner.ok('/ventas','POST',self.sale(p,2));second=owner.ok('/ventas','POST',self.sale(p,1,metodoPago='TARJETA'))
        third=owner.ok('/ventas','POST',self.sale(p,1,metodoPago='TRANSFERENCIA'))
        owner.ok(f"/ventas/{third['id']}/anular",'POST',{'motivo':'Corrección antes de corte'})
        close=owner.ok(f"/cajas/{caja['id']}/cerrar",'POST',{'efectivoContado':35})
        self.assertEqual((close['cantidad_ventas'],close['total_ventas'],close['efectivo_esperado'],close['diferencia']),(2,30,40,-5))
        self.assertEqual(close['cerrado_por'],owner.ok('/auth/me')['id'])
        self.assertEqual(owner.ok(f"/cajas/{caja['id']}/cerrar",'POST',{'efectivoContado':99})['efectivo_contado'],35)
        self.assertEqual(owner.request(f"/ventas/{first['id']}/anular",'POST',{'motivo':'No debe alterar corte'})[0],409)
        metrics=owner.ok('/rendimiento');record=next(r for r in metrics['ventas'] if r['colaborador_id']==owner.ok('/auth/me')['id'])
        self.assertEqual((record['ventas'],record['anuladas'],record['total']),(2,1,30))
        self.assertEqual(sum(r['cortes'] for r in metrics['cortes']),1)
        own=staff.ok('/rendimiento');self.assertEqual(own['ventas'],[]);self.assertEqual(own['cortes'],[])
        self.assertEqual(staff.request('/rendimiento?desde=2020-01-01&hasta=2026-01-01')[0],400)
        local=owner.ok('/auth/me')['localId']
        root=self.platform.ok(f"/rendimiento?empresaId={company['id']}&localId={local}")
        self.assertEqual(root['ventas'],metrics['ventas'])
        self.assertEqual(self.platform.request(f"/rendimiento?empresaId={self.b_company['id']}&localId={local}")[0],400)
        events=owner.ok('/auditoria');self.assertEqual(sum(e['evento']=='CAJA_CERRADA' for e in events),1)
        self.assertEqual(staff.request('/auditoria')[0],403)

    def test_tables_orders_food_and_single_payment(self):
        company,email,owner=self.company('Restaurante de pruebas')
        table=owner.ok('/mesas','POST',{'nombre':'Mesa 1','capacidad':4,'activo':True})
        self.assertEqual(owner.request('/mesas','POST',{'nombre':'Mesa 1','capacidad':4,'activo':True})[0],409)
        self.assertEqual(self.b.request(f"/mesas/{table['id']}",'PUT',{'nombre':'Intrusión','capacidad':2,'activo':True})[0],404)
        body={'clase':'MESA','mesaId':table['id'],'idempotencia':str(uuid.uuid4())}
        order=owner.ok('/pedidos','POST',body);self.assertNotIn('cobro_idempotencia',order)
        self.assertEqual(owner.ok('/pedidos','POST',body)['id'],order['id'])
        self.assertEqual(owner.request('/pedidos','POST',{**body,'idempotencia':str(uuid.uuid4())})[0],409)
        p=self.product(4,owner,price=5)
        food=owner.ok('/servicios','POST',{'nombre':'Almuerzo','precio':12,'duracionMinutos':0,'activo':True,'esComida':True})
        self.assertTrue(food['es_comida'])
        saved=owner.ok(f"/pedidos/{order['id']}",'PUT',{'version':order['version'],'observacion':'Sin sal','lineas':[{'productoId':p['id'],'cantidad':2},{'productoId':food['id'],'cantidad':1}]})
        self.assertEqual(self.stock(p,owner),4)
        self.assertEqual(owner.request(f"/pedidos/{order['id']}",'PUT',{'version':0,'lineas':[{'productoId':p['id'],'cantidad':3}]})[0],409)
        ready=owner.ok(f"/pedidos/{order['id']}/estado",'PATCH',{'version':saved['version'],'estado':'PREPARADO'})
        venta=owner.ok(f"/pedidos/{order['id']}/cobrar",'POST',{'version':ready['version'],'tipo':'TICKET','metodoPago':'EFECTIVO'})
        self.assertEqual(venta['total'],22);self.assertEqual(self.stock(p,owner),2)
        self.assertEqual(owner.ok(f"/pedidos/{order['id']}/cobrar",'POST',{'version':ready['version'],'tipo':'TICKET','metodoPago':'EFECTIVO'})['id'],venta['id'])
        self.assertIsNone(owner.ok('/mesas')[0]['pedido_id'])
        self.assertEqual(self.b.request(f"/pedidos/{order['id']}")[0],404)
        self.assertNotIn('cobro_idempotencia',json.dumps(owner.ok('/pedidos?clase=MESA')))
        self.assertEqual(sum(int(r['comidas']) for r in owner.ok('/rendimiento')['ventas']),1)

    def test_picking_toggle_prices_stock_and_permissions(self):
        company,email,owner=self.company('Preparación verificada');p=self.product(3,owner,price=10)
        body={'clase':'PREPARACION','idempotencia':str(uuid.uuid4())}
        self.assertEqual(owner.request('/pedidos','POST',body)[0],403)
        self.config(company,preparacionHabilitada=True)
        order=owner.ok('/pedidos','POST',body)
        saved=owner.ok(f"/pedidos/{order['id']}",'PUT',{'version':0,'lineas':[{'productoId':p['id'],'cantidad':4}]})
        self.assertEqual(self.stock(p,owner),3)
        self.assertEqual(owner.request(f"/pedidos/{order['id']}/cobrar",'POST',{'version':saved['version'],'tipo':'TICKET','metodoPago':'EFECTIVO'})[0],400)
        saved=owner.ok(f"/pedidos/{order['id']}",'PUT',{'version':saved['version'],'lineas':[{'productoId':p['id'],'cantidad':1}]})
        owner.ok(f"/productos/{p['id']}",'PUT',{'sku':p['sku'],'nombre':p['nombre'],'precio':11,'minimo':1,'activo':True})
        self.assertEqual(owner.request(f"/pedidos/{order['id']}/cobrar",'POST',{'version':saved['version'],'tipo':'TICKET','metodoPago':'EFECTIVO'})[0],409)
        saved=owner.ok(f"/pedidos/{order['id']}",'PUT',{'version':saved['version'],'lineas':[{'productoId':p['id'],'cantidad':1}]})
        sale=owner.ok(f"/pedidos/{order['id']}/cobrar",'POST',{'version':saved['version'],'tipo':'TICKET','metodoPago':'EFECTIVO'});self.assertEqual(sale['total'],11)
        code='R_'+uuid.uuid4().hex[:16].upper();owner.ok('/roles','POST',{'codigo':code,'nombre':'Solo mesas','permisos':['MESAS_GESTIONAR']})
        u=self.employee(owner,code);staff=Client();staff.login(company['ruc'],u['correo'])
        self.assertEqual(staff.request('/pedidos','POST',{'clase':'PREPARACION','idempotencia':str(uuid.uuid4())})[0],403)
        self.assertEqual(staff.request('/pedidos?clase=PREPARACION')[0],403)
        self.assertEqual(staff.request('/pedidos/catalogo')[0],200)

    def test_purchase_orders_documents_and_stock_are_scoped(self):
        company,email,owner=self.company('Compras documentadas');p=self.product(2,owner,price=20)
        body={'idempotencia':str(uuid.uuid4()),'proveedor':'Proveedor OC','referencia':uuid.uuid4().hex,'lineas':[{'productoId':p['id'],'cantidad':3,'costo':5}]}
        order=owner.ok('/ordenes-compra','POST',body)
        self.assertEqual(self.stock(p,owner),2)
        self.assertEqual(order['articulos'][0]['nombre'],p['nombre'])
        self.assertNotIn('recepcion_idempotencia',order)
        self.assertEqual(owner.ok('/ordenes-compra','POST',body)['id'],order['id'])
        self.assertEqual(owner.request('/ordenes-compra','POST',{**body,'proveedor':'Otra solicitud'})[0],409)
        pdf=b'%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\ntrailer <</Root 1 0 R>>\n%%EOF'
        endpoint=f"/ordenes-compra/{order['id']}/documentos?nombre=factura.pdf&clase=FACTURA"
        status,raw,_=owner.raw(endpoint,'PUT',pdf,'application/pdf');self.assertEqual(status,200)
        doc=json.loads(raw)
        self.assertEqual(json.loads(owner.raw(endpoint,'PUT',pdf,'application/pdf')[1])['id'],doc['id'])
        self.assertEqual(owner.raw(endpoint,'PUT',b'<html>invalido</html>','application/pdf')[0],400)
        self.assertEqual(owner.raw(endpoint,'PUT',b'x'*(10*1024*1024+1),'application/pdf')[0],413)
        status,content,headers=owner.raw(f"/documentos-compra/{doc['id']}")
        self.assertEqual(status,200);self.assertEqual(content,pdf)
        self.assertIn('attachment',headers['Content-Disposition']);self.assertEqual(headers['X-Content-Type-Options'],'nosniff')
        self.assertEqual(self.b.raw(f"/documentos-compra/{doc['id']}")[0],404)
        received=owner.ok(f"/ordenes-compra/{order['id']}/recibir",'POST',{})
        self.assertEqual(self.stock(p,owner),5)
        self.assertEqual(owner.ok(f"/ordenes-compra/{order['id']}/recibir",'POST',{})['id'],received['id'])
        self.assertEqual(self.stock(p,owner),5)
        self.assertEqual(owner.ok(f"/compras/{received['id']}/documentos")[0]['id'],doc['id'])
        self.assertEqual(owner.ok(f"/compras/{received['id']}")['lineas'][0]['nombre'],p['nombre'])
        self.assertEqual(self.b.request(f"/compras/{received['id']}")[0],404)
        local=owner.ok('/locales','POST',{'nombre':'Otra sucursal'})[-1]
        owner.ok('/locales/seleccionar','POST',{'localId':local['id']})
        self.assertEqual(owner.request(f"/ordenes-compra/{order['id']}")[0],404)
        self.assertEqual(owner.raw(f"/documentos-compra/{doc['id']}")[0],404)
        self.assertEqual(owner.request(f"/ordenes-compra/{order['id']}/recibir",'POST',{})[0],404)

    def test_common_services_themes_stock_alerts_and_csv(self):
        company,email,owner=self.company('Catálogo y tema')
        template=self.platform.ok('/catalogo-comun','POST',{'nombre':'Corte base','rubro':'Barbería','activo':True,'marca':'Base','clase':'SERVICIO','duracionMinutos':25})
        access=self.platform.ok(f"/empresas/{company['id']}/rubros-catalogo")
        self.platform.ok(f"/empresas/{company['id']}/rubros-catalogo",'PUT',{'rubros':access['disponibles']})
        role='R_'+uuid.uuid4().hex[:15].upper()
        owner.ok('/roles','POST',{'codigo':role,'nombre':'Catálogo de servicios','permisos':['SERVICIOS_EDITAR']})
        u=self.employee(owner,role);staff=Client();staff.login(company['ruc'],u['correo'])
        self.assertEqual(staff.request('/catalogo-comun')[0],200)
        self.assertEqual(staff.request(f"/catalogo-comun/{template['id']}/incorporar",'POST',{'nombre':'Corte','precio':0,'minimo':0,'activo':True})[0],400)
        saved=staff.ok(f"/catalogo-comun/{template['id']}/incorporar",'POST',{'nombre':'Corte propio','precio':20,'minimo':0,'activo':True})
        self.assertEqual(saved['clase'],'SERVICIO');self.assertEqual(saved['duracion_minutos'],25)
        self.assertNotIn(saved['id'],[p['id'] for p in owner.ok('/productos')])
        self.platform.ok(f"/empresas/{self.b_company['id']}/rubros-catalogo",'PUT',{'rubros':['Maquillaje']})
        self.assertEqual(self.b.request(f"/catalogo-comun/{template['id']}/incorporar",'POST',{'nombre':'No autorizado','precio':5,'minimo':0,'activo':True})[0],404)
        tipo=self.platform.ok('/tipos-atencion','POST',{'nombre':'Spa '+uuid.uuid4().hex,'emoji':'🧖','tema':'SPA'})
        me=owner.ok('/auth/me')
        self.platform.ok(f"/admin/visualizaciones/{me['id']}?empresaId={company['id']}",'PATCH',{'modalidad':'ATENCION','tipoAtencion':tipo['codigo']})
        session=owner.ok('/auth/me');self.assertEqual((session['nichoEmoji'],session['nichoTema']),('🧖','SPA'))
        self.assertEqual(owner.request('/tipos-atencion/'+tipo['codigo'],'PUT',{'nombre':'No permitido','tema':'COMERCIO'})[0],403)
        self.assertEqual(self.platform.request('/tipos-atencion','POST',{'nombre':'Tema no válido','tema':'<script>'})[0],400)
        p=self.product(3,owner,price=10);sale=owner.ok('/ventas','POST',self.sale(p))
        history=owner.ok('/ventas');self.assertTrue(next(v for v in history if v['id']==sale['id'])['stock_alerta'])
        owner.ok(f"/ventas/{sale['id']}/anular",'POST',{'motivo':'Reposición de prueba'})
        self.assertFalse(next(v for v in owner.ok('/ventas') if v['id']==sale['id'])['stock_alerta'])
        formula=owner.ok('/productos','POST',{'sku':'=SUM(1,1)','nombre':'  =1+1','precio':1,'minimo':0,'activo':True})
        status,csv,headers=owner.raw('/inventario/stock.csv')
        self.assertEqual(status,200);self.assertIn("'=1+1",csv.decode('utf-8-sig'));self.assertIn('attachment',headers['Content-Disposition'])
        self.assertNotIn('Corte propio',csv.decode('utf-8-sig'))

    def test_idempotency_is_separate_between_sale_order_and_purchase(self):
        company,email,owner=self.company('Claves independientes');self.config(company,preparacionHabilitada=True)
        p=self.product(8,owner,price=10)
        key=str(uuid.uuid4());first=owner.ok('/ventas','POST',self.sale(p,idempotencia=key))
        order=owner.ok('/pedidos','POST',{'clase':'PREPARACION','idempotencia':key})
        saved=owner.ok(f"/pedidos/{order['id']}",'PUT',{'version':0,'lineas':[{'productoId':p['id'],'cantidad':1}]})
        second=owner.ok(f"/pedidos/{order['id']}/cobrar",'POST',{'version':saved['version'],'tipo':'TICKET','metodoPago':'EFECTIVO'})
        self.assertNotEqual(first['id'],second['id']);self.assertEqual(self.stock(p,owner),6)
        purchase={'idempotencia':str(uuid.uuid4()),'proveedor':'Proveedor único','referencia':uuid.uuid4().hex,'lineas':[{'productoId':p['id'],'cantidad':2,'costo':5}]}
        bought=owner.ok('/compras','POST',purchase)
        oc=owner.ok('/ordenes-compra','POST',purchase)
        self.assertEqual(owner.request(f"/ordenes-compra/{oc['id']}/recibir",'POST',{})[0],409)
        self.assertEqual(owner.ok(f"/ordenes-compra/{oc['id']}")['estado'],'PENDIENTE')
        self.assertEqual(self.stock(p,owner),8)

    def test_open_cash_blocks_deletion_and_closed_cut_preserves_actor(self):
        company,email,owner=self.company('Baja con caja')
        u=self.employee(owner,name='Autor del corte');actor=Client();actor.login(company['ruc'],u['correo'])
        caja=actor.ok('/cajas','POST',{'fondo':7})
        state=f"/admin/personal/{u['id']}/estado?empresaId={company['id']}"
        delete=f"/admin/personal/{u['id']}?empresaId={company['id']}"
        self.platform.ok(state,'PATCH',{'activo':False,'confirmado':True})
        self.assertEqual(self.platform.request(delete,'DELETE',{'confirmado':True})[0],409)
        self.platform.ok(state,'PATCH',{'activo':True,'confirmado':True});actor=Client();actor.login(company['ruc'],u['correo'])
        actor.ok(f"/cajas/{caja['id']}/cerrar",'POST',{'efectivoContado':7})
        self.platform.ok(state,'PATCH',{'activo':False,'confirmado':True});self.platform.ok(delete,'DELETE',{'confirmado':True})
        cut=owner.ok(f"/cajas/{caja['id']}")
        self.assertEqual(cut['cerrado_nombre'],'Autor del corte');self.assertEqual(cut['efectivo_esperado'],7)

    def test_security_limits_null_lines_csrf_and_no_secret_leaks(self):
        company,email,owner=self.company('Validación y acceso')
        p=self.product(1,owner)
        self.assertEqual(owner.request('/ventas','POST',{**self.sale(p),'lineas':[None]})[0],400)
        self.assertEqual(owner.request('/compras','POST',{'idempotencia':str(uuid.uuid4()),'proveedor':'X','referencia':'Y','lineas':[None]})[0],400)
        self.assertEqual(owner.request('/productos','POST',{'nombre':'x'*300000,'precio':1,'activo':True})[0],413)
        self.assertEqual(owner.request('/productos','POST',{'nombre':'Sin CSRF','precio':1,'activo':True},csrf=False)[0],403)
        attack="' OR 1=1 --@test.local"
        self.assertNotEqual(Client().request('/auth/login','POST',{'correo':attack,'password':PASSWORD})[0],200)
        client=Client()
        for _ in range(10):self.assertEqual(client.request('/auth/login','POST',{'empresaId':company['id'],'correo':email,'password':'contraseña incorrecta'})[0],401)
        self.assertEqual(client.request('/auth/login','POST',{'empresaId':company['id'],'correo':email,'password':PASSWORD})[0],429)
        user=owner.ok('/auth/me')
        self.platform.ok(f"/admin/visualizaciones/{user['id']}/credenciales?empresaId={company['id']}",'PATCH',{'correo':email,'password':'RestablecidaSegura2026'})
        new=Client().ok('/auth/login','POST',{'empresaId':company['id'],'correo':email,'password':'RestablecidaSegura2026'})
        self.assertEqual(new['id'],user['id'])
        audit=self.platform.ok(f"/auditoria?empresaId={company['id']}")
        self.assertNotIn('RestablecidaSegura2026',json.dumps(audit));self.assertNotIn('password_hash',json.dumps(new))

    def test_parallel_local_contexts_do_not_cross_data(self):
        import copy
        company,email,owner=self.company('Sesiones paralelas')
        first=owner.ok('/locales')[0];pa=self.product(1,owner)
        second=owner.ok('/locales','POST',{'nombre':'Segundo local'})[-1]
        owner.ok('/locales/seleccionar','POST',{'localId':second['id']});pb=self.product(2,owner)
        cookiejar=next(h.cookiejar for h in owner.opener.handlers if hasattr(h,'cookiejar'))
        def worker(index):
            client=Client();jar=next(h.cookiejar for h in client.opener.handlers if hasattr(h,'cookiejar'))
            for cookie in cookiejar:jar.set_cookie(copy.copy(cookie))
            target=first['id'] if index%2==0 else second['id']
            client.ok('/locales/seleccionar','POST',{'localId':target})
            status,body=client.request('/productos',extra_headers={'X-Local-Id':str(target)})
            self.assertIn(status,(200,409))
            if status==200:self.assertEqual({p['id'] for p in body},{pa['id']} if target==first['id'] else {pb['id']})
            return status
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(worker,range(48)))
        self.assertIn(200,results)

if __name__=='__main__':unittest.main(verbosity=2)
