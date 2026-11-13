"""CI aislada: dos PostgreSQL nuevos, guard de migración, carga y reinicio de pruebas."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'herramientas'))
from entornos import read_env,compose
from carga_http import Cliente

processes=[]

def sql(name,query):
    e=read_env(ROOT/('.env.'+name))
    return subprocess.check_output(['docker','compose','--project-name','alsha-'+name,'--env-file',str(ROOT/('.env.'+name)),'--file',str(ROOT/'compose.entornos.yaml'),'exec','-T','db','psql','-U','alsha_bootstrap','-d',e['ALSHA_DATABASE'],'-At','-c',query],cwd=ROOT,env=os.environ|e,text=True).strip()

def launch(name,port,wrong=None):
    e=read_env(ROOT/('.env.'+(wrong or name)))
    env=os.environ|e|{'SPRING_PROFILES_ACTIVE':name,'SERVER_PORT':str(port),'SERVER_ADDRESS':'127.0.0.1','DB_URL':f"jdbc:postgresql://127.0.0.1:{e['DB_PORT']}/{e['ALSHA_DATABASE']}"}
    logs=ROOT/'work'/'entornos-ci';logs.mkdir(parents=True,exist_ok=True)
    log=logs/(name+('-incorrecto' if wrong else '')+'.log')
    with log.open('w') as output:
        process=subprocess.Popen(['java','-jar',str(ROOT/'backend/target/backend-0.0.1-SNAPSHOT.jar')],env=env,cwd=ROOT,stdout=output,stderr=subprocess.STDOUT)
    processes.append(process)
    return process,log

def ready(port,expected):
    for _ in range(60):
        client=Cliente('http://127.0.0.1:'+str(port))
        try:
            if client.request('/entorno')==expected:return
        except Exception:pass
        finally:client.close()
        time.sleep(.5)
    raise AssertionError('No arrancó el entorno '+expected['entorno'])

def run(*args,ok=True):
    r=subprocess.run([sys.executable,*args],cwd=ROOT,capture_output=True,text=True)
    if ok and r.returncode:
        raise AssertionError('Falló '+args[0]+'; revisa los logs privados de entornos-ci')
    return r

def main():
    if os.environ.get('GITHUB_ACTIONS')!='true':
        raise SystemExit('Este ensayo de creación/reinicio está reservado a un runner CI desechable. Para carga manual usa herramientas/carga.py')
    for name in ('pruebas','produccion'):
        existing=subprocess.check_output(['docker','volume','ls','-q','--filter','label=com.docker.compose.project=alsha-'+name],text=True).strip()
        if existing:raise SystemExit('No se ejecuta: hay volúmenes previos del entorno '+name)
    run('herramientas/entornos.py','preparar')
    try:
        for name in ('pruebas','produccion'):
            run('herramientas/entornos.py','iniciar',name,'--solo-db')
        test,_=launch('pruebas',8093);launch('produccion',8094)
        ready(8093,{'entorno':'PRUEBAS','cargaHabilitada':True})
        ready(8094,{'entorno':'PRODUCCION','cargaHabilitada':False})
        # Inicia con el perfil pruebas y conexión válida a producción: debe fallar
        # por destino equivocado antes de que Flyway intente migrar.
        before=sql('produccion','SELECT count(*) FROM flyway_schema_history')
        wrong,log=launch('pruebas',8095,wrong='produccion')
        assert wrong.wait(timeout=45)!=0
        assert 'No se aplicaron migraciones' in log.read_text()
        assert sql('produccion','SELECT count(*) FROM flyway_schema_history')==before
        for name in ('pruebas','produccion'):
            assert sql(name,'SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname=\'alsha_'+name+"'")=='f'
        fixture='work/carga/actores-integracion.json'
        denied=run('herramientas/carga.py','preparar','--url','http://127.0.0.1:8094','--env-file','.env.produccion','--archivo','work/carga/prohibido.json',ok=False)
        assert denied.returncode!=0 and not (ROOT/'work/carga/prohibido.json').exists()
        baseline=sql('produccion','SELECT (SELECT count(*) FROM empresas),(SELECT count(*) FROM usuarios),(SELECT count(*) FROM ventas)')
        assert baseline=='0|0|0'
        run('herramientas/carga.py','preparar','--url','http://127.0.0.1:8093','--actores','5','--negocios','2','--archivo',fixture)
        run('herramientas/carga.py','ejecutar','--url','http://127.0.0.1:8093','--archivo',fixture,'--usuarios','1,2,5','--duracion','2','--pausa','0.1','--p95-ms','10000','--reporte','work/carga/informe-ci.json')
        report=json.loads((ROOT/'work/carga/informe-ci.json').read_text())
        assert all(stage['acciones']>0 and not stage['errores'] for stage in report['etapas'])
        assert sql('produccion','SELECT (SELECT count(*) FROM empresas),(SELECT count(*) FROM usuarios),(SELECT count(*) FROM ventas)')==baseline
        test.terminate();test.wait(timeout=20)
        run('herramientas/entornos.py','reiniciar-pruebas','--confirmar','BORRAR-PRUEBAS')
        assert sql('pruebas',"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")=='0'
        assert sql('produccion','SELECT count(*) FROM flyway_schema_history')==before
        assert sql('produccion','SELECT (SELECT count(*) FROM empresas),(SELECT count(*) FROM usuarios),(SELECT count(*) FROM ventas)')==baseline
        print('Aislamiento, perfiles, usuarios limitados, rechazo en producción, carga 1/2/5 y reinicio exclusivo de Pruebas: APROBADOS')
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                try:process.wait(timeout=20)
                except subprocess.TimeoutExpired:process.kill();process.wait()
        # Estos volúmenes se crearon desde cero en ESTE runner, nunca son datos reales.
        for name in ('pruebas','produccion'):
            compose(name,'down','--volumes')

if __name__=='__main__':main()
