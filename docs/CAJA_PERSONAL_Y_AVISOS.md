# Caja por persona y avisos de entrada/salida

## Habilitar caja y asignar fondo

El administrador del negocio abre Personal/Usuarios → Caja del personal, o Caja y cierres → Caja del personal. La configuración corresponde al **local seleccionado**. Solo aparecen cuentas activas que pueden trabajar en ese local.

En «Configurar caja» puede habilitar o deshabilitar el acceso para esa persona sin cambiar su rol ni dar acceso a las cajas de sus compañeros. Si aún no hay configuración individual, se conserva el permiso de su rol. El módulo Caja debe estar visible en la configuración del negocio para habilitar nuevos accesos.

El fondo es opcional. Vacío permite que la persona indique el efectivo inicial al abrir; con un importe debe usar exactamente ese fondo. El servidor valida el importe, su rango y hasta dos decimales. Cambiar el fondo de configuración no altera una caja ya abierta: se aplica a las próximas aperturas.

«Entregar el fondo y abrir su caja ahora» registra la entrega confirmada por el administrador y abre una caja a nombre de la persona seleccionada. Debe marcarse después de entregar el efectivo; no es una transferencia bancaria ni un movimiento automático entre cajas. Se conservan el responsable, el fondo y quién hizo la apertura. El trabajador puede consultar su caja, vender y cerrarla contando el efectivo. El administrador mantiene la consulta del equipo.

No se abre una segunda caja para la misma persona en el mismo local. El bloqueo de empresa evita duplicaciones simultáneas; si la apertura falla, la configuración tampoco se guarda parcialmente. Antes de retirar el acceso hay que cerrar su caja en ese local. Las otras restricciones de locales, cuentas y planes se mantienen.

## Recordatorios al entrar y salir

En cada entrada al sistema, tanto jefe como personal ven el modal obligatorio cuando el período vence ese día y no hay una renovación que cubra el siguiente. Cerrar el aviso permite trabajar hasta finalizar la vigencia. No se guarda una preferencia que lo suprima en entradas posteriores y no depende de las plantillas de avisos configurables.

Al pulsar «Cerrar sesión», el sistema consulta nuevamente el estado. Muestra el vencimiento de hoy y las cajas abiertas propias, incluso en otros locales. Permite revisar/cerrar la caja, seguir trabajando o confirmar la salida sin cerrar la caja. Salir no registra un arqueo, no cierra cajas y no modifica sus saldos. Se respetan las advertencias de formularios sin guardar.

Al mover el puntero fuera por la parte superior puede mostrarse el aviso de intención de salida, con una pausa breve para evitar repeticiones continuas. Al cerrar o recargar la pestaña, `beforeunload` solicita la advertencia nativa si hay vencimiento de hoy o cajas abiertas. Los navegadores no permiten personalizar ese texto, exigir su aparición sin interacción previa ni garantizarlo al cerrar una aplicación móvil. No se intenta realizar consultas o cierres de caja durante `unload`.

Los avisos de operación se coordinan con los informativos para mostrar una ventana a la vez. El estado se consulta cada minuto, al recuperar el foco y después de cambios de caja. La salida por el botón siempre consulta el servidor antes de continuar.

## Vencimiento y renovación

El último día es válido hasta las 23:59:59 en **America/Lima**. Desde las 00:00 siguientes se rechazan el inicio de sesión y las peticiones de jefe y personal hasta que SuperAdmin registre una renovación vigente. Las sesiones abiertas se bloquean al hacer una petición, incluidas las comprobaciones periódicas. SuperAdmin conserva el acceso para gestionar el pago. Registrar una renovación no elimina usuarios, cajas ni ventas y no levanta suspensiones manuales de empresa.

Si ya hay un pago registrado que cubre el día siguiente, no se pide regularizar de nuevo ni se muestra el modal de vencimiento pendiente. La bandera visual nunca sustituye la validación de suscripción del servidor.

## Datos y pruebas

V18 añade `accesos_caja` por empresa/local/usuario y la identidad de apertura en `cajas`. Inicializa esa identidad en las cajas anteriores usando el responsable que ya guardaban; no modifica fondo, corte, ventas ni diferencias históricas. Los registros individuales se eliminan al borrar una cuenta; la autoría histórica de cajas permanece.

La consulta `/api/sesion/recordatorios` devuelve únicamente las cajas abiertas de la cuenta autenticada y su aviso de membresía. No acepta otro usuario o empresa como destino. Los cambios de acceso requieren rol Administrador, empresa propia y usuario activo del local. El fondo y el responsable se validan en el servidor.

`tests/test_caja_personal.py` verifica permisos, fondo fijo, apertura por administrador, duplicados, diferencias, reversión de cambios al fallar, separación entre empresas/locales y avisos para jefe/personal. La prueba Java usa un reloj controlado para comprobar las 23:59:59, las 00:00 y la renovación. Playwright recorre habilitación, entrega de S/30, consulta, aviso al salir, salida sin cerrar, nuevo aviso al entrar, cierre con diferencia y aviso de pago después de cerrar; comprueba móvil y accesibilidad.
