"""Entornos aislados de AlshaFacturas. Python 3.10+, Docker Compose v2."""
import argparse
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    'pruebas': ('5433', '8091', 'false'),
    'produccion': ('5434', '8092', 'true'),
}

def read_env(path):
    values = {}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or not key.strip().replace('_', '').isalnum():
            raise ValueError('Formato de archivo de entorno inválido')
        values[key.strip()] = value.strip()
    return values


def prepare():
    for name, (db_port, web_port, secure) in SPECS.items():
        path = ROOT / ('.env.' + name)
        if path.exists():
            print(path.name + ': ya existe; no se reemplaza')
            continue
        private = ROOT / 'work' / ('secretos-' + name)
        private.mkdir(parents=True, exist_ok=True)
        values = {
            'ALSHA_ENV': name, 'ALSHA_DATABASE': 'alshafacturas_' + name,
            'DB_USER': 'alsha_' + name, 'DB_PASSWORD': secrets.token_urlsafe(32),
            'PG_ADMIN_PASSWORD': secrets.token_urlsafe(32),
            'DB_PORT': db_port, 'WEB_PORT': web_port, 'COOKIE_SECURE': secure,
            'TEST_CARGA_HABILITADA': 'true' if name == 'pruebas' else 'false',
            'APP_BOOTSTRAP_SUPERADMIN_ENABLED': 'true' if name == 'pruebas' else 'false',
            'SUPERADMIN_CORREO': 'superadmin@' + name + '.alshafacturas.local',
            'SUPERADMIN_PASSWORD': secrets.token_urlsafe(24),
            'SUNAT_SECRETS_DIR': './work/secretos-' + name,
        }
        with path.open('x', encoding='utf-8') as output:
            output.write('# Privado: no publicar. Credenciales independientes por entorno.\n')
            output.write('\n'.join(k + '=' + v for k, v in values.items()) + '\n')
        path.chmod(0o600)
        print(path.name + ': generado; las contraseñas quedan solo en ese archivo')


def config(name):
    path = ROOT / ('.env.' + name)
    if not path.exists():
        raise ValueError('Primero ejecuta: python herramientas/entornos.py preparar')
    values = read_env(path)
    expected = {'ALSHA_ENV': name, 'ALSHA_DATABASE': 'alshafacturas_' + name,
                'DB_USER': 'alsha_' + name}
    if any(values.get(k) != v for k, v in expected.items()):
        raise ValueError('El archivo no corresponde al entorno seleccionado')
    for key in ('DB_PASSWORD', 'PG_ADMIN_PASSWORD'):
        if len(values.get(key, '')) < 20:
            raise ValueError('Falta una contraseña propia de al menos 20 caracteres: ' + key)
    for key in ('DB_PORT','WEB_PORT'):
        if not values.get(key,'').isdigit() or not 1 <= int(values[key]) <= 65535:
            raise ValueError('Puerto inválido: '+key)
    if values['DB_PASSWORD'] == values['PG_ADMIN_PASSWORD']:
        raise ValueError('Aplicación y administrador necesitan contraseñas distintas')
    other = ROOT / ('.env.' + ('produccion' if name == 'pruebas' else 'pruebas'))
    if other.exists():
        opposite = read_env(other)
        for key in ('DB_PASSWORD', 'PG_ADMIN_PASSWORD', 'DB_PORT', 'WEB_PORT', 'SUNAT_SECRETS_DIR'):
            if values.get(key) == opposite.get(key):
                raise ValueError('Los entornos deben tener valores separados: ' + key)
    if name == 'produccion' and (values.get('TEST_CARGA_HABILITADA') != 'false' or values.get('COOKIE_SECURE') != 'true'):
        raise ValueError('Producción exige cookies seguras y carga deshabilitada')
    return path, values


def compose(name, *args):
    path, values = config(name)
    # Evita que variables de otra terminal reemplacen las credenciales del archivo.
    env = os.environ | values
    subprocess.run(['docker', 'compose', '--project-name', 'alsha-' + name,
                    '--env-file', str(path), '--file', str(ROOT / 'compose.entornos.yaml'),
                    *args], cwd=ROOT, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('preparar', help='Generar dos archivos privados, sin modificar los actuales')
    for command in ('iniciar', 'detener', 'estado', 'validar'):
        p = sub.add_parser(command)
        p.add_argument('entorno', choices=SPECS)
        if command == 'iniciar':
            p.add_argument('--solo-db', action='store_true')
    p = sub.add_parser('reiniciar-pruebas', help='Borrar solo el volumen del nuevo entorno de pruebas')
    p.add_argument('--confirmar', required=True, choices=['BORRAR-PRUEBAS'])
    args = parser.parse_args()
    if args.command == 'preparar':
        prepare()
    elif args.command == 'reiniciar-pruebas':
        compose('pruebas', 'down', '--volumes')
        compose('pruebas', 'up', '-d', '--wait', 'db')
        print('Pruebas vacía. Inicia la aplicación para aplicar migraciones; vuelve a preparar la carga.')
    elif args.command == 'iniciar':
        compose(args.entorno, 'up', '-d', '--wait', *(['db'] if args.solo_db else ['--build']))
    elif args.command == 'detener':
        compose(args.entorno, 'stop')
    elif args.command == 'validar':
        compose(args.entorno, 'config', '--quiet')
    else:
        compose(args.entorno, 'ps')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit('No se completó la operación: ' + str(error))
