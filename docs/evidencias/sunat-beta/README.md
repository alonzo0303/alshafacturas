# Evidencia de prueba directa con SUNAT beta

Prueba del 9 de noviembre de 2026 (hora de Lima). Ambiente BETA, sin validez tributaria. Datos ficticios y usuario de pruebas público del manual de SUNAT; no se utilizaron credenciales ni certificado del usuario.

- Factura ficticia FT01-00000001, RUC de ejemplo público del manual 20100066603.
- Resultado del servicio oficial `sendBill`: CDR con código 0 (aceptada en BETA).
- Se conservan el XML enviado y el XML del CDR. El certificado público incluido en la firma es temporal y de pruebas; su clave privada no está en el repositorio.
- La prueba de resumen de boleta no obtuvo respuesta antes del timeout de 45 segundos. No se obtuvo ticket ni CDR y no se afirma aceptación real de ese flujo.
- La aceptación de esta factura ficticia en beta no certifica la solución en producción ni reemplaza las verificaciones del contribuyente y su régimen.

## Integridad

- SHA-256 `factura-beta.xml`: `3aee877db97ed7efdab600190e3b61eeac8a1aa1cb0c729c08a27a6429ac08f4`
- SHA-256 `cdr-factura-beta.xml`: `04ce68930494876ded963b64094a70e5d27f3c462d496e558264629ab75955b9`
