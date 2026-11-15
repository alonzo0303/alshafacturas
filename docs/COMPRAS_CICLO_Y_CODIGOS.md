# Compras: pasos, documentos y códigos

## Flujo visual

1. **Registrar compra**: pedido al proveedor. El aviso «Orden de compra automática» explica que guardar asigna el correlativo real OC, conserva referencia de cotización/pedido y todavía no suma stock. Después de guardar se muestra el número y un enlace para abrir esa OC.
2. **Órdenes y recepción**: listado único del ciclo. Muestra OC, compra final vinculada, estado, proveedor, referencia, comprador y receptor con fecha/hora de Perú. Permite abrir ambos documentos. Recibir exige verificación física y documento de entrega.
3. **Compras recibidas**: el mismo listado con filtro inicial Recibido/Completado. No es otro conjunto desconectado. Se puede cambiar el filtro para consultar todo el ciclo.

El menú usa estos números en comercio y atención, y la cabecera resalta el paso activo. Los permisos siguen aplicándose: recepción puede consultar pasos 2/3; registrar pedidos requiere Compras. Los módulos mantienen la apariencia heredada del negocio.

## Integridad de datos

`ordenes_compra.compra_id` vincula la OC con su compra final. V21 añade índice único parcial por compra final, FK compuesta empresa/local/compra y CHECK de coherencia: RECIBIDA requiere compra_id y los otros estados no deben tenerlo. No se duplican artículos ni movimientos ni se vuelven a ingresar existencias históricas.

`GET /compras-ciclo` devuelve una fila por OC, tenga o no compra final. Agrega las compras anteriores sin OC como «Compra histórica sin OC», únicamente si no están ya vinculadas. No intenta emparejar documentos por proveedor, importe o referencia y no inventa correlativos históricos. Mantiene aislamiento por empresa, local y permisos de autor/recepción. Ambos accesos de la interfaz usan esta consulta; los endpoints anteriores siguen disponibles.

## Código de barras

Se conserva `productos.codigo_barras` (hasta 80 caracteres) y su unicidad por empresa/local. El código actual se muestra en carrito, OC/recepción y detalle de compra; no se duplica como un dato de cada compra. El editor permite escritura, lector USB/Bluetooth (entrada de teclado + Enter), cámara o lectura desde imagen. Escanear rellena el campo; guardar requiere confirmación explícita. La imagen de lectura no se guarda como foto del producto.

`PATCH /productos/{id}/codigo-barras` modifica exclusivamente el código, registra auditoría y conserva cantidades, precios, costos, OC y stock. Requiere autorización de edición de productos o compras; un usuario solo de recepción debe indicar una OC/compra autorizada que contenga ese producto. Comprueba código anterior para impedir sobrescrituras de cambios de otra sesión; reintentos con el mismo código no duplican cambios. Duplicados en el local se rechazan; se conservan ceros iniciales y se rechazan controles y códigos vacíos.

El barcode se puede actualizar antes o después de recibir, pero eso no confirma recepción ni cambia el arqueo de inventario. La recepción conserva su operación transaccional e idempotente del flujo anterior.

Las OC antiguas que solo conservan líneas del pedido pueden mostrar el nombre y código actuales del producto junto a las cantidades y costos originales. La consulta no reescribe su JSON histórico.
