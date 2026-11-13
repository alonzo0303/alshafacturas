# Rubros, planes y recordatorios

## Elegir rubro en SuperAdmin

En **Empresas**, al crear o editar un negocio, usa **Rubro / giro de negocio**. Puedes buscar Barbería, Spa, Restaurante, Abarrotes, Ferretería u otro rubro publicado. Se guarda en el mismo negocio y habilita las plantillas comunes de ese rubro, sin crear copias ni modificar productos, servicios, existencias o ventas propios.

En **Sucursales**, crear/editar un local ofrece **Rubro / giro de la sucursal**. Puede heredar el rubro del negocio (campo vacío) o tener otro. Solo SUPERADMIN asigna rubros; ADMIN conserva la gestión de nombre y dirección de sus locales. El listado, las imágenes y la incorporación por ID validan empresa, local, permisos y rubro. El catálogo común permite incorporar productos y servicios según el permiso de edición correspondiente. La modalidad visual individual se sigue asignando en Visualizaciones: elegir rubro no cambia roles ni visualizaciones del personal.

V14 incluye plantillas base de Corte de cabello/Afeitado, Masaje relajante/Limpieza facial y Plato del día. No incluyen precio de venta ni stock; cada negocio define su precio al incorporarlas. Los negocios anteriores sin rubro principal conservan la asignación avanzada de rubros. Si quitas el rubro principal, vuelve a aplicarse esa lista avanzada. Si un rubro tiene contenido deshabilitado o aún no publicado, seleccionarlo no publica plantillas inactivas.

## Entender planes y pagos

En **Pagos y planes**, el resumen global distingue planes activos, programados y vencidos. Para cada negocio se muestran plan, importe, estado, período y vencimiento, además de cupos ocupados/límite. Los cupos no son un contador de planes. Los precios siguen en S/35, S/50 y S/70.

- **Activo:** la fecha de Perú está dentro del período confirmado, incluyendo el primer y último día.
- **Programado:** el primer contrato empieza en una fecha futura; no se cuenta como activo.
- **Vencido:** terminó un período y hoy no hay otro vigente, incluso si existe una renovación que comienza más adelante.
- **Sin plan registrado:** no hay pagos confirmados. El administrador principal conserva el alta/configuración inicial; el personal requiere pago vigente. V14 no inventa contratos ni vencimientos para negocios nunca contratados.

Seleccionar S/35 en el formulario no registra el pago. Debes completar referencia, inicio, fin y confirmación de recepción. Un pago del 13/11/2026 al 13/11/2026 solo cubre ese día; el 12/11 está programado. No se amplía automáticamente a un mes ni se corrigen contratos históricos suponiendo fechas. Los períodos no pueden superponerse y las fechas de calendario se devuelven como AAAA-MM-DD, sin convertirlas a medianoche UTC.

## Recordatorios y pago

En **Pagos y planes → Recordatorios y renovación**, SUPERADMIN configura las instrucciones de pago (contacto, cuenta, Yape u otro texto verificado). No hay cobros automáticos ni pasarela.

La tarea programa una revisión a las **00:05 en America/Lima** y también al arrancar el servidor. Genera un aviso interno diario de D-5 a D-0 inclusive, con clave única por empresa/pago/fecha. Repetir la tarea o ejecutarla desde varias instancias no duplica avisos. El botón **Revisar vencimientos ahora** permite verificarla manualmente. El servidor debe permanecer ejecutándose para emitir cada día; al reiniciar comprueba el día actual, sin inventar avisos de días pasados.

El usuario ve un aviso en el panel y una sección **Notificaciones** con historial y las instrucciones. El aviso se consulta al entrar, volver a la pestaña y cada 15 minutos. Una renovación que cubre el día inmediatamente posterior al vencimiento marca los recordatorios anteriores como resueltos y evita seguir recordando ese período. Una renovación con hueco de fechas no oculta el riesgo del vencimiento previo.

**Canal implementado: sistema interno.** No se envían correos ni WhatsApp; esos canales requieren sus respectivos proveedores y configuración. El texto de pago se representa como texto, no HTML ejecutable.

## Bloqueo y renovación

La fecha final da acceso hasta las 23:59:59 de Perú. Desde las 00:00 del día siguiente, si no hay un período vigente, la cuenta queda bloqueada para **todo el personal, incluido el administrador principal**. El acceso también se comprueba en cada petición: no depende de que el cron haya corrido exactamente a medianoche.

Después de validar la contraseña, el login de una membresía vencida devuelve HTTP 402 y la pantalla:

> Tu membresía ha vencido. Por favor realiza el pago para restablecer el servicio.

Incluye las instrucciones de pago. Una sesión abierta se invalida en su siguiente petición; la interfaz muestra la misma pantalla. Con contraseña incorrecta no se revela información de la membresía. El primer período futuro muestra una pantalla de membresía programada.

Registrar un pago confirmado que cubra hoy restablece la membresía; el usuario vuelve a iniciar sesión. No se borran datos. El bloqueo de suscripción es independiente de `empresas.estado`: pagar no retira una suspensión manual de SuperAdmin, ni activa usuarios desactivados, ni cambia roles/permisos. SUPERADMIN mantiene acceso para gestionar renovaciones.

## Configuración técnica

Tarea: `SuscripcionScheduler`. Expresión predeterminada `0 5 0 * * *`, zona fija America/Lima. Puede sobrescribirse con la propiedad Spring `app.suscripciones.cron` o variable `APP_SUSCRIPCIONES_CRON`. El valor `-` desactiva solo la programación periódica; permanecen la revisión al inicio y las comprobaciones de acceso.

V14 añade campos de rubro, indicador de bloqueo de suscripción, configuración de cobranza y avisos con restricción única. Usa los pagos confirmados existentes, sin cambiar su vigencia. Cada revisión de empresa es transaccional y toma el mismo bloqueo de empresa que el registro de pagos. El indicador almacenado permite seguimiento de la revisión; el control real de acceso consulta las fechas vigentes para evitar un indicador desactualizado.

Pruebas: reloj controlado al límite de día de Perú, seis avisos sin duplicados, renovación y suspensión manual; API con sesiones/contraseñas, estados/importes, rubros por local, copia e imágenes, concurrencia del cron y permisos; navegador con formularios, bloqueo, renovación y accesibilidad. La actualización V13→V14 se comprobó en una copia, conservando registros originales de 29 tablas y permitiendo únicamente las nuevas plantillas/rubros previstos.
