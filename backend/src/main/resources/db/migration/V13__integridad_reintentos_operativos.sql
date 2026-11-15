ALTER TABLE pedidos ADD COLUMN cobro_idempotencia UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE ordenes_compra ADD COLUMN recepcion_idempotencia UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE pedidos ADD CONSTRAINT chk_pedido_mesa CHECK((clase='MESA' AND mesa_id IS NOT NULL) OR (clase='PREPARACION' AND mesa_id IS NULL));
ALTER TABLE pedidos ADD CONSTRAINT chk_pedido_cobrado CHECK((estado='COBRADO')=(venta_id IS NOT NULL));
CREATE UNIQUE INDEX uk_pedido_venta ON pedidos(venta_id) WHERE venta_id IS NOT NULL;
