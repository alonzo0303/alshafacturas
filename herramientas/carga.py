"""Carga HTTP escalonada de AlshaFacturas. No mide renderizado de navegadores."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import random
import threading
import time
import uuid
from carga_http import Cliente, Fallo
from carga_datos import preparar, guardar


def percentil(values, p):
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[max(0, math.ceil(len(ordered)*p)-1)], 2)


def etapa(url, actors, seconds, pause, limit_ms):
    start, deadline = [0.0], [0.0]
    def comenzar():
        start[0] = time.perf_counter()
        deadline[0] = start[0]+seconds
    barrier = threading.Barrier(len(actors)+1, action=comenzar, timeout=120)
    lock = threading.Lock()
    values, errors, http_count = {}, Counter(), [0]
    logins = [0]

    def worker(actor):
        client = Cliente(url)
        ok = False
        try:
            # Un nuevo guard antes de autenticar cada sesión evita continuar si cambia el destino.
            client.verificar_pruebas()
            client.login(actor)
            ok = True
        except (Fallo, ValueError, KeyError):
            with lock:
                logins[0] += 1
        try:
            barrier.wait()
            if not ok:
                return
            rng = random.Random()
            while time.perf_counter() < deadline[0]:
                choice = rng.random()
                action = 'venta' if choice < .2 else 'rendimiento' if choice < .3 else 'inventario'
                before, requests = time.perf_counter(), client.peticiones
                status = 'ok'
                try:
                    if action == 'venta':
                        client.request('/ventas', 'POST', {'idempotencia': str(uuid.uuid4()), 'tipo': 'TICKET', 'metodoPago': 'EFECTIVO', 'lineas': [{'productoId': actor['productoId'], 'cantidad': 1}]})
                    else:
                        client.request('/rendimiento' if action == 'rendimiento' else '/productos')
                except Fallo as error:
                    status = str(error.status)
                with lock:
                    values.setdefault(action, []).append((time.perf_counter()-before)*1000)
                    http_count[0] += client.peticiones-requests
                    if status != 'ok':
                        errors[action+':'+status] += 1
                if pause:
                    time.sleep(pause)
        finally:
            client.close()
    with ThreadPoolExecutor(max_workers=len(actors)) as pool:
        futures = [pool.submit(worker, actor) for actor in actors]
        barrier.wait()
        for future in futures:
            future.result()
    elapsed = time.perf_counter()-start[0]
    total = sum(map(len, values.values()))
    latencies = [v for group in values.values() for v in group]
    count_errors = sum(errors.values())
    ratio = count_errors/total if total else 1
    p95 = percentil(latencies, .95)
    return {'usuarios': len(actors), 'negocios_activos': len({a['empresaId'] for a in actors}), 'usuarios_con_login_fallido': logins[0], 'segundos_observados': round(elapsed, 2),
            'acciones': total, 'peticiones_http': http_count[0], 'acciones_por_segundo': round(total/elapsed, 2), 'peticiones_por_segundo': round(http_count[0]/elapsed,2),
            'errores': dict(errors), 'porcentaje_errores': round(100*ratio, 3), 'p95_ms': p95,
            'por_accion': {name: {'cantidad': len(group), 'p50_ms': percentil(group,.5), 'p95_ms': percentil(group,.95), 'p99_ms': percentil(group,.99)} for name, group in values.items()},
            'cumple_criterio': bool(total and not logins[0] and ratio < .01 and p95 <= limit_ms)}


def ejecutar(args):
    client = Cliente(args.url)
    try:
        client.verificar_pruebas()
    finally:
        client.close()
    fixture = json.loads(Path(args.archivo).read_text())
    if fixture.get('entorno') != 'PRUEBAS' or fixture.get('url') != args.url.rstrip('/'):
        raise ValueError('El archivo de actores no corresponde al servidor de pruebas elegido')
    levels = [int(v) for v in args.usuarios.split(',')]
    if not levels or levels != sorted(set(levels)) or min(levels) < 1 or max(levels) > min(200, len(fixture['actores'])):
        raise ValueError('Usa niveles crecientes, entre 1 y 200, sin exceder los actores preparados')
    report = {'entorno': 'PRUEBAS', 'destino':args.url, 'niveles_solicitados':levels, 'duracion_objetivo_segundos':args.duracion, 'pausa_segundos':args.pausa, 'fecha_utc': datetime.now(timezone.utc).isoformat(), 'negocios': fixture['negocios'],
              'criterio': {'errores_menos_de_porcentaje': 1, 'p95_maximo_ms': args.p95_ms},
              'alcance': 'HTTP API; latencia por acción, venta incluye CSRF; login excluido y sus fallos informados. No acredita capacidad de producción.', 'etapas': []}
    for users in levels:
        result = etapa(args.url, fixture['actores'][:users], args.duracion, args.pausa, args.p95_ms)
        report['etapas'].append(result)
        print(json.dumps(result, ensure_ascii=False))
        if not result['cumple_criterio']:
            print('Se detiene el incremento: revisa errores, servidor y generador antes de repetir.')
            break
    guardar(args.reporte, report)
    print('Informe sin credenciales:', args.reporte)
    return 0 if all(r['cumple_criterio'] for r in report['etapas']) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='comando', required=True)
    p = sub.add_parser('preparar')
    p.add_argument('--url', default='http://localhost:8091')
    p.add_argument('--env-file', default='.env.pruebas')
    p.add_argument('--archivo', default='work/carga/actores.json')
    p.add_argument('--negocios', type=int, default=5)
    p.add_argument('--actores', type=int, default=100)
    p = sub.add_parser('ejecutar')
    p.add_argument('--url', default='http://localhost:8091')
    p.add_argument('--archivo', default='work/carga/actores.json')
    p.add_argument('--usuarios', default='10,25,50,100')
    p.add_argument('--duracion', type=int, default=30)
    p.add_argument('--pausa', type=float, default=.5)
    p.add_argument('--p95-ms', type=int, default=2000)
    p.add_argument('--reporte', default='work/carga/informe-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.json')
    args = parser.parse_args()
    if args.comando == 'preparar':
        if not 1 <= args.negocios <= args.actores <= 200:
            raise ValueError('Se admiten 1–200 actores y entre 1 y ese número de negocios')
        preparar(args.url, args.env_file, args.archivo, args.negocios, args.actores)
        return 0
    if not 1 <= args.duracion <= 300 or not 0 <= args.pausa <= 10 or args.p95_ms < 1:
        raise ValueError('Duración 1–300 segundos, pausa 0–10 y límite p95 positivo')
    if Path(args.reporte).exists():
        raise ValueError('El informe ya existe; elige otro archivo')
    return ejecutar(args)

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError, Fallo, KeyError, threading.BrokenBarrierError) as error:
        raise SystemExit('Prueba detenida: ' + str(error))
