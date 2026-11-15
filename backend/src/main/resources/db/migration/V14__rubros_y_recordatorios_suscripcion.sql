INSERT INTO rubros_catalogo(nombre) VALUES ('Barbería'),('Restaurante'),('Spa'),('Abarrotes'),('Ferretería') ON CONFLICT DO NOTHING;
ALTER TABLE empresas ADD COLUMN rubro_negocio VARCHAR(100) REFERENCES rubros_catalogo(nombre);
ALTER TABLE locales ADD COLUMN rubro_negocio VARCHAR(100) REFERENCES rubros_catalogo(nombre);
ALTER TABLE empresas ADD COLUMN suscripcion_bloqueada BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE configuracion_cobranza (
 id INTEGER PRIMARY KEY CHECK(id=1), instrucciones VARCHAR(1500) NOT NULL,
 actualizado TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO configuracion_cobranza(id,instrucciones) VALUES (1,'Contacta con la administración de AlshaFacturas para realizar el pago. El servicio se restablece cuando la plataforma confirma un pago vigente.');
CREATE TABLE avisos_suscripcion (
 id BIGSERIAL PRIMARY KEY, empresa_id BIGINT NOT NULL REFERENCES empresas(id),
 pago_id BIGINT NOT NULL REFERENCES pagos_suscripcion(id), fecha DATE NOT NULL,
 vence DATE NOT NULL, dias_restantes INTEGER NOT NULL CHECK(dias_restantes BETWEEN 0 AND 5),
 creado TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, resuelto BOOLEAN NOT NULL DEFAULT false,
 UNIQUE(empresa_id,pago_id,fecha)
);
CREATE INDEX avisos_suscripcion_empresa_fecha ON avisos_suscripcion(empresa_id,fecha DESC,id DESC);
INSERT INTO catalogo_comun(nombre,rubro,descripcion,activo,marca,clase,duracion_minutos)
SELECT nombre,rubro,'Plantilla base; cada negocio define su precio y presentación.',true,'Genérico','SERVICIO',duracion
FROM (VALUES ('Corte de cabello','Barbería',30),('Afeitado','Barbería',15),('Masaje relajante','Spa',60),('Limpieza facial','Spa',45),('Plato del día','Restaurante',0)) AS t(nombre,rubro,duracion)
WHERE NOT EXISTS (SELECT 1 FROM catalogo_comun c WHERE c.nombre=t.nombre AND c.rubro=t.rubro);
