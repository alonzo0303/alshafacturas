"""Preparación explícita de negocios ficticios en el entorno PRUEBAS."""
from datetime import datetime, timedelta, timezone
from itertools import zip_longest
import json
from pathlib import Path
import secrets
import uuid
from carga_http import Cliente
from entornos import read_env


def guardar(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Un archivo existente nunca se reemplaza: puede corresponder a otra corrida.
    with path.open('x', encoding='utf-8') as output:
        json.dump(value, output, ensure_ascii=False, indent=2)
    path.chmod(0o600)


def preparar(url, env_file, output, negocios, usuarios):
    if Path(output).exists():
        raise ValueError('Ya existe el archivo de actores; usa otro nombre o retíralo después de reiniciar Pruebas')
    client = Cliente(url)
    try:
        client.verificar_pruebas()  # Siempre antes de leer/enviar credenciales o crear datos.
        env = read_env(env_file)
        client.request('/auth/admin/login', 'POST', {'correo': env['SUPERADMIN_CORREO'], 'password': env['SUPERADMIN_PASSWORD']})
        groups = []
        today = datetime.now(timezone(timedelta(hours=-5))).date()
        run = uuid.uuid4().hex[:12]
        for index in range(negocios):
            email = f'propietario-{run}-{index}@carga.test'
            password = secrets.token_urlsafe(24)
            company = client.request('/empresas/alta', 'POST', {'razonSocial': f'PRUEBA CARGA {run} {index+1}', 'administradorNombre': 'Propietario ficticio', 'administradorCorreo': email, 'administradorPassword': password})
            client.request(f"/empresas/{company['id']}/pagos", 'POST', {'plan': 'ILIMITADO', 'importe': 70, 'desde': str(today-timedelta(days=1)), 'hasta': str(today+timedelta(days=30)), 'referencia': 'SIMULADO-CARGA-'+run, 'confirmado': True})
            actors = []
            groups.append(actors)
            owner = Cliente(url)
            try:
                owner.login({'empresaId': company['id'], 'correo': email, 'password': password})
                product = owner.request('/productos', 'POST', {'sku': 'CARGA-'+run, 'nombre': 'Producto ficticio de carga', 'precio': 10, 'minimo': 5, 'activo': True})
                owner.request('/compras', 'POST', {'idempotencia': str(uuid.uuid4()), 'proveedor': 'Proveedor ficticio', 'referencia': run, 'lineas': [{'productoId': product['id'], 'cantidad': 100000, 'costo': 5}]})
                count = usuarios // negocios + (index < usuarios % negocios)
                for n in range(count):
                    correo = f'vendedor-{run}-{index}-{n}@carga.test'
                    secret = secrets.token_urlsafe(24)
                    owner.request('/usuarios', 'POST', {'nombre': f'Colaborador ficticio {n+1}', 'correo': correo, 'password': secret, 'rol': 'VENDEDOR'})
                    actors.append({'empresaId': company['id'], 'correo': correo, 'password': secret, 'productoId': product['id']})
            finally:
                owner.close()
        actors = [a for batch in zip_longest(*groups) for a in batch if a]
        guardar(output, {'entorno': 'PRUEBAS', 'url': url.rstrip('/'), 'corrida': run, 'negocios': negocios, 'actores': actors})
        print(f'Preparados {len(actors)} usuarios ficticios en {negocios} negocios. Credenciales privadas: {output}')
    finally:
        client.close()
