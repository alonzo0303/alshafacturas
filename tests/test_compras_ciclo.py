"""Ciclo OC→compra y edición acotada de códigos sin cambios de stock."""
import os,uuid,unittest
import test_api as h
from test_api import Client,PASSWORD
class CicloRegression(unittest.TestCase):
 company=classmethod(h.ApiRegression.company.__func__)
 payment=classmethod(h.ApiRegression.payment.__func__)
 product=h.ApiRegression.product
 @classmethod
 def setUpClass(cls):
  cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
 def order(self,a,p):
  return a.ok('/compras','POST',{'idempotencia':str(uuid.uuid4()),'proveedor':'Proveedor del ciclo','referencia':uuid.uuid4().hex,'lineas':[{'productoId':p['id'],'cantidad':3,'costo':4}]})
 def test_one_row_changes_from_pending_to_received_with_both_ids(self):
  e,_,a=self.company('Ciclo único');p=self.product(0,a,10);o=self.order(a,p)
  rows=a.ok('/compras-ciclo');self.assertEqual(len(rows),1);self.assertEqual(rows[0]['id'],o['id']);self.assertIsNone(rows[0]['compra_id']);self.assertEqual(rows[0]['estado'],'PENDIENTE')
  done=a.ok(f"/ordenes-compra/{o['id']}/recibir",'POST',{'documento':'GR-CICLO','conforme':True})
  a.ok(f"/ordenes-compra/{o['id']}/recibir",'POST',{'documento':'GR-CICLO','conforme':True})
  rows=a.ok('/compras-ciclo');self.assertEqual(len(rows),1);self.assertEqual(rows[0]['numero'],o['numero']);self.assertEqual(rows[0]['compra_id'],done['id']);self.assertEqual(rows[0]['estado'],'RECIBIDA');self.assertEqual(a.ok(f"/compras/{done['id']}")['orden_id'],o['id']);self.assertEqual(a.ok('/productos')[0]['stock'],3)
  _,_,foreign=self.company('Otro negocio');self.assertEqual(foreign.ok('/compras-ciclo'),[])
  cancelled=self.order(a,p);a.ok(f"/ordenes-compra/{cancelled['id']}/cancelar",'POST',{})
  row=next(x for x in a.ok('/compras-ciclo') if x['id']==cancelled['id']);self.assertEqual(row['estado'],'CANCELADA');self.assertIsNone(row['compra_id']);self.assertEqual(a.ok('/productos')[0]['stock'],3)
 def test_barcode_edit_only_changes_code_preserves_zeros_and_rejects_conflict(self):
  e,_,a=self.company('Código manual');p=self.product(7,a,10);second=self.product(0,a,20);before=next(x for x in a.ok('/productos') if x['id']==p['id']);path=f"/productos/{p['id']}/codigo-barras"
  a.ok(path,'PATCH',{'codigoBarras':'000775001','anterior':None});a.ok(path,'PATCH',{'codigoBarras':'000775001','anterior':None})
  for value in ['','   ','x'*81,'abc\n123']:self.assertEqual(a.request(path,'PATCH',{'codigoBarras':value,'anterior':'000775001'})[0],400)
  self.assertEqual(a.request(f"/productos/{second['id']}/codigo-barras",'PATCH',{'codigoBarras':'000775001','anterior':None})[0],409)
  self.assertEqual(a.request(path,'PATCH',{'codigoBarras':'OTRO','anterior':None})[0],409)
  after=next(x for x in a.ok('/productos') if x['id']==p['id']);self.assertEqual(after,{**before,'codigo_barras':'000775001'})
  o=self.order(a,p);self.assertEqual(a.ok(f"/ordenes-compra/{o['id']}")['articulos'][0]['codigo_barras'],'000775001')
  done=a.ok(f"/ordenes-compra/{o['id']}/recibir",'POST',{'documento':'GR-CODIGO','conforme':True});self.assertEqual(a.ok(f"/compras/{done['id']}")['lineas'][0]['codigo_barras'],'000775001')
 def test_reception_only_can_edit_members_of_authorized_document(self):
  e,_,a=self.company('Recepción de códigos');p=self.product(0,a,10);other=self.product(0,a,20);o=self.order(a,p)
  code='R_'+uuid.uuid4().hex[:16].upper();a.ok('/roles','POST',{'codigo':code,'nombre':'Recepción acotada','permisos':['COMPRAS_RECIBIR']})
  u=a.ok('/usuarios','POST',{'nombre':'Receptor','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':code});s=Client();s.login(e['ruc'],u['correo']);body={'codigoBarras':'RECEPCION-001','anterior':None}
  self.assertEqual(s.request(f"/productos/{p['id']}/codigo-barras",'PATCH',body)[0],403)
  self.assertEqual(s.request(f"/productos/{other['id']}/codigo-barras",'PATCH',{**body,'ordenId':o['id']})[0],404)
  s.ok(f"/productos/{p['id']}/codigo-barras",'PATCH',{**body,'ordenId':o['id']});self.assertEqual(len(s.ok('/compras-ciclo')),1)
  _,_,foreign=self.company('Ajena');self.assertEqual(foreign.request(f"/productos/{p['id']}/codigo-barras",'PATCH',body)[0],404)
  v=a.ok('/usuarios','POST',{'nombre':'Vendedor','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});seller=Client();seller.login(e['ruc'],v['correo']);self.assertEqual(seller.request('/compras-ciclo')[0],403);self.assertEqual(seller.request(f"/productos/{p['id']}/codigo-barras",'PATCH',body)[0],403)
if __name__=='__main__':unittest.main(verbosity=2)
