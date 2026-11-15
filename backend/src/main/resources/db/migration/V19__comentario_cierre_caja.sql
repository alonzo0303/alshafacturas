-- No se inventan motivos para cierres anteriores ni se cambian sus importes.
ALTER TABLE cajas ADD COLUMN comentario_cierre VARCHAR(1000);
ALTER TABLE cajas ADD COLUMN comentado_por_original_id BIGINT;
ALTER TABLE cajas ADD COLUMN comentado_nombre VARCHAR(150);
ALTER TABLE cajas ADD COLUMN comentado_en TIMESTAMPTZ;
ALTER TABLE cajas ADD CONSTRAINT comentario_caja_no_vacio CHECK(comentario_cierre IS NULL OR length(btrim(comentario_cierre))>0);
