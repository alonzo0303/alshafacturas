"""Cash assignment and mandatory session reminders on a disposable test instance."""
import unittest,os,uuid
from datetime import date,timedelta
import test_api as helpers
from test_api import Client,PASSWORD
class CajaPersonalRegression(unittest.TestCase):
 company=classmethod(helpers.ApiRegression.company.__func__)
 payment=classmethod(helpers.ApiRegression.payment.__func__)
 @classmethod
 def setUpClass(cls):
  cls.platform=Client();cls.platform.ok('/auth/admin/login','POST',{'correo':os.environ['TEST_SUPERADMIN_EMAIL'],'password':os.environ['TEST_SUPERADMIN_PASSWORD']})
 def fixture(self):
  e,_,owner=self.company('Caja por persona');code='R_'+uuid.uuid4().hex[:16].upper();owner.ok('/roles','POST',{'codigo':code,'nombre':'Barbero sin caja','permisos':['VENTAS_GESTIONAR','SERVICIOS_VER']})
  u=owner.ok('/usuarios','POST',{'nombre':'Responsable de caja','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':code});staff=Client();staff.login(e['ruc'],u['correo']);return e,owner,u,staff
 def test_access_fixed_fund_assignment_and_own_scope(self):
  e,a,u,s=self.fixture();self.assertEqual(s.request('/cajas')[0],403);self.assertFalse(s.ok('/cajas/mi-acceso')['habilitada'])
  path=f"/cajas/personal/{u['id']}";self.assertEqual(s.request(path,'PUT',{'habilitada':True,'fondoAsignado':999,'abrirAhora':True})[0],403)
  a.ok(path,'PUT',{'habilitada':True,'fondoAsignado':30,'abrirAhora':False});self.assertIn('CAJA_GESTIONAR',s.ok('/auth/me')['permisos']);self.assertEqual(s.ok('/cajas/mi-acceso')['fondoAsignado'],30)
  self.assertEqual(s.request('/cajas','POST',{'fondo':31})[0],409);box=s.ok('/cajas','POST',{'fondo':30});self.assertEqual(box['usuario_original_id'],u['id']);self.assertEqual(box['abierto_por_original_id'],u['id'])
  self.assertEqual(a.request(path,'PUT',{'habilitada':False,'fondoAsignado':None,'abrirAhora':False})[0],409)
  self.assertEqual(a.request(path,'PUT',{'habilitada':True,'fondoAsignado':40,'abrirAhora':True})[0],409);self.assertEqual(s.ok('/cajas/mi-acceso')['fondoAsignado'],30)
  reminders=s.ok('/sesion/recordatorios');self.assertEqual([b['id'] for b in reminders['cajas']],[box['id']]);self.assertEqual(a.ok('/sesion/recordatorios')['cajas'],[])
  _,other,otheruser,otherstaff=self.fixture();self.assertEqual(other.request(path,'PUT',{'habilitada':True,'fondoAsignado':None,'abrirAhora':False})[0],404);other.ok(f"/cajas/personal/{otheruser['id']}",'PUT',{'habilitada':True,'fondoAsignado':None,'abrirAhora':False});self.assertEqual(otherstaff.request(f"/cajas/{box['id']}")[0],404)
  closed=s.ok(f"/cajas/{box['id']}/cerrar",'POST',{'efectivoContado':25,'comentario':'Faltan S/5 en el conteo de monedas'});self.assertEqual(closed['diferencia'],-5);self.assertEqual(s.ok('/sesion/recordatorios')['cajas'],[])
  a.ok(path,'PUT',{'habilitada':False,'fondoAsignado':None,'abrirAhora':False});self.assertNotIn('CAJA_GESTIONAR',s.ok('/auth/me')['permisos']);self.assertEqual(s.request('/cajas')[0],403)
  assigned=a.ok(path,'PUT',{'habilitada':True,'fondoAsignado':50,'abrirAhora':True});self.assertEqual(assigned['fondo'],50);self.assertEqual(assigned['usuario_original_id'],u['id']);self.assertEqual(assigned['abierto_por_original_id'],a.ok('/auth/me')['id']);self.assertEqual(s.ok('/cajas')[0]['id'],assigned['id'])
 def test_local_policies_do_not_leak_and_invalid_funds_rejected(self):
  e,a,u,s=self.fixture();path=f"/cajas/personal/{u['id']}";self.assertEqual(a.request(path,'PUT',{'habilitada':True,'fondoAsignado':-1,'abrirAhora':False})[0],400)
  self.assertEqual(a.request(path,'PUT',{'habilitada':True,'fondoAsignado':1.111,'abrirAhora':False})[0],400)
  locales=self.platform.ok(f"/locales?empresaId={e['id']}",'POST',{'nombre':'Local B'});main=locales[0]['id'];second=locales[-1]['id']
  self.platform.ok(f"/locales/usuarios/{u['id']}?empresaId={e['id']}",'PUT',{'locales':[main,second]})
  a.ok(path,'PUT',{'habilitada':True,'fondoAsignado':30,'abrirAhora':False});self.assertIn('CAJA_GESTIONAR',s.ok('/auth/me')['permisos'])
  s.ok('/locales/seleccionar','POST',{'localId':second});self.assertNotIn('CAJA_GESTIONAR',s.ok('/auth/me')['permisos']);self.assertEqual(s.request('/cajas')[0],403)
  a.ok('/locales/seleccionar','POST',{'localId':second});a.ok(path,'PUT',{'habilitada':True,'fondoAsignado':80,'abrirAhora':False});self.assertEqual(s.ok('/cajas/mi-acceso')['fondoAsignado'],80)
  s.ok('/locales/seleccionar','POST',{'localId':main});self.assertEqual(s.ok('/cajas/mi-acceso')['fondoAsignado'],30)
 def test_due_today_reminder_for_owner_staff_and_renewal(self):
  e,email,a=self.company('Aviso obligatorio',paid=False);today=date.fromisoformat(self.platform.ok(f"/empresas/{e['id']}/plan")['fechaActual'])
  def pay(start,end):return self.platform.ok(f"/empresas/{e['id']}/pagos",'POST',{'plan':'INICIO','importe':30,'desde':str(start),'hasta':str(end),'referencia':uuid.uuid4().hex,'confirmado':True})
  pay(today-timedelta(days=1),today);u=a.ok('/usuarios','POST',{'nombre':'Personal avisado','correo':uuid.uuid4().hex+'@test.local','password':PASSWORD,'rol':'VENDEDOR'});s=Client();s.login(e['ruc'],u['correo'])
  for client in [a,s]:
   for _ in range(2):
    state=client.ok('/sesion/recordatorios');self.assertTrue(state['venceHoy']);self.assertEqual(state['vence'],str(today))
  pay(today+timedelta(days=1),today+timedelta(days=30))
  for client in [a,s]:self.assertFalse(client.ok('/sesion/recordatorios')['venceHoy'])
if __name__=='__main__':unittest.main(verbosity=2)
