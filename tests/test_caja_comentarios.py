"""Cash close comments: server enforcement, immutable amounts and own scope."""
import os,uuid,unittest
import test_api as h
from test_api import Client,PASSWORD
class ComentarioCajaRegression(unittest.TestCase):
 company=classmethod(h.ApiRegression.company.__func__)
 payment=classmethod(h.ApiRegression.payment.__func__)
 product=h.ApiRegression.product
 sale=h.ApiRegression.sale
 @classmethod
 def setUpClass(cls):
  cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
 def fixture(self,fondo=30):
  e,_,a=self.company('Comentarios de caja');u=a.ok('/usuarios','POST',{'nombre':'Autor del cierre','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});s=Client();s.login(e['ruc'],u['correo']);box=s.ok('/cajas','POST',{'fondo':fondo});return e,a,u,s,box
 def test_shortage_requires_nonblank_comment_and_retry_preserves_close(self):
  e,a,u,s,b=self.fixture();path=f"/cajas/{b['id']}/cerrar"
  for reason in [None,'','  \t\n']:
   self.assertEqual(s.request(path,'POST',{'efectivoContado':25,'comentario':reason})[0],400);self.assertEqual(s.ok(f"/cajas/{b['id']}")['estado'],'ABIERTA')
  self.assertEqual(s.request(path,'POST',{'efectivoContado':25,'comentario':'x'*1001})[0],400)
  closed=s.ok(path,'POST',{'efectivoContado':25,'comentario':'  Faltan S/5 en monedas  '});self.assertEqual(closed['diferencia'],-5);self.assertEqual(closed['comentario_cierre'],'Faltan S/5 en monedas');self.assertEqual(closed['comentado_por_original_id'],u['id']);self.assertTrue(closed['comentado_en'])
  replay=s.ok(path,'POST',{'efectivoContado':500,'comentario':'Otro comentario'});self.assertEqual(replay,closed)
  self.assertEqual(s.request(f"/cajas/{b['id']}/comentario",'PATCH',{'comentario':'Reemplazo'})[0],409)
  self.assertEqual(a.ok(f"/cajas/{b['id']}")['comentario_cierre'],'Faltan S/5 en monedas')
 def test_expected_cash_includes_cash_sales_and_excludes_cards(self):
  e,a,u,s,b=self.fixture();p=self.product(3,a,10);s.ok('/ventas','POST',self.sale(p));s.ok('/ventas','POST',self.sale(p,metodoPago='TARJETA'))
  self.assertEqual(s.request(f"/cajas/{b['id']}/cerrar",'POST',{'efectivoContado':35})[0],400)
  closed=s.ok(f"/cajas/{b['id']}/cerrar",'POST',{'efectivoContado':35,'comentario':'Faltan S/5 respecto al fondo más ventas en efectivo'});self.assertEqual(closed['efectivo_esperado'],40);self.assertEqual(closed['diferencia'],-5)
 def test_equal_or_surplus_optional_and_late_annotation_is_once_and_scoped(self):
  e,a,u,s,b=self.fixture();closed=s.ok(f"/cajas/{b['id']}/cerrar",'POST',{'efectivoContado':30});self.assertIsNone(closed['comentario_cierre'])
  other=a.ok('/usuarios','POST',{'nombre':'Otra persona','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});o=Client();o.login(e['ruc'],other['correo'])
  path=f"/cajas/{b['id']}/comentario";self.assertEqual(o.request(path,'PATCH',{'comentario':'Ajeno'})[0],403)
  _,_,foreign=self.company('Caja ajena');self.assertEqual(foreign.request(path,'PATCH',{'comentario':'Ajeno'})[0],404)
  self.assertEqual(s.request(path,'PATCH',{'comentario':'   '})[0],400)
  updated=s.ok(path,'PATCH',{'comentario':'Arqueo verificado con el administrador'})
  for key in ['fondo','efectivo_esperado','efectivo_contado','diferencia','total_ventas','cantidad_ventas','cerrada']:self.assertEqual(updated[key],closed[key])
  self.assertEqual(s.ok(path,'PATCH',{'comentario':updated['comentario_cierre']}),updated)
  self.assertEqual(a.request(path,'PATCH',{'comentario':'Cambiar motivo'})[0],409)
  nextbox=s.ok('/cajas','POST',{'fondo':30});self.assertEqual(s.request(f"/cajas/{nextbox['id']}/comentario",'PATCH',{'comentario':'Aún abierta'})[0],409)
  self.assertEqual(s.request(f"/cajas/{nextbox['id']}/cerrar",'POST',{'efectivoContado':31})[0],400)
  surplus=s.ok(f"/cajas/{nextbox['id']}/cerrar",'POST',{'efectivoContado':31,'comentario':'Sobra una moneda de S/1'});self.assertEqual(surplus['diferencia'],1)
if __name__=='__main__':unittest.main(verbosity=2)
