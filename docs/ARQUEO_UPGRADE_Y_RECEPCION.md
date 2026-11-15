# Arqueo, permisos, upgrades y recepción

## Caja

Una caja abierta en una fecha anterior de Perú bloquea nuevas operaciones de escritura del responsable en el servidor, incluso si trabaja en otro local. Se permiten lectura, autenticación/salida, selección de local y cierre/comentario para resolver la pendiente. La interfaz consulta al entrar y cada 30 segundos; un rechazo de operación también dispara el modal obligatorio. Una caja abierta de hoy no impide trabajar. El administrador puede resolver cajas del personal desde Caja y cierres.

Saldo esperado = fondo + ventas confirmadas EFECTIVO + ingresos registrados − egresos registrados. Tarjeta y transferencia no cuentan como efectivo. Ante cualquier diferencia, positiva o negativa, se exige comentario de hasta 1000 caracteres, sin aceptar espacios. El botón de cierre permanece deshabilitado hasta completar monto válido y explicación; el servidor recalcula y valida dentro de la transacción.

`caja_movimientos` conserva empresa/local/caja, tipo INGRESO/EGRESO, importe positivo, motivo obligatorio, autor original/nombre, fecha y clave de idempotencia. Son movimientos ejecutados de inmediato por el responsable habilitado o administrador; no se introduce un proceso de solicitudes/aprobaciones. No se permiten egresos superiores al efectivo esperado ni movimientos en cajas cerradas. Reintentos idénticos no duplican movimientos; una clave con datos distintos se rechaza. Se conservan todas las diferencias y comentarios históricos.

## Permisos

El rol VENDEDOR ya tenía PRODUCTOS_VER e INVENTARIO_VER en el servidor. La vista ATENCION omitía las rutas de Productos e Inventario: ahora también las muestra al tener permiso. Se verifica que un vendedor nuevo reciba ambos permisos al iniciar sesión. Se mantiene la configuración visual heredada del negocio: un módulo que el administrador ocultó para todos sigue oculto.

COMPRAS_RECIBIR es un permiso explícito de recepción (predeterminado para Administrador y Almacenero). Permite revisar órdenes del local y recibirlas aunque las haya creado Compras. No concede acceso a otras empresas/locales ni a ventas ajenas. No permite crear/cancelar órdenes ajenas. COMPRAS_GESTIONAR conserva el registro de pedidos y consulta propia; puede añadirse COMPRAS_RECIBIR a un rol que también deba recibir.

## Upgrade inmediato

SuperAdmin selecciona negocio y plan superior, calcula la diferencia y confirma referencia y recepción real del pago. La cotización usa la fecha de Perú y se recalcula al confirmar. Diferencia = (tarifa nueva − tarifa vigente) × días restantes / días del ciclo, con extremos incluidos, redondeada a dos decimales HALF_UP. Ejemplo de ciclo de 30 días, cinco transcurridos: (45−30)×25/30 = S/12,50.

`upgrades_suscripcion` vincula el pago original con plan anterior/nuevo, tarifa, cupos, cobro adicional, desde/hasta, referencia, actor, fecha y clave de idempotencia. No modifica el cobro original, su período ni renovaciones futuras. El plan efectivo y cupos se consultan inmediatamente con el último upgrade del pago vigente. No sirve para bajar de plan, editar retrospectivamente cobros o mover una renovación futura; estos cambios requieren otro flujo. El importe adicional no se presenta como tarifa mensual completa.

## Compras

Todo POST /compras y /ordenes-compra genera una OC correlativa `OC-00000001` con referencia obligatoria de cotización/pedido del proveedor. Guarda creador, fecha/hora, artículos y costos acordados, pero no modifica existencias ni último costo. Compras muestra las OC pendientes y los ingresos completados. Las órdenes existentes conservan estados internos PENDIENTE / RECIBIDA / CANCELADA y la UI usa «Pendiente de recepción» / «Recibido / Completado».

Al recibir se presentan los artículos acordados, se exige número de guía o factura y confirmación de conformidad física. Si no coincide, no se confirma: esta versión no procesa recepciones parciales. La transacción crea compra_detalles, actualiza stock y costo, registra movimientos de inventario y marca la OC recibida, una sola vez. El comprador original y su fecha se conservan; recibido_por_original_id, recibido_nombre y recibido_en identifican al receptor, además de documento_recepcion y orden_numero. Los movimientos de inventario llevan la fecha efectiva de recepción y su actor.

Los documentos adjuntos de la OC se conservan vinculados y son consultables desde la compra recibida. El número del documento de recepción no reemplaza la referencia de cotización. Compras históricas anteriores a este flujo no reciben autores, documentos o números de OC inventados.

## Migración

V20 añade caja_movimientos y upgrades_suscripcion; añade documento y auditoría de recepción a ordenes_compra/compras y orden_numero en compras. Reutiliza los artículos JSON de la OC, compra_detalles y movimientos de inventario existentes. No duplica stock ni transforma compras antiguas en pendientes.
