CREATE TABLE rubros_catalogo (nombre VARCHAR(100) PRIMARY KEY);
INSERT INTO rubros_catalogo(nombre) SELECT DISTINCT rubro FROM catalogo_comun;
CREATE TABLE empresa_rubros_catalogo (
 empresa_id BIGINT NOT NULL REFERENCES empresas(id),
 rubro VARCHAR(100) NOT NULL REFERENCES rubros_catalogo(nombre),
 PRIMARY KEY(empresa_id,rubro)
);
CREATE TABLE fotos_productos (
 producto_id BIGINT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
 contenido BYTEA NOT NULL, version UUID NOT NULL
);
CREATE TABLE fotos_catalogo (
 catalogo_id BIGINT PRIMARY KEY REFERENCES catalogo_comun(id) ON DELETE CASCADE,
 contenido BYTEA NOT NULL, version UUID NOT NULL
);
