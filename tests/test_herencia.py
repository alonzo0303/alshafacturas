"""Company-owned appearance and strict staff scope; disposable database only."""
import os, uuid, unittest, json
import test_api as helpers
from test_api import Client, PASSWORD
class HerenciaRegression(unittest.TestCase):
    company=classmethod(helpers.ApiRegression.company.__func__)
    payment=classmethod(helpers.ApiRegression.payment.__func__)
    product=helpers.ApiRegression.product
    sale=helpers.ApiRegression.sale
    @classmethod
    def setUpClass(cls):
        cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
    def employee(self,c,owner,role='VENDEDOR'):
        u=owner.ok('/usuarios','POST',{'nombre':'Colaborador '+uuid.uuid4().hex[:6],'correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':role})
        client=Client();client.login(c['ruc'],u['correo']);return u,client
    def test_appearance_inheritance_existing_new_staff_and_server_modules(self):
        c,_,a=self.company('Herencia');u,s=self.employee(c,a);config=a.ok('/visualizacion-negocio')
        self.assertEqual(s.request('/visualizacion-negocio')[0],403)
        self.assertEqual(a.request('/visualizacion-negocio?empresaId=999999')[0],403)
        changed={**config,'modalidad':'ATENCION','tipoAtencion':'BARBERIA','colorPrimario':'#abcdef','diseno':'COMPACTO','ordenModulos':list(reversed(config['ordenModulos']))}
        saved=a.ok('/visualizacion-negocio','PUT',changed)
        self.assertEqual(a.request('/visualizacion-negocio','PUT',changed)[0],409)
        for client in [a,s,self.employee(c,a)[1]]:
            current=client.ok('/auth/visualizacion');self.assertEqual(current['modalidad'],'ATENCION');self.assertEqual(current['tipoAtencion'],'BARBERIA');self.assertEqual(current['colorPrimario'],'#abcdef');self.assertEqual(current['aparienciaVersion'],saved['version']);self.assertEqual(current['ordenModulos'],saved['ordenModulos'])
        self.assertEqual(self.platform.request(f"/admin/visualizaciones/{u['id']}?empresaId={c['id']}",'PATCH',{'modalidad':'COMERCIO'})[0],409)
        hidden={**saved,'modulosVisibles':[m for m in saved['modulosVisibles'] if m!='VENTAS']};a.ok('/visualizacion-negocio','PUT',hidden)
        for client in [a,s]:
            self.assertEqual(client.request('/ventas')[0],403)
            self.assertNotIn('VENTAS_GESTIONAR',client.ok('/auth/me')['permisos'])
        a.ok('/roles');a.ok('/visualizacion-negocio')
        self.assertEqual(a.request('/visualizacion-negocio','PUT',{**a.ok('/visualizacion-negocio'),'colorPrimario':'url(evil)'})[0],400)
    def test_all_permissions_do_not_grant_other_staff_operations(self):
        c,_,a=self.company('Datos propios');allperms=a.ok('/roles')['permisosDisponibles'];code='R_'+uuid.uuid4().hex[:16].upper();a.ok('/roles','POST',{'codigo':code,'nombre':'Operador completo','permisos':allperms})
        u,s=self.employee(c,a,code);_,other=self.employee(c,a,code);p=self.product(30,a,10)
        own=other.ok('/ventas','POST',self.sale(p));body=self.sale(p);mine=s.ok('/ventas','POST',body)
        self.assertEqual([v['id'] for v in s.ok('/ventas')],[mine['id']]);self.assertEqual(len(a.ok('/ventas')),2)
        for client,foreign in [(s,own),(other,mine)]:
            self.assertEqual(client.request(f"/ventas/{foreign['id']}")[0],404)
            self.assertEqual(client.request(f"/ventas/{foreign['id']}/anular",'POST',{'motivo':'No autorizado'})[0],404)
        self.assertEqual(other.request('/ventas','POST',body)[0],404)
        self.assertEqual(s.ok('/resumen')['ventas_cantidad'],1);self.assertNotIn('valor_inventario',s.ok('/resumen'))
        self.assertTrue(all(m['usuario_original_id']==u['id'] for m in s.ok('/inventario')))
        self.assertNotIn('ultimo_costo',s.ok('/productos')[0])
        purchase={'proveedor':'Proveedor','referencia':'Ref','idempotencia':str(uuid.uuid4()),'lineas':[{'productoId':p['id'],'cantidad':2,'costo':5}]}
        bought=other.ok('/compras','POST',purchase);self.assertEqual(s.ok('/compras'),[]);self.assertEqual(s.request(f"/compras/{bought['id']}")[0],404);self.assertEqual(s.request('/compras','POST',purchase)[0],404)
        order=other.ok('/ordenes-compra','POST',{**purchase,'idempotencia':str(uuid.uuid4())});self.assertEqual(s.ok('/ordenes-compra'),[])
        self.assertEqual(s.request(f"/ordenes-compra/{order['id']}/recibir",'POST',{})[0],404)
        pdf=b'%PDF-1.4\n%%EOF';status,raw,_=other.raw(f"/compras/{bought['id']}/documentos?nombre=f.pdf&clase=FACTURA",'PUT',pdf,'application/pdf');self.assertEqual(status,200);doc=json.loads(raw)
        self.assertEqual(s.raw(f"/documentos-compra/{doc['id']}")[0],404);self.assertEqual(a.raw(f"/documentos-compra/{doc['id']}")[0],200)
        self.assertEqual(s.ok('/tributacion/resumen')['igv_compras_registrado'],0)
    def test_assigned_orders_and_shared_table_occupancy(self):
        c,_,a=self.company('Pedidos asignados');u,s=self.employee(c,a);_,other=self.employee(c,a)
        mesa=a.ok('/mesas','POST',{'nombre':'Mesa propia','capacidad':4,'activo':True});p=a.ok('/pedidos','POST',{'clase':'MESA','mesaId':mesa['id'],'idempotencia':str(uuid.uuid4())})
        self.assertEqual(s.request('/mesas','POST',{'nombre':'No','capacidad':2,'activo':True})[0],403)
        self.assertEqual(s.request(f"/pedidos/{p['id']}")[0],404);self.assertEqual(s.ok('/pedidos?clase=MESA'),[])
        table=s.ok('/mesas')[0];self.assertTrue(table['ocupada']);self.assertIsNone(table['pedido_id'])
        assigned=a.ok(f"/pedidos/{p['id']}/responsable",'PATCH',{'version':p['version'],'usuarioId':u['id']});self.assertEqual(s.ok(f"/pedidos/{p['id']}")['responsable_original_id'],u['id']);self.assertEqual(len(s.ok('/pedidos?clase=MESA')),1)
        self.assertEqual(other.request(f"/pedidos/{p['id']}")[0],404)
        self.assertEqual(s.request(f"/pedidos/{p['id']}/responsable",'PATCH',{'version':assigned['version'],'usuarioId':None})[0],403)
        self.assertEqual(a.request(f"/pedidos/{p['id']}/responsable",'PATCH',{'version':p['version'],'usuarioId':None})[0],409)
if __name__=='__main__':unittest.main(verbosity=2)
