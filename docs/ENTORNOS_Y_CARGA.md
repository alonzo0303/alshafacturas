# Pruebas, producción y carga simultánea

## Qué se separa

La instalación actual y su `.env` no se modifican. Los nuevos entornos parten de bases nuevas: no se copian automáticamente clientes, correos, fotos, ventas ni datos de prueba a producción.

| Entorno | Proyecto Docker | Base | Usuario de aplicación | Puerto DB local | Web local |
| --- | --- | --- | --- | --- | --- |
| Pruebas | alsha-pruebas | alshafacturas_pruebas | alsha_pruebas | 5433 | 8091 |
| Producción | alsha-produccion | alshafacturas_produccion | alsha_produccion | 5434 | 8092 |

`compose.entornos.yaml` crea contenedores, redes y volúmenes diferentes para cada proyecto. Las contraseñas de aplicación y administración son distintas entre sí y entre entornos. La aplicación usa una cuenta sin SUPERUSER, CREATEDB, CREATEROLE ni BYPASSRLS; el administrador PostgreSQL se reserva para operación. La base solo escucha en localhost del host y su red privada de Docker.

Los perfiles Spring `pruebas`/`produccion` verifican **el nombre real de la base, el usuario y sus privilegios antes de migrar con Flyway**. Un perfil cruzado no arranca ni migra. Los perfiles separados requieren Flyway activo. Desarrollo sin perfil conserva la conexión anterior y no admite la herramienta de carga.

`GET /api/entorno` devuelve solo el nombre del entorno y si admite carga; no publica conexión, usuarios ni secretos. La interfaz muestra «PRUEBAS · Datos ficticios», «Producción» o «Desarrollo». La carga necesita perfil Pruebas, conexión verificada y `TEST_CARGA_HABILITADA=true`. Producción siempre la rechaza.

## Iniciar Pruebas en Windows

Requisitos: Docker Desktop con Compose v2 en ejecución, Python 3.10+, JDK 21 y Node.js 24. Ejecutar PowerShell en la carpeta principal `alshafacturas`.

Compilar el código que usarán los contenedores:

```powershell
cd backend
.\mvnw.cmd -DskipTests package
cd ..
npm.cmd ci --prefix frontend
npm.cmd run build --prefix frontend
```

Generar configuraciones privadas e iniciar la instalación nueva de Pruebas:

```powershell
python herramientas/entornos.py preparar
python herramientas/entornos.py iniciar pruebas
```

Abre `http://localhost:8091/admin/login`. El correo y la contraseña iniciales están en **`.env.pruebas`**, que puedes abrir en tu editor. No lo publiques. `preparar` no reemplaza archivos ya existentes y nunca cambia `.env` de la instalación anterior. Usa valores sin comillas en los archivos generados. En Windows también puedes usar `py -3` en lugar de `python`.

Al confirmar el primer acceso, cambia `APP_BOOTSTRAP_SUPERADMIN_ENABLED=false` en `.env.pruebas` y vuelve a iniciar ese entorno. Esta variable no restablece contraseñas de cuentas ya creadas.

El entorno anterior continúa en sus puertos habituales; los nuevos datos de ensayo deben crearse en **8091**, donde aparece la etiqueta Pruebas. Para conservar algún negocio de la instalación anterior, primero realiza una copia de seguridad y planifica una transferencia explícita. No ejecutes una limpieza de la base anterior pensando que es la nueva.

Para crear únicamente la base nueva de producción, sin publicar una web:

```powershell
python herramientas/entornos.py iniciar produccion --solo-db
```

Producción utiliza `.env.produccion` y empieza sin clientes ficticios. Antes de iniciar su web real: configurar el correo del SuperAdmin, habilitar el alta inicial solo una vez, disponer de dominio/proxy HTTPS, respaldos y revisar [PRODUCCION.md](PRODUCCION.md). Las cookies del perfil producción son siempre seguras. El puerto web 8092 queda enlazado a localhost para el proxy HTTPS; no es una publicación pública ni configura dominio o certificados.

## Cómo simular personas simultáneas

La herramienta usa HTTP real, conexiones persistentes y una sesión/cookies/CSRF independiente por usuario. No abre cien navegadores ni mide el tiempo de dibujar la página; para eso se mantienen las pruebas de interfaz.

Primero crea los actores ficticios, solo en Pruebas:

```powershell
python herramientas/carga.py preparar --actores 100 --negocios 5
```

Crea cinco negocios ficticios, cien colaboradores, productos, compras con stock suficiente y pagos **simulados** del plan de S/70 para habilitar sus cupos. No cobra dinero ni llama a SUNAT. Las credenciales quedan en `work/carga/actores.json`, fuera de Git. Cada corrida tiene correos y claves propios. Si una preparación se interrumpe puede dejar datos parciales en Pruebas; no se hace limpieza automática.

En una segunda etapa ejecuta la carga:

```powershell
python herramientas/carga.py ejecutar --usuarios 10,25,50,100 --duracion 30
```

Cada nivel dura unos treinta segundos después de autenticar las sesiones; puede tardar algo más al finalizar peticiones. Cada usuario espera medio segundo entre acciones. La mezcla aproximada es 70 % consultas de productos/inventario, 20 % ventas internas y 10 % consultas de rendimiento. Los actores se distribuyen entre los negocios preparados. Para estudiar un solo negocio muy concurrido, prepara otra corrida con `--negocios 1` y un archivo nuevo.

Opciones útiles:

```powershell
python herramientas/carga.py ejecutar --usuarios 10,25,50 --duracion 60 --pausa 0.5 --p95-ms 2000 --reporte work/carga/ensayo-01.json
```

`--url` permite apuntar a un servidor **de pruebas** en otro equipo, por ejemplo una instalación con HTTPS y el mismo tamaño del futuro servidor real. El mismo origen debe usarse al preparar y ejecutar. No se siguen redirecciones ni se aceptan URLs con credenciales. Se permiten hasta 200 actores y niveles crecientes de 1–300 segundos; se necesitan suficientes actores previamente preparados. El incremento se detiene si el nivel incumple los criterios.

Durante la prueba, en otra terminal puedes observar CPU y memoria:

```powershell
docker stats alsha-pruebas-backend-1 alsha-pruebas-db-1
```

Ctrl+C sale del monitor; no detiene la aplicación. Conviene ejecutar el generador desde **otra máquina** para que no compita por CPU/RAM con el servidor. Las diferencias de almacenamiento, latencia, fotos, tamaño de catálogos y reportes cambian el resultado.

## Leer el informe

La consola y `work/carga/informe-*.json` muestran por nivel:

- Usuarios previstos, inicios de sesión fallidos y negocios realmente activos.
- Acciones completadas, peticiones HTTP y acciones por segundo.
- p50/p95/p99 por acción; p95 significa que el 95 % de las acciones tardó ese tiempo o menos. Una venta incluye obtención de CSRF y confirmación; el login inicial se informa aparte y no cuenta en la fase sostenida.
- Errores por operación y código HTTP. Un 409 por falta de stock/caja u otra regla de negocio debe diagnosticarse; no significa automáticamente falta de CPU.
- Criterio inicial: menos del 1 % de errores, p95 global ≤ 2000 ms y ningún login fallido. Los percentiles incluyen acciones fallidas; siempre revisar también su contador.

No contiene contraseñas, cookies ni datos de clientes. Los informes no se sobrescriben. Una prueba corta con pocos productos verifica la herramienta, **no acredita cuántos usuarios soportará producción**. Para decidir alojamiento se deben registrar especificaciones, versión, volumen realista de datos, carga por negocio y mantener pruebas prolongadas para detectar saturación o acumulación de conexiones. También hay que vigilar el propio generador.

## Borrar solo los datos de Pruebas

Cuando termines y quieras empezar de cero, primero pon `APP_BOOTSTRAP_SUPERADMIN_ENABLED=true` en `.env.pruebas` para recrear su SuperAdmin. Después ejecuta:

```powershell
python herramientas/entornos.py reiniciar-pruebas --confirmar BORRAR-PRUEBAS
python herramientas/entornos.py iniciar pruebas
```

Esto elimina **solo** el volumen `alsha-pruebas_postgres_data` del nuevo proyecto de Pruebas y crea una base vacía. Borra sus negocios, usuarios, imágenes, documentos y operaciones. Conserva producción, instalación anterior, archivos privados y código. La aplicación vuelve a aplicar migraciones al iniciar.

Después del primer acceso, deshabilita nuevamente el alta inicial y vuelve a iniciar el entorno. Los actores anteriores dejan de ser válidos: retira su archivo privado o utiliza un nombre nuevo y ejecuta otra vez `carga.py preparar`. Los informes de carga anteriores se conservan en `work/carga` hasta que decidas retirarlos.

No hay un comando de reinicio para Producción. Para detener temporalmente sin borrar datos:

```powershell
python herramientas/entornos.py detener pruebas
python herramientas/entornos.py estado pruebas
```

Evita `docker compose down -v` en instalaciones con datos que debas conservar. La recreación de un contenedor sin eliminar su volumen mantiene su base.

## Validación técnica

- `tests/test_carga_guard.py`: rechazo de destinos no autorizados antes de enviar credenciales/escrituras, formato de URL y configuración cruzada.
- `EntornoConfigTests`: identidad real, rol limitado, perfil incompatible y bloqueo antes de migrar.
- `tests/test_entornos_ci.py`: runner desechable, dos PostgreSQL físicos independientes, carga corta de 1/2/5 sesiones, rechazo en Producción y reinicio exclusivo de Pruebas conservando Producción. Se niega a ejecutarse si hay volúmenes previos o fuera de GitHub Actions.
- Las pruebas de carga largas se realizan después sobre el alojamiento elegido. El ensayo de CI es funcional y no se usa como referencia comercial de capacidad.
