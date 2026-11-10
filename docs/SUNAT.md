# Conexión directa con SUNAT

Se utiliza SEE del Contribuyente, sin contratar PSE/OSE como intermediario técnico. La posibilidad de utilizar este sistema depende de la condición y obligaciones del emisor ante SUNAT; esta implementación no cambia esa condición.

## Implementado

- Factura: XML UBL 2.1, firma enveloped RSA-SHA256 con certificado PKCS#12, ZIP y SOAP `sendBill` con WS-Security UsernameToken.
- Boleta: XML firmado y resumen diario de una operación, mediante `sendSummary`; conserva el ticket y consulta su CDR con `getStatus`. No hay envío automático periódico ni resumen masivo.
- Correlativos fiscales separados de NV01, por empresa, serie y ambiente. Se reserva el número en una transacción antes del envío y se conserva el XML firmado para cada reintento.
- XML y CDR almacenados en PostgreSQL y descargables desde Facturación electrónica; resumen firmado descargable para boletas.
- Un CDR con código 0 y referencia al documento esperado permite marcarlo ACEPTADO. Otro código se registra como RECHAZADO. Un timeout, fallo SOAP o CDR no correspondiente queda para revisión, sin aceptación inventada.
- Los resultados BETA se identifican siempre como pruebas, sin validez tributaria. La producción requiere configuración explícita independiente.
- Un envío no descuenta inventario otra vez. Una venta con comprobante preparado queda protegida contra anulación interna; requiere revisión fiscal.

## Estado real de la activación

El conector está implementado y probado con certificados temporales y respuestas simuladas. Además, una factura ficticia fue aceptada con código 0 por el servicio beta oficial; la prueba del resumen de boleta no obtuvo respuesta antes del timeout. Consulta la [evidencia de beta](evidencias/sunat-beta/README.md). **No se ha emitido ni validado un documento real contra SUNAT y no se han configurado credenciales o certificados del usuario.** Antes de operar, completar pruebas de estructura en beta y aceptación con el RUC, certificado, datos y régimen reales del emisor.

El servicio beta valida estructuras y tiene restricciones de uso; no confirma toda la consistencia de datos. No ejecutar la batería de carga o pruebas de API contra SUNAT. Las pruebas automatizadas del repositorio no envían documentos a los servicios oficiales.

## Configuración segura por empresa

No pegar claves SOL ni certificados en chats, archivos del repositorio o formularios de la aplicación. El backend lee la carpeta indicada por `SUNAT_CONFIG_DIR`. Para cada RUC, crea fuera de Git un archivo `RUC.properties` y su certificado. El nombre del archivo se forma con el RUC de la empresa autenticada; no se acepta una ruta enviada por un usuario de la API.

Ejemplo de estructura:

```
carpeta-privada/
  20XXXXXXXXX.properties
  emisor-20XXXXXXXXX.p12
```

Contenido de referencia, para sustituir en el servidor:

```properties
habilitado=true
ambiente=BETA
# Solo para producción, después de completar las verificaciones del emisor:
produccionHabilitada=false
usuarioSol=USUARIO_SECUNDARIO_SOL
claveSol=CONFIGURAR_EN_EL_SERVIDOR
certificado=emisor-20XXXXXXXXX.p12
certificadoPassword=CONFIGURAR_EN_EL_SERVIDOR
# Opcional si el almacén tiene varias claves:
alias=
serieFactura=F001
serieBoleta=B001
# Últimos números YA utilizados, nunca el próximo número. No se reinician
# contadores existentes al cambiar estos valores. Usa series nuevas o concilia
# cuidadosamente los números previamente emitidos desde otro sistema.
ultimoFactura=0
ultimoBoleta=0
ubigeo=150101
departamento=LIMA
provincia=LIMA
distrito=LIMA
direccion=DOMICILIO_FISCAL_REAL
razonSocial=RAZON_SOCIAL_REAL
```

Para beta, usa los datos de prueba permitidos por el manual oficial y un certificado de pruebas correspondiente al RUC. Para producción, utiliza usuario SOL habilitado para emisión y certificado digital vigente del emisor. No reutilices el certificado temporal de las pruebas automatizadas: se elimina al terminar.

El certificado debe contener una clave RSA e identificar el RUC del emisor en su sujeto. Se verifica su vigencia y correspondencia antes de firmar. La contraseña debe abrir la clave privada del PKCS#12; un almacén con contraseñas distintas requiere adaptarlo antes de usarlo.

En Docker Compose, `SUNAT_SECRETS_DIR` señala la carpeta privada del host, montada como solo lectura en `/run/secrets/sunat`. El backend usa UID/GID 10001:10001: configura en el host el propietario/grupo y permisos mínimos que permitan a ese usuario leer la carpeta, el `.properties` y el `.p12`. No dar permisos de lectura pública a los secretos. En desarrollo local, exporta `SUNAT_CONFIG_DIR` con la ruta de tu carpeta privada.

El endpoint de configuración expone únicamente disponibilidad, ambiente y series. No devuelve claves, rutas ni certificado. El directorio `sunat-secrets/`, `.env`, `*.p12` y `*.pfx` están excluidos de Git y del contexto de la imagen web.

## Recorrido de prueba

1. Completa los datos de una empresa y crea su administrador.
2. Configura su RUC, domicilio fiscal, usuario y certificado en la carpeta privada, en BETA. Comprueba que Facturación electrónica muestre BETA.
3. Registra productos gravados al 18%, existencias y un cliente con RUC para factura. Todos los importes se manejan en soles y como operaciones al contado.
4. Registra una venta solicitando FACTURA o BOLETA. La operación NV01 sigue siendo una nota interna.
5. En Facturación electrónica pulsa Preparar y enviar a SUNAT. Revisa el ambiente y confirma el envío.
6. Factura: revisa el resultado y descarga XML/CDR. Boleta: consulta el ticket hasta que exista un resultado y descarga el resumen y el CDR.
7. Contrasta el resultado en SUNAT. Una aceptación BETA no debe presentarse como comprobante real.

## Respuestas perdidas, rechazo y corrección

Si se pierde la respuesta, el número y el XML quedan guardados. La aplicación no reenvía de forma automática. Revisa el estado en SUNAT antes de usar el reintento explícito; se permite después de 90 segundos y conserva exactamente el documento original. Los tickets de resúmenes se consultan, no se recrean.

Una factura cuya respuesta se perdió necesita conciliación manual en SUNAT. La recuperación automática por `getStatusCdr` aún no está implementada. Si SUNAT ya la aceptó y no se conservó el CDR, no emitir otra factura para la misma venta: debe implementarse o realizarse la recuperación/conciliación antes de continuar.

No está implementado un flujo para corregir y volver a emitir un documento rechazado, importar un CDR obtenido manualmente, notas de crédito/débito ni comunicaciones de baja. El sistema conserva el rechazo y protege la operación; estas excepciones necesitan resolución fiscal y desarrollo adicional antes de uso general en producción. No desbloquear cambiando estados directamente en PostgreSQL.

## Antes de producción

Confirmar que el contribuyente puede usar SEE del Contribuyente, registrar/autorizar el certificado cuando corresponda, habilitar el usuario SOL y conciliar series/correlativos. Completar pruebas de aceptación reales, reglas tributarias del negocio, representación impresa con QR/digest fiscal, conservación y respaldo de XML/CDR, conciliación y flujos de corrección/baja. La nota interna imprimible incluida no reemplaza la representación impresa fiscal.

No admite operaciones exoneradas/inafectas, gratuitas, crédito/cuotas, detracciones, descuentos ni otras monedas. Solo unidades enteras y ventas internas gravadas con IGV 18%. Los demás casos deben rechazarse o implementarse antes de operar.

## Fuentes oficiales consultadas

- [Servicios web disponibles](https://orientacion.sunat.gob.pe/guias-manuales-y-servicios-web): endpoints beta y producción.
- [Manual del programador SEE](https://cpe.sunat.gob.pe/sites/default/files/inline-files/manual_programador%20%281%29.pdf): SOAP, WS-Security, `sendBill`, `sendSummary`, `getStatus`, nombres ZIP/XML y CDR.
- [Guías y manuales](https://cpe.sunat.gob.pe/guias-y-manuales): guías UBL 2.1 y reglas de validación.
- [Restricciones del servicio beta](https://cpe.sunat.gob.pe/noticias/servicio-beta-para-realizar-pruebas-ubl-21): alcance estructural y restricciones de uso.
- [Certificado digital](https://cpe.sunat.gob.pe/certificado-digital): información de SUNAT sobre firma digital.

## Prueba de red optativa

`SunatBetaSmokeTests` está deshabilitada por defecto y en CI. Solo con `RUN_SUNAT_BETA_SMOKE=true` envía datos ficticios al servicio BETA con el usuario público del manual. Nunca apunta a producción. `SUNAT_BETA_EVIDENCE_DIR` permite guardar el resultado fuera del repositorio. Ejecuta una prueba concreta mediante `-Dtest=SunatBetaSmokeTests#facturaArtificialEnServicioBetaOficial` o `-Dtest=SunatBetaSmokeTests#boletaArtificialResumenEnServicioBetaOficial`; no usar como prueba de carga ni programar reintentos masivos. El certificado temporal se crea con keytool y se elimina al terminar.
