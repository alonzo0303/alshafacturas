# Planes, personal, catálogo y compras

## Activación y pagos

SUPERADMIN dispone de **Pagos y planes**. Selecciona el negocio, el plan, las fechas de inicio y fin y una referencia del pago recibido. Debe confirmar que verificó el pago. El sistema no hace cargos ni verifica depósitos bancarios automáticamente. No se ha fijado periodicidad mensual: la vigencia es la ingresada por la plataforma.

| Importe por período registrado | Cuentas incluidas |
| --- | --- |
| S/35 | Administrador principal + 2 empleados |
| S/50 | Administrador principal + 3 empleados |
| S/70 | Administrador principal + empleados ilimitados |

Todas las cuentas activas adicionales ocupan un cupo, incluso otros administradores. El administrador principal es el primer administrador registrado; el administrador del negocio no puede desactivar su cuenta ni cambiar su rol. SUPERADMIN puede desactivarla y transferir la titularidad a otro ADMIN activo antes de cambiar su rol o eliminarla. Crear o reactivar personal comprueba los cupos en el servidor, con bloqueo de empresa para evitar superar el límite mediante solicitudes simultáneas. Los períodos de pagos no pueden superponerse. Las nuevas desactivaciones reservan su cupo durante 15 días; la reactivación durante ese plazo recupera el mismo cupo. La eliminación permanente confirmada por SUPERADMIN libera el cupo antes. Después de 15 días vence la reserva, pero la cuenta permanece desactivada hasta su eliminación manual. Las cuentas inactivas anteriores a esta actualización no reciben una reserva retroactiva. Para bajar de plan, deben caber tanto cuentas activas como reservas vigentes.

La migración conserva los usuarios existentes y no inventa pagos anteriores. Antes del primer contrato, el administrador principal conserva el alta inicial y el personal no puede ingresar. Una vez registrado un contrato, sin período vigente se bloquean todos los accesos del negocio, incluido el principal; se distingue plan futuro de vencido y se restablece al confirmar una renovación vigente. Las sesiones abiertas se invalidan en su siguiente petición. Ver [rubros y suscripciones](RUBROS_SUSCRIPCIONES.md). El propietario ve cupos, importe y fechas en **Mi plan** y **Usuarios**. El registro de pagos queda reservado a SUPERADMIN.

## Funciones y permisos

Administrador tiene gestión completa; Vendedor registra ventas, gestiona clientes y consulta productos e inventario; Almacenero gestiona productos y ajustes de inventario; Compras gestiona productos, compras y consulta inventario. El administrador puede crear roles personalizados y asignarlos a empleados. Solo el administrador gestiona usuarios, roles y configuración. Los permisos se comprueban en cada solicitud; una pestaña abierta debe recargarse para reflejar cambios del menú.

## Productos comunes y mercancía propia

SUPERADMIN administra **Catálogo común**: nombre, marca, rubro, descripción y disponibilidad. Incluye plantillas genéricas iniciales para maquillaje, ferretería y abarrotes. Las plantillas pueden proponer una marca, con Genérico como valor predeterminado. No fijan precios, existencias ni códigos de fabricantes.

Una vez que SUPERADMIN habilita sus rubros desde Empresas, el negocio elige una plantilla y completa su precio, marca (inicialmente la de la plantilla, o **Genérico**), presentación o variante y código de barras. Se crea una copia propia: modificarla no altera la plantilla ni otros negocios. Se pueden crear varios productos de una plantilla, por ejemplo colores o marcas. Los códigos de barras y SKU son únicos dentro de cada negocio; el SKU se genera cuando se deja vacío.

En **Registrar compra** se puede crear mercancía y añadirla al detalle sin pasar por Productos. Guardar el producto no ingresa existencias: confirmar la compra registra el movimiento. Un producto sin precio de venta puede recibir compras, pero no venderse hasta definirlo. El costo se ingresa explícitamente y no se toma del precio de venta. El último costo neto es una referencia, no una asignación automática.

## IGV de precios y crédito fiscal

En productos gravados, S/118 de precio final equivale a S/100 sin IGV + S/18 de IGV. Se puede ingresar el precio con o sin IGV; el sistema guarda el precio final y lo muestra explícitamente. Exonerado e inafecto tienen IGV cero. La configuración predeterminada aplica a nuevos productos y no modifica ventas anteriores.

Las compras distinguen costo con o sin IGV y documento interno, factura o boleta. Para marcar **crédito fiscal potencial** se exige compra gravada, factura y RUC del proveedor y del negocio. Esa marca no acredita por sí sola derecho al crédito: deben revisarse los requisitos sustanciales y formales, comprobante, registro y uso del bien o servicio. Consulta [SUNAT: crédito fiscal](https://orientacion.sunat.gob.pe/3111-06-credito-fiscal).

**IGV y compras** separa el IGV de ventas registradas, el de ventas aceptadas con CDR de producción, el de compras y el crédito potencial marcado. No constituye declaración tributaria ni calcula automáticamente el impuesto a pagar. Las notas internas no son comprobantes fiscales. Los nuevos XML con líneas exoneradas/inafectas se verifican localmente; no se ha obtenido aceptación externa para estas variantes.

## Escaneo y pantallas

Se puede buscar por código de barras o SKU, usar un lector USB/Bluetooth que escriba y pulse Enter, escanear con cámara o elegir una foto. El procesamiento de imágenes ocurre en el dispositivo. La cámara en vivo requiere HTTPS o localhost y permiso del navegador. Al abrir desde otro teléfono por una IP HTTP, usa HTTPS o la alternativa de foto/lector. Un código desconocido permite crear la mercancía en Compras; no se consulta una base externa de productos por código.

El diseño se comprueba en navegador con anchos de 320, 768, 1024 y 1440 px; las tablas anchas tienen desplazamiento interno. La cámara y el lector físicos necesitan una comprobación en los equipos que se usarán. El stock en o bajo el mínimo se señala en rojo y con texto, y los encabezados numéricos se alinean con sus valores.
