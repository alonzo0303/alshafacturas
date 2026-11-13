"""The load tool must refuse a non-test server before credentials or mutations."""
import json
from pathlib import Path
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'herramientas'))
from carga_http import Cliente
from entornos import config
from unittest.mock import patch
class GuardTests(unittest.TestCase):
    def test_refuses_production_and_disabled_test_without_writes(self):
        for state in ({'entorno':'PRODUCCION','cargaHabilitada':False},{'entorno':'PRUEBAS','cargaHabilitada':False},{'entorno':'DESARROLLO','cargaHabilitada':True}):
            calls=[]
            class Handler(BaseHTTPRequestHandler):
                def do_GET(self):
                    calls.append(('GET',self.path));data=json.dumps(state).encode();self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
                def do_POST(self):calls.append(('POST',self.path));self.send_error(500)
                def log_message(self,*args):pass
            server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            client=Cliente('http://127.0.0.1:'+str(server.server_port))
            try:
                with self.assertRaises(ValueError):client.verificar_pruebas()
                self.assertEqual(calls,[('GET','/api/entorno')])
            finally:client.close();server.shutdown();server.server_close();thread.join()
    def test_urls_cannot_include_credentials_or_redirect_paths(self):
        for url in ('ftp://localhost','http://user:secret@localhost','http://localhost/login','http://localhost?db=prod'):
            with self.assertRaises(ValueError):Cliente(url)
    def test_environment_config_does_not_accept_wrong_database(self):
        # Load only a synthetic configuration; never depends on private local files.
        with patch('entornos.read_env',return_value={'ALSHA_ENV':'pruebas','ALSHA_DATABASE':'alshafacturas_produccion','DB_USER':'alsha_pruebas'}),patch('entornos.Path.exists',return_value=True):
            with self.assertRaisesRegex(ValueError,'no corresponde'):config('pruebas')
if __name__=='__main__':unittest.main(verbosity=2)
