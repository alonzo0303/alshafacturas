-- Una compra final pertenece como máximo a una OC y al mismo negocio/local.
CREATE UNIQUE INDEX uk_oc_compra_final ON ordenes_compra(compra_id) WHERE compra_id IS NOT NULL;
ALTER TABLE ordenes_compra ADD CONSTRAINT fk_oc_compra_local
 FOREIGN KEY(empresa_id,local_id,compra_id) REFERENCES compras(empresa_id,local_id,id);
ALTER TABLE ordenes_compra ADD CONSTRAINT oc_recepcion_coherente
 CHECK ((estado='RECIBIDA' AND compra_id IS NOT NULL) OR (estado<>'RECIBIDA' AND compra_id IS NULL));
