# Revisión de seguridad de operación

Fecha de revisión: 12 de noviembre de 2026 (America/Lima). Alcance: revisión de código de autenticación, filtros, controladores y operaciones comerciales; pruebas de API y navegador sobre PostgreSQL desechable. No se accedió a bases de clientes, no se emitieron documentos reales SUNAT y no se desplegó infraestructura. Esta revisión no constituye una certificación ni una prueba de penetración independiente.

## 1. Sesiones y aislamiento

**Hallazgo corregido:** el contexto de seguridad cargado de HttpSession se modificaba al refrescar usuario/local. Solicitudes simultáneas podían compartir ese objeto mutable. `AccesoEmpresaFilter` crea ahora un contexto propio por solicitud. Se vuelve a comprobar estado de usuario/empresa, versión de credenciales, permisos y local autorizado. La cabecera X-Local-Id rechaza escrituras de pestañas desactualizadas.

**Verificación:** 48 peticiones concurrentes de una misma sesión alternando locales; respuestas consistentes con el local solicitado o rechazo 409. Pruebas cruzadas por ID de compras, órdenes, pedidos, imágenes, adjuntos, cajas y documentos fiscales. Los endpoints administrativos solo aceptan SUPERADMIN; los de negocio usan empresa de sesión y local autorizado.

## 2. Credenciales y fuerza bruta

**Hallazgo corregido:** el restablecimiento aceptaba contraseñas compuestas únicamente por espacios, mientras el ingreso las rechazaba. Se validan contenido, longitud y límite BCrypt de 72 bytes UTF-8. Se utiliza el mismo PasswordEncoder BCrypt del login. Cada cambio real de acceso incrementa la versión de credenciales y revoca sesiones previas. Nunca se devuelve el hash ni la contraseña.

Se incorporó límite en memoria por cuenta (10) e IP remota (100) para intentos fallidos o en curso en ventana de 15 minutos. Las reservas de peticiones en curso evitan saltarlo con solicitudes paralelas. Máximo de 10 000 entradas de control, con expiración y respuesta 429/Retry-After. El restablecimiento real por SUPERADMIN libera el bloqueo de cuenta; no borra el límite global de IP. No se confía en X-Forwarded-For enviado por el cliente.

**Verificación:** contraseñas vacías/espacios y Unicode demasiado largo, cambio seguido de nuevo login, revocación de sesiones, bloqueo y desbloqueo de cuenta, pruebas unitarias de expiración/concurrencia. No existe recuperación autónoma por correo ni MFA. El límite es por proceso: varias réplicas requieren coordinación distribuida o protección en proxy; detrás de un proxy todas las conexiones pueden compartir la IP de entrada hasta configurarlo correctamente.

## 3. Autorización y ciclo de vida

Se mantienen CSRF en escrituras, cambio de identificador de sesión al autenticar y cookies HttpOnly/SameSite=Lax. Los roles se comprueban en API, además de los menús. Se validan los roles personalizados dentro de la misma empresa; un negocio no puede concederse SUPERADMIN. Un colaborador solo consulta sus propias cajas y métricas. ADMIN/SUPERADMIN ven el equipo dentro del ámbito autorizado.

Las desactivaciones requieren confirmación en interfaz; la API administrativa exige también confirmado=true. La reserva de licencia dura 15 días. La eliminación permanente exige cuenta inactiva, ausencia de caja abierta y transferencia previa si era principal. Los IDs/nombres originales de autoría sobreviven a la eliminación. No hay tarea de borrado automático.

**Verificación:** cupos llenos con reserva, restauración de la misma reserva, liberación por eliminación manual, expiración simulada en prueba unitaria, bloqueo de eliminación con caja abierta, conservación del corte y ventas después de borrar la cuenta. La interfaz usa confirmación explícita adicional para eliminación permanente.

## 4. Entradas, consultas y respuestas

Se revisaron consultas JDBC/JPA: valores suministrados por usuario se enlazan como parámetros. Los fragmentos dinámicos de tabla/estado proceden de opciones cerradas del servidor. Las listas anidadas rechazan elementos nulos; fechas, cantidades, tamaños, enum de tema y campos de texto tienen validaciones. Login limita lectura a 8 KB y escrituras JSON a 256 KB antes del controlador.

Los errores de integridad, formato y registros inexistentes se traducen a respuestas controladas. Se configuran `spring.web.error.include-message`, `include-stacktrace` e `include-binding-errors` en never para errores internos. La API incluye CSP `default-src 'none'; frame-ancestors 'none'`. React representa los textos mediante escape normal; no se introduce HTML de nombres, observaciones o emojis.

**Verificación:** CSRF ausente, cargas JSON excesivas, líneas nulas, tipos no válidos, entradas similares a inyección y ausencia de secretos/trazas en respuestas. Esto no demuestra ausencia de toda vulnerabilidad posible.

## 5. Archivos y exportaciones

Los adjuntos se guardan en PostgreSQL bajo compra/orden, empresa y local. No se publican rutas de disco. Se limitan a 10 MB y 10 adjuntos por registro, con hash para reintentos y nombre normalizado. Se valida PDF por cabecera y terminador; imágenes se decodifican, limitan a 4096×4096 y recodifican sin metadatos. Descargas exigen permisos de compras, mismo local, Content-Disposition attachment, nosniff y no-store.

**Límite:** no se integra antivirus, sandbox de PDF ni desarmado de documentos. Un PDF con cabecera válida puede contener contenido malicioso; antes de una apertura pública amplia debe incorporarse análisis antimalware según el entorno y la política de archivos.

CSV neutraliza prefijos de fórmula, incluidos espacios iniciales y caracteres de control, y escapa comillas. Stock se exporta por local y excluye servicios. La subida de fotos de mercancía sigue siendo independiente de leer códigos de barras desde una imagen.

**Verificación:** PDF inválido, tamaño excesivo, descarga privada, denegación entre empresas/locales, reintento sin duplicados, imagen recodificada y fórmula en CSV.

## 6. Integridad de operaciones y auditoría

Las operaciones de stock, cobro, recepción, caja y cupos usan transacciones y bloqueo de empresa con orden consistente. Los pedidos usan versión optimista. Preparar/imprimir no mueve stock; cobrar valida existencias y precio otra vez. V13 separa las claves privadas de cobro/recepción de las claves públicas de creación: colisiones entre flujos no reutilizan ventas/compras anteriores. Las claves internas no se exponen en detalle/listados.

Los cortes conservan totales y autor de cierre. Una caja cerrada no se recalcula ni admite anular ventas que modificarían el corte. Reintentar cobros, compras, recepciones o cierres no duplica stock ni operaciones.

La auditoría registra actor, empresa/local, fecha, evento y objetivo; no guarda contraseñas. No hay endpoints para modificar/borrar eventos. El usuario de PostgreSQL sí conserva facultades técnicas: no es un registro WORM ni una garantía contra un administrador de base malicioso. Retención, almacenamiento externo inmutable y alertas requieren diseño de operación adicional.

## 7. Dependencias, migraciones y despliegue

`npm audit --json --prefix frontend` no reportó vulnerabilidades conocidas en la consulta realizada. La consulta OSV de 33 coordenadas Maven extraídas de los metadatos del JAR detectó siete avisos en Jackson 3.1.5. Se actualiza el BOM completo a **3.1.7**, versión corregida en los rangos publicados. Incluye [GHSA-7hhh-6rmp-j9qf](https://osv.dev/vulnerability/GHSA-7hhh-6rmp-j9qf), [GHSA-p6pp-m3f8-5c89](https://osv.dev/vulnerability/GHSA-p6pp-m3f8-5c89), [GHSA-cxp5-3px4-pw24](https://osv.dev/vulnerability/GHSA-cxp5-3px4-pw24), [GHSA-wv8q-qhhj-9h54](https://osv.dev/vulnerability/GHSA-wv8q-qhhj-9h54), [GHSA-gx83-3vf8-gh7j](https://osv.dev/vulnerability/GHSA-gx83-3vf8-gh7j), [GHSA-q4xh-88c3-wmh7](https://osv.dev/vulnerability/GHSA-q4xh-88c3-wmh7) y [GHSA-wjgm-6hv5-3cvf](https://osv.dev/vulnerability/GHSA-wjgm-6hv5-3cvf). La coincidencia de dependencia no prueba explotación de cada ruta específica; se aplica el parche preventivo y se verifica compatibilidad. La consulta posterior del JAR con Jackson 3.1.7 no devolvió avisos en las 33 coordenadas identificadas. La consulta solo cubre las coordenadas con metadatos incluidos y los avisos conocidos por esas fuentes. No equivale a revisar manualmente cada dependencia. La batería incluye compilación Java/TypeScript, lint, regresión fiscal simulada, pruebas de API y accesibilidad en pantallas nuevas.

Se probó V11→V13 sobre copia aislada: se conservaron sin cambios los valores de todas las columnas originales de 22 tablas. Migraciones añaden campos/tablas, no borran operaciones existentes. Las filas inactivas anteriores no reciben gracia retroactiva.

Queda fuera del trabajo el despliegue: TLS/dominio, `COOKIE_SECURE=true` bajo HTTPS, secretos propios y rotación, permisos mínimos separados de migración/operación, respaldo cifrado con restauración ensayada, límites en proxy, monitorización, antivirus y pruebas de carga. Ver PRODUCCION.md. No se realizó un envío SUNAT de red; sus dos pruebas externas permanecen optativas.
