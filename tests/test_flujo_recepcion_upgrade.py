"""Reglas de arqueo, upgrade inmediato y recepción física, contra BD de pruebas."""
import os,uuid,unittest
import test_api as h
from test_api import Client,PASSWORD
class FlujoRegression(unittest.TestCase):
 company=classmethod(h.ApiRegression.company.__func__)
 payment=classmethod(h.ApiRegression.payment.__func__)
 product=h.ApiRegression.product
 @classmethod
 def setUpClass(cls):
  cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
 def test_egreso_requires_reason_and_changes_expected_once(self):
  e,_,a=self.company('Movimientos');b=a.ok('/cajas','POST',{'fondo':30});path=f"/cajas/{b['id']}/movimientos";m={'tipo':'EGRESO','importe':5,'motivo':'Compra de bolsas','idempotencia':str(uuid.uuid4())}
  for reason in ['',None,'   ']:self.assertEqual(a.request(path,'POST',{**m,'motivo':reason})[0],400)
  self.assertEqual(a.request(path,'POST',{**m,'importe':31})[0],409)
  a.ok(path,'POST',m);a.ok(path,'POST',m);detail=a.ok(f"/cajas/{b['id']}");self.assertEqual(detail['saldo_esperado'],25);self.assertEqual(len(detail['movimientos']),1)
  self.assertEqual(a.request(path,'POST',{**m,'importe':4})[0],409)
  self.assertEqual(a.request(f"/cajas/{b['id']}/cerrar",'POST',{'efectivoContado':26})[0],400)
  closed=a.ok(f"/cajas/{b['id']}/cerrar",'POST',{'efectivoContado':25});self.assertEqual(closed['diferencia'],0)
  self.assertEqual(a.request(path,'POST',{**m,'idempotencia':str(uuid.uuid4())})[0],409)
 def test_new_vendor_inherits_read_permissions_immediately(self):
  e,_,a=self.company('Lectura vendedor');u=a.ok('/usuarios','POST',{'nombre':'Vendedor nuevo','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});v=Client();login=v.login(e['ruc'],u['correo'])
  for perm in ['PRODUCTOS_VER','INVENTARIO_VER']:self.assertIn(perm,login['permisos'])
  for path in ['/productos','/inventario','/catalogo-comun']:self.assertEqual(v.request(path)[0],200,path)
 def test_upgrade_is_immediate_preserves_payment_and_is_idempotent(self):
  e,_,a=self.company('Upgrade',paid=False);self.payment(e['id'],'INICIO',30)
  old=a.ok('/plan');path=f"/empresas/{e['id']}/upgrade";q=self.platform.ok(path+'?plan=EQUIPO');r={**q,'referencia':uuid.uuid4().hex,'confirmado':True,'idempotencia':str(uuid.uuid4())}
  self.assertEqual(a.request(path,'POST',r)[0],403)
  self.assertEqual(self.platform.request(path,'POST',{**r,'importe':0})[0],409)
  updated=self.platform.ok(path,'POST',r);self.assertEqual(updated['plan'],'EQUIPO');self.assertEqual(updated['limiteEmpleados'],2);self.assertEqual(updated['pagoActual']['hasta'],old['pagoActual']['hasta']);self.assertEqual(updated['historial'],old['historial'])
  replay=self.platform.ok(path,'POST',r);self.assertEqual(len(replay['upgrades']),1)
  self.assertEqual(self.platform.request(path+'?plan=INICIO')[0],409)
 def test_order_waits_for_physical_receipt_and_tracks_both_people(self):
  e,_,a=self.company('Recepción');p=self.product(0,a,10)
  users=[]
  for role in ['COMPRAS','ALMACENERO','VENDEDOR']:
   u=a.ok('/usuarios','POST',{'nombre':role+' autor','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':role});c=Client();c.login(e['ruc'],u['correo']);users.append((u,c))
  buyer,recep,vendor=users;c=buyer[1];w=recep[1];payload={'idempotencia':str(uuid.uuid4()),'proveedor':'Proveedor','referencia':'COT-001','lineas':[{'productoId':p['id'],'cantidad':3,'costo':4}]}
  oc=c.ok('/compras','POST',payload);self.assertTrue(oc['numero'].startswith('OC-'));self.assertEqual(oc['estado'],'PENDIENTE');self.assertEqual(oc['usuario_nombre'],buyer[0]['nombre']);self.assertTrue(oc['fecha']);self.assertEqual(a.ok('/productos')[0]['stock'],0)
  path=f"/ordenes-compra/{oc['id']}/recibir";r={'documento':'GR-999','conforme':True}
  self.assertEqual(c.request(path,'POST',r)[0],403);self.assertEqual(vendor[1].request(path,'POST',r)[0],403)
  self.assertEqual(w.request(path,'POST',{})[0],400);self.assertEqual(w.request(path,'POST',{**r,'conforme':False})[0],400)
  self.assertEqual(w.ok('/ordenes-compra')[0]['numero'],oc['numero'])
  done=w.ok(path,'POST',r);self.assertEqual(done['usuario_nombre'],buyer[0]['nombre']);self.assertEqual(done['recibido_nombre'],recep[0]['nombre']);self.assertEqual(done['fecha'],oc['fecha']);self.assertTrue(done['recibido_en']);self.assertEqual(done['orden_numero'],oc['numero'])
  self.assertEqual(w.ok(path,'POST',r)['id'],done['id']);self.assertEqual(a.ok('/productos')[0]['stock'],3)
  self.assertEqual(c.ok(f"/compras/{done['id']}")['documento_recepcion'],'GR-999')
  _,_,foreign=self.company('Ajena');self.assertEqual(foreign.request(path,'POST',r)[0],404)
if __name__=='__main__':unittest.main(verbosity=2)
