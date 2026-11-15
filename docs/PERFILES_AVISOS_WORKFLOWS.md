# Perfiles, avisos y actividades

## Uso

SuperAdmin → **Perfiles y avisos** permite seleccionar un negocio y:

1. Asignar perfil **General**, **Específico por rubro** o **Personalizado** al negocio o a un local. Sin asignación se usa General. Un local hereda el perfil del negocio hasta que tenga una asignación propia; «Usar perfil del negocio» elimina esa excepción.
2. Crear plantillas visualmente o personalizar una base. Hay bases General, Restaurante, Barbería, Spa, Maquillaje y Ferretería. Publicar una versión no la asigna automáticamente ni modifica actividades existentes.
3. Crear/versionar avisos para negocio, local, familia de perfil, roles y páginas. Se pueden pausar publicando una versión inactiva. Los textos y sus entregas anteriores se conservan.

En el negocio → **Actividades** se registra trabajo real con responsable y etapas. El permiso `ACTIVIDADES_GESTIONAR` viene en Vendedor y se puede otorgar a roles personalizados. Administrador/SuperAdmin ven el equipo; cada colaborador ve y gestiona sus propias actividades. SuperAdmin puede hacerlo desde Control operativo → Actividades eligiendo negocio y local.

**Rendimiento** muestra las métricas de la versión asignada. Esto no cambia la visualización individual, permisos, plan, cobros, existencias ni configuración financiera Comercio/Servicios/Ambos. El filtro financiero existente conserva su efecto en ventas; actividades y pedidos se calculan por sus eventos reales.

## Datos y versiones

Migración `V15__perfiles_avisos_y_actividades.sql`:

| Tabla | Responsabilidad |
| --- | --- |
| rendimiento_plantillas | Familia UUID, versión, propietario opcional, definición JSONB y solicitud idempotente |
| rendimiento_asignaciones | Una asignación por empresa/local; local nulo representa configuración del negocio |
| actividades | Empresa/local, versión de plantilla y copia inmutable de flujo, responsable, fechas reales y versión optimista |
| actividad_eventos | Etapa, actor histórico, instante y motivo; secuencia única por actividad |
| reglas_avisos | Familia/versiones, ámbito, condiciones, disparadores, vigencia, prioridad y frecuencia |
| aviso_entregas | Reserva, mostrado/respuesta, usuario histórico, ámbito, hash de sesión y clave de frecuencia |
| pedidos | Nuevas columnas de primera entrega y persona que la registró |

Ejemplo de publicación de plantilla privada (`POST /api/experiencia/plantillas`):

```json
{
  "idempotencia": "742e1acb-1282-4f80-a542-f71bfa4058dd",
  "empresaPropietariaId": 5,
  "codigo": "MINIPARK",
  "nombre": "Mini park",
  "rubro": "Entretenimiento",
  "definicion": {
    "metricas": [{
      "clave": "atenciones", "titulo": "Juegos completados",
      "operacion": "ACTIVIDADES_COMPLETADAS", "flujoCodigo": "JUEGO",
      "clase": null, "meta": 20
    }],
    "flujos": [{
      "codigo": "JUEGO", "nombre": "Atención de juego", "clase": "ATENCION",
      "etapas": [
        {"codigo": "ESPERA", "nombre": "En espera"},
        {"codigo": "EN_CURSO", "nombre": "En juego"},
        {"codigo": "FINALIZADO", "nombre": "Finalizado"}
      ]
    }]
  }
}
```

Nueva versión: `baseId` identifica una versión anterior, `idempotencia` es un UUID nuevo, propietario/código se conservan. Las plantillas nuevas son personalizadas. Una plantilla privada nunca se asigna a otra empresa. Se permiten 1–12 métricas y hasta 10 flujos de 3–8 etapas. Códigos únicos, clases SERVICIO/LOGISTICA/ATENCION y operaciones de una lista cerrada. No se ejecutan expresiones, SQL ni JavaScript suministrados por usuarios.

Asignación: `PUT /api/experiencia/configuracion?empresaId=5[&localId=10]` con `{"modo":"PERSONALIZADO","plantillaId":12}`. General ignora plantillaId y usa la base General. `DELETE` con empresa y local restablece herencia. `GET` devuelve configuración efectiva.

## Métricas y atribución

| Perfil | Métricas | Fuente/criterio |
| --- | --- | --- |
| General | Ventas, importe, servicios/entregas completados, cierres | Ventas confirmadas, actividades finalizadas y cajas cerradas |
| Restaurante | Pedidos tomados, primera entrega, comidas, ventas | Autor del pedido; primera entrega registrada; comida marcada en línea al vender |
| Barbería | Cortes completados, tiempo promedio por corte | Flujo CORTE de su familia de perfil; inicio real → final real |
| Spa | Servicios completados y duración | Actividades de clase SERVICIO |
| Maquillaje/Ferretería | Ticket promedio, unidades/ticket, rotación en unidades | Ventas confirmadas y saldo histórico ponderado por tiempo |
| Personalizado | Combinación de operaciones predefinidas, clase, flujo y meta | Plantilla versionada; metas informativas |

Ventas se atribuyen a quien cobra, cierres a quien cierra, pedidos a quien los toma y actividades al responsable actual/final. La reasignación queda en el historial; no divide el tiempo entre responsables. El actor que avanza cada etapa también queda registrado. Las bajas permanentes conservan nombres e IDs históricos; se bloquean si existen actividades abiertas asignadas a esa persona hasta reasignarlas o cancelarlas.

La primera etapa es espera. Avanzar a la segunda fija inicio; llegar a la última fija final. Solo se avanza una etapa, con versión optimista; cancelar requiere motivo y no cuenta como completado. Un reintento idéntico no duplica registro/eventos. Las actividades conservan sus etapas al cambiar la plantilla.

En Mesas → pedido guardado con artículos → **Registrar primera entrega** fija el tiempo una sola vez con actor y control de versión. No cobra ni descuenta inventario. No se reconstruyen tiempos históricos ni se usa la duración planificada como duración real. Promedios sin mediciones o denominadores cero aparecen como «Sin medición disponible».

La rotación es **unidades de productos vendidas / stock promedio ponderado observado**, excluye servicios y ventas anuladas. No es rotación contable valorizada. Se calcula sobre los movimientos del local y el tiempo transcurrido del intervalo hasta ahora; el administrador ve el indicador del local y no se atribuye a empleados. El período de informes usa America/Lima, máximo 366 días. Los importes son PEN.

## Avisos y eventos

Ejemplo (`POST /api/experiencia/reglas`):

```json
{
  "idempotencia": "eedb5fa6-68fd-4082-aee5-95b3326f5c7c",
  "empresaId": 5, "localId": null, "plantillaId": null,
  "nombre": "Revisar atención", "titulo": "Hola {{negocio}}",
  "mensaje": "Revisa las actividades pendientes de tu equipo.",
  "disparadores": ["POST_LOGIN", "PAGE_OPEN", "EXIT_INTENT"],
  "paginas": ["RENDIMIENTO", "ACTIVIDADES"], "roles": ["ADMIN"],
  "condicion": "SIEMPRE", "frecuencia": "DIA", "prioridad": 50,
  "accion": "VER_ACTIVIDADES", "activa": true,
  "desde": null, "hasta": null
}
```

`empresaId=null` es global; un local requiere empresa. `plantillaId` restringe a su familia, no a una sola versión. Roles vacíos son todos; PERSONAL significa cualquier rol no ADMIN. Páginas vacías son todas y no restringen POST_LOGIN. Fechas inclusivas en Perú. Variables admitidas: negocio, fechaVencimiento, diasRestantes, instruccionesPago. Todo se muestra como texto React, sin HTML ni enlaces arbitrarios.

- POST_LOGIN se encola después de autenticar correctamente; restaurar una sesión no es otro login.
- PAGE_OPEN se encola con cambios de ruta de React Router.
- EXIT_INTENT usa `document.mouseout` con `relatedTarget === null` y `clientY <= 0`, una vez por carga. Es una aproximación para escritorio, no garantiza detectar cierre y no se promete en móviles.
- El coordinador espera a que no existan formularios guardándose, cambios pendientes ni otro diálogo abierto. Prioriza el aviso del servidor; no acumula ventanas visibles.
- `POST /api/experiencia/avisos/reclamar` reserva atómicamente una entrega. `/{UUID}/respuesta` registra MOSTRADO, CERRADO, ACEPTADO o ACCION. Una reserva no mostrada puede LIBERARse o recuperarse tras 5 minutos.
- Frecuencia DIA: empresa/usuario/familia/fecha de Perú; SESION: empresa/usuario/familia/hash de sesión; UNA_VEZ: empresa/usuario/familia/versión. Máximo **un aviso informativo mostrado por sesión**, aunque existan varias reglas. Los avisos pendientes se evalúan en otra sesión elegible.
- La entrega no autoriza operaciones. Una acción solo dirige a rutas internas y respeta permisos. Cerrar un aviso no elude un bloqueo de membresía.

La migración activa un recordatorio interno de membresía D-5 a D-0 para ADMIN, diario, en login o Resumen/Rendimiento. Omite recordatorios si ya hay renovación que cubre el día siguiente. Correo/WhatsApp dependen de la configuración de notificaciones del módulo de suscripciones; estas ventanas no envían mensajes externos.

## Salida y cambios pendientes

`DirtyProvider` usa `useBlocker` para navegación entre páginas y un diálogo propio para cierre de sesión. Cambiar de sucursal pide confirmación antes de modificar la sesión; cancelar conserva el local y borrador. Los formularios compartidos comparan sus campos en memoria; POS y pedidos registran su borrador explícitamente. `useUnsaved` cubre la definición visual de plantillas.

`window.beforeunload` se conecta **solo mientras haya cambios** y se retira al guardar/desmontar. `preventDefault()` y `returnValue=''` solicitan el diálogo nativo. El navegador controla el texto y requiere interacción previa; puede omitirlo en cierres forzados o móviles. No se intenta abrir un modal HTML durante unload. No se guardan contraseñas ni borradores en localStorage. Cerrar explícitamente un editor descarta ese formulario; pedidos con líneas modificadas piden confirmación.

## Seguridad y comprobación

Control de roles en servidor, ámbito empresa/local, CSRF y sesión existentes; consultas parametrizadas; campos/enums y tamaños validados. Las sesiones se almacenan en entregas como SHA-256, nunca como cookies reutilizables. El recibo se valida por UUID, empresa, usuario y sesión. Plantillas, asignaciones, avisos y cambios operativos registran auditoría/historial. No hay borrado en cascada del historial ni migraciones destructivas.

Pruebas: `python tests/test_experiencia.py` con instancia desechable configurada como `tests/test_api.py`; `npm run test:e2e -- experiencia.spec.ts` para recorridos, accesibilidad y anchos 320/768/1024/1440. CI ejecuta además las regresiones anteriores.
