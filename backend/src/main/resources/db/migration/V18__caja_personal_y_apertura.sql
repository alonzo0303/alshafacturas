CREATE TABLE accesos_caja (
 empresa_id BIGINT NOT NULL REFERENCES empresas(id),
 local_id BIGINT NOT NULL REFERENCES locales(id),
 usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 habilitada BOOLEAN NOT NULL,
 fondo_asignado NUMERIC(11,2) CHECK(fondo_asignado BETWEEN 0 AND 999999999.99),
 actualizado TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(empresa_id,local_id,usuario_id)
);
ALTER TABLE cajas ADD COLUMN abierto_por_original_id BIGINT;
ALTER TABLE cajas ADD COLUMN abierto_nombre VARCHAR(150);
UPDATE cajas SET abierto_por_original_id=usuario_original_id,abierto_nombre=usuario_nombre;
CREATE INDEX cajas_abiertas_personal ON cajas(empresa_id,usuario_original_id,local_id) WHERE estado='ABIERTA';
