-- Los pagos anteriores conservan importe, vigencia y cupos contratados.
ALTER TABLE pagos_suscripcion ADD COLUMN limite_empleados INTEGER;
UPDATE pagos_suscripcion SET limite_empleados=CASE plan WHEN 'INICIO' THEN 2 WHEN 'EQUIPO' THEN 3 ELSE -1 END;
ALTER TABLE pagos_suscripcion ALTER COLUMN limite_empleados SET NOT NULL;
ALTER TABLE pagos_suscripcion DROP CONSTRAINT pagos_suscripcion_importe_check;
ALTER TABLE pagos_suscripcion ADD CONSTRAINT pago_tarifa_cupos CHECK (
 (plan='INICIO' AND ((importe=35 AND limite_empleados=2) OR (importe=30 AND limite_empleados=1))) OR
 (plan='EQUIPO' AND ((importe=50 AND limite_empleados=3) OR (importe=45 AND limite_empleados=2))) OR
 (plan='ILIMITADO' AND importe IN (60,70) AND limite_empleados=-1)
);
