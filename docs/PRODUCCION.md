# Antes de operar en producción

## Emisión electrónica: conexión directa elegida

Se implementó la conexión directa al SEE del Contribuyente. No se requiere contratar un proveedor para utilizar este conector, pero debe verificarse que el emisor pueda operar bajo este sistema. Los datos SOL, certificado y configuración real del emisor están pendientes.

Consulta [SUNAT.md](SUNAT.md) para el alcance, la configuración y los pendientes fiscales. Antes de producir comprobantes válidos se requieren pruebas reales de estructura y aceptación, reglas del emisor, representación fiscal y resolución de excepciones (CDR perdido, rechazo, notas de crédito/bajas). Las pruebas simuladas no sustituyen una aceptación oficial. No se ha enviado ningún documento real en este trabajo.

## Infraestructura y operación

- Dominio y HTTPS. Compose escucha solo en 127.0.0.1:8088 para quedar detrás de un proxy HTTPS. Configura `COOKIE_SECURE=true` al servir con HTTPS. La configuración incluida no provee certificado ni DNS.
- Secretos propios, copias de seguridad cifradas y prueba de restauración de PostgreSQL. Conservar el volumen al recrear contenedores. Revisar rotación, retención, monitorización y alertas.
- Servicio de correo y recuperación autónoma antes de invitar usuarios externos. SUPERADMIN ya puede restablecer contraseñas y existe un límite de acceso por cuenta/IP en cada instancia. Para varias instancias o un proxy compartido, añadir límite distribuido en la entrada y configurar el origen confiable; definir MFA.
- Aceptación de negocio: régimen tributario, catálogo, saldos iniciales, inventario por unidades y reglas de IGV 18%. Revisar roles y permisos con cada empresa.
- Los planes S/35, S/50 y S/70 y sus períodos/cupos se registran manualmente. La pasarela de cobro y los webhooks verificados están pendientes.
- Confirmar políticas de privacidad, condiciones de servicio, soporte, auditoría y responsable de operación.

## Diseño técnico actual

Se preservan Spring Security, JPA, Flyway y React del repositorio. La operación comercial usa `JdbcTemplate` con consultas parametrizadas dentro de transacciones Spring sobre la misma PostgreSQL. Los catálogos y operaciones siempre filtran por la empresa obtenida de la sesión, no por una empresa enviada por el cliente.

Las escrituras que afectan stock bloquean la fila de la empresa durante la transacción. Esto serializa ventas/compras/ajustes de una empresa y evita sobreventa y correlativos duplicados; otras empresas pueden operar en paralelo. Es una decisión adecuada para esta primera versión. Una carga elevada requerirá medir y migrar a bloqueos por producto y correlativo con orden consistente.

`POST /api/ventas` y `POST /api/compras` requieren un UUID de idempotencia. Repetir la misma solicitud con la misma clave devuelve la operación original. La anulación es idempotente y requiere ADMIN. El Kardex conserva el nombre actual del producto; las líneas de venta conservan nombre, SKU y precio del momento de la venta.

El resumen muestra datos de todo el historial. Los listados operativos se limitan a 500 filas; para contabilidad o exportaciones masivas se requiere paginación e informes históricos completos. No presentar el CSV limitado como libro tributario.
