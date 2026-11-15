ALTER TABLE usuarios
    ADD COLUMN modalidad VARCHAR(20) NOT NULL DEFAULT 'COMERCIO',
    ADD COLUMN tipo_atencion VARCHAR(20);

ALTER TABLE usuarios ADD CONSTRAINT usuarios_visualizacion_valida CHECK (
    (modalidad = 'COMERCIO' AND tipo_atencion IS NULL)
    OR (modalidad = 'ATENCION' AND tipo_atencion IS NOT NULL
        AND tipo_atencion IN ('RESTAURANTE', 'BARBERIA', 'OTROS_SERVICIOS'))
);
