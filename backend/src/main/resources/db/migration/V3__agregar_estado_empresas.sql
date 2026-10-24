
-- Agregar el estado de las empresas al sistema SaaS.
-- Las empresas existentes conservaran su acceso.

ALTER TABLE empresas
ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA';

-- Las empresas nuevas quedaran pendientes de aprobacion.
-- El backend asignara PENDIENTE al registrarlas.

ALTER TABLE empresas
ADD CONSTRAINT chk_empresas_estado
CHECK (estado IN ('PENDIENTE', 'ACTIVA', 'SUSPENDIDA'));
