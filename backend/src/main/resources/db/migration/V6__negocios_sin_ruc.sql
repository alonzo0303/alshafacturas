-- La identificación interna sigue siendo empresas.id. No se inventan RUC fiscales.
ALTER TABLE empresas ALTER COLUMN ruc DROP NOT NULL;
UPDATE empresas SET ruc=NULL WHERE btrim(ruc)='';
ALTER TABLE empresas ADD CONSTRAINT chk_empresas_ruc_formato CHECK(ruc IS NULL OR ruc ~ '^[0-9]{11}$');
CREATE INDEX ix_usuarios_correo_activo ON usuarios(correo) WHERE activo=true;
