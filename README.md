# AlshaFacturas

Sistema empresarial con React, TypeScript, Spring Boot 4.1, Java 21 y PostgreSQL 17.

Esta versión integra la gestión de empresas y usuarios con productos, clientes, compras, inventario, ventas y un conector directo de SUNAT pendiente de activación real. Los datos se guardan en PostgreSQL; no utiliza cuentas ni ventas simuladas en la aplicación.

## Funciones disponibles

- SUPERADMIN creado mediante variables de entorno. Alta transaccional de empresa con su primer administrador; activación y suspensión.
- Sesiones HTTP, BCrypt, protección CSRF y cierre de sesión. La suspensión de una empresa o desactivación de un usuario revoca el acceso de sus sesiones en la siguiente solicitud.
- ADMIN: catálogo, precios, usuarios, inventario, compras, ventas, reportes y datos de empresa. VENDEDOR: ventas, clientes y consulta del catálogo para vender.
- Productos editables, SKU único por empresa, activación/desactivación y alerta de stock mínimo.
- Clientes con DNI o RUC; edición y búsqueda.
- Compras con proveedor, referencia y detalle; ingreso automático de existencias. No registra cuentas por pagar.
- Ajustes de inventario justificados e historial de movimientos.
- POS, cliente opcional, pago registrado como efectivo/tarjeta/transferencia, correlativo interno, cálculo de IGV y validación de stock en el servidor.
- Anulación interna con devolución de existencias, una sola vez. Reintentos de ventas y compras con clave de idempotencia.
- Notas de venta imprimibles y guardado como PDF desde el navegador. Reportes de ventas y compras exportables a CSV.
- Aislamiento por empresa, rutas protegidas, estados de carga/error/vacío y diseño adaptable.

## Conexión directa con SUNAT

Se implementó el envío directo de facturas UBL 2.1 y resúmenes de boletas, firma RSA-SHA256 con certificado `.p12`, tickets y CDR, con estados y correlativos separados para BETA y PRODUCCIÓN. Consulta la [guía de configuración SUNAT](docs/SUNAT.md).

**La activación y aceptación reales siguen pendientes de las credenciales SOL, el certificado y las pruebas del emisor.** No se ha enviado ningún documento real a SUNAT. Las pruebas automáticas habituales usan certificados temporales y respuestas simuladas. En una prueba optativa de red, SUNAT beta aceptó una factura ficticia con código 0; el resumen de boleta no obtuvo respuesta antes del timeout. Consulta la [evidencia de beta](docs/evidencias/sunat-beta/README.md). Esto no acredita aceptación en producción.

Las notas NV01 son internas. Las solicitudes de factura/boleta se preparan y envían desde Facturación electrónica después de configurar la empresa en el servidor. La aplicación conserva XML/CDR; un resultado BETA nunca tiene validez tributaria. La nota imprimible incluida sigue siendo interna. No están implementados QR/PDF fiscal, recuperación automática de CDR perdido, corrección de documentos rechazados ni notas de crédito/bajas. Por ello aún no corresponde operar fiscalmente en producción.

Se asume moneda PEN, productos por unidades enteras y precios gravados con IGV incluido del 18%. Otros regímenes, exoneraciones, descuentos, detracciones, notas de crédito, guías y múltiples almacenes requieren reglas adicionales. El medio de pago registra información; no cobra mediante un banco o pasarela.

No incluye cobro de suscripciones SaaS, recuperación/cambio de contraseña, MFA ni un servicio de soporte. Las listas de ventas, compras y movimientos muestran las últimas 500 operaciones; el resumen considera todo el historial. Consulta [pendientes de producción](docs/PRODUCCION.md).

## Requisitos

Java **JDK** 21, Maven 3.9+, Node.js 24, npm y Docker con Compose. En Windows usa PowerShell y `npm.cmd` si tu política de ejecución bloquea `npm.ps1`.

## Arranque con Docker

Desde la raíz del repositorio:

1. Copia `.env.example` como `.env`. Define `DB_PASSWORD`, `SUPERADMIN_CORREO` y `SUPERADMIN_PASSWORD` (12 a 72 bytes UTF-8). Mantén el archivo privado. En PowerShell: `Copy-Item .env.example .env`; en Bash: `cp .env.example .env`.
2. Compila el backend con `mvn -f backend/pom.xml -DskipTests package`. Las pruebas de contexto necesitan una base de datos: se ejecutan en el paso 5. Este comando produce el JAR que copiará Docker.
3. Instala el frontend con `npm ci --prefix frontend` y compílalo con `npm run build --prefix frontend`. Docker copiará `frontend/dist` al servidor web.
4. Ejecuta `docker compose up --build -d`. El volumen `postgres_data` conserva los datos entre reinicios. No uses `docker compose down -v` si necesitas conservarlos.
5. Abre `http://localhost:8088/admin/login`. Ingresa con el SUPERADMIN configurado. Después de crearlo, cambia `APP_BOOTSTRAP_SUPERADMIN_ENABLED=false` y recrea el backend con `docker compose up -d backend`. El arranque es idempotente para el mismo SUPERADMIN activo; no cambia contraseñas existentes.
6. Crea una empresa con su administrador. Cierra sesión y entra por `/login` con su RUC, correo y contraseña. Registra productos y una compra o un ajuste inicial antes de vender.

Los contenedores de aplicación no instalan dependencias durante la construcción. Tras cambiar código, repite la compilación correspondiente y `docker compose up --build -d`.

## Desarrollo local

Inicia PostgreSQL, crea la base `alshafacturas_db` y el usuario `alshafacturas_app`. No expongas la base de datos a Internet. El backend lee `DB_PASSWORD`, opcionalmente `DB_URL` y `DB_USER`. Para crear el SUPERADMIN en el primer arranque, exporta también las variables de la plantilla. Maven/Spring no leen automáticamente el `.env` de Compose.

En una terminal dentro de `backend`: `mvn spring-boot:run`. En otra, dentro de `frontend`: `npm ci` y `npm run dev`. Abre `http://localhost:5173`. Vite redirige `/api` al backend en el puerto 8080; en despliegue Nginx hace lo mismo. Se usa el mismo origen para cookies y CSRF.

## Verificación

- `mvn -f backend/pom.xml verify`: compila y prueba el arranque, con las variables de conexión a una PostgreSQL de prueba.
- `npm run build --prefix frontend`: TypeScript y compilación de producción.
- `npm run lint --prefix frontend`: comprobación estática de React y TypeScript.
- `python tests/test_api.py`: pruebas de API con `TEST_API_URL` (por defecto `http://127.0.0.1:8080/api`), `TEST_SUPERADMIN_EMAIL` y `TEST_SUPERADMIN_PASSWORD`.
- Dentro de `frontend`, `npx playwright install chromium` y `npx playwright test`: pruebas de interfaz con `TEST_WEB_URL` (por defecto `http://127.0.0.1:5173`) y las mismas credenciales de pruebas.

**Ejecuta las pruebas de API y navegador solo en una instancia de prueba desechable.** Crean empresas, usuarios y operaciones. No limpian datos de una instancia compartida. No llevan credenciales de producción en el código.

La CI configura PostgreSQL e instancias de prueba aisladas. No publica el sistema ni modifica bases externas.
