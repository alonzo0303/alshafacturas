# Verificación de esta entrega

Fecha de ejecución: 9 de noviembre de 2026, hora de Lima.

| Verificación | Resultado |
| --- | --- |
| Maven `verify`, Java 21 y PostgreSQL 17 | 6 pruebas pasaron; las 2 pruebas optativas de red se omiten por defecto |
| Frontend TypeScript y Vite, compilación de producción | Pasó |
| Lint React/TypeScript | Pasó sin advertencias |
| Docker Compose: PostgreSQL, backend y Nginx | Imágenes construidas y tres servicios en ejecución |
| API contra la instancia Docker | 13 pruebas pasaron |
| Navegador contra Nginx y backend en Docker | 2 pruebas pasaron |
| Tamaños de pantalla | 320, 768, 1024 y 1440 px sin desbordamiento global en el recorrido probado |
| Accesibilidad automática WCAG A/AA del resumen | Sin infracciones detectadas por axe en la pantalla probada |
| Nota de venta interna PDF de prueba | Una página A4; aviso de documento sin validez tributaria |
| Factura ficticia contra SUNAT beta, prueba optativa | CDR código 0: aceptada en BETA |
| Resumen de boleta ficticia contra SUNAT beta | Sin respuesta antes de 45 segundos; no se obtuvo ticket/CDR |
| Producción fiscal con datos del usuario | No configurada ni probada |

La batería de API verifica sesiones y CSRF, permisos, aislamiento entre empresas, validación, stock, ventas simultáneas sin sobreventa, compras y ventas idempotentes, rechazo de reintentos con contenido distinto, anulación sin devolución duplicada, suspensión de empresa, desactivación de usuario y configuración fiscal ausente.

Las pruebas de SUNAT sin red verifican firma digital válida, XML escapado, CDR correspondiente, rechazo, pérdida de respuesta y reenvío del mismo XML/número, protección de anulación, resumen/ticket, consulta de resultados y bloqueo de entidades XML externas.

El recorrido del navegador verifica acceso empresarial, producto, ajuste de inventario, venta, impresión, anulación, persistencia de sesión al recargar, configuración de SUNAT ausente, cierre de sesión, acceso SUPERADMIN y redirección por rol. No sustituye una auditoría completa de accesibilidad ni pruebas en dispositivos físicos.

Los datos y contraseñas de las pruebas pertenecen exclusivamente a instancias desechables. La CI no habilita las pruebas de red ni utiliza credenciales reales. La [evidencia del servicio beta](evidencias/sunat-beta/README.md) no tiene validez tributaria y no acredita aceptación en producción.

## Actualización: gestión interna sin RUC

Verificado el alta de varios negocios sin RUC (NULL o vacío), acceso con correo y contraseña, selección por código en cuentas coincidentes, aislamiento entre negocios, notas internas sin desglose fiscal y rechazo de solicitudes/emisiones fiscales sin RUC. Las cuentas con RUC conservan el acceso anterior.

Resultado de la actualización: 7 pruebas backend, 15 de API y 3 de navegador aprobadas; compilación y lint aprobados. Las 2 pruebas optativas de red permanecieron desactivadas. Esta actualización se verificó con servidores locales y PostgreSQL de pruebas, sin reconstruir las imágenes Docker.

La espera de arranque en CI ahora comprueba un acceso SUPERADMIN válido antes de comenzar las pruebas, en lugar de considerar suficiente que el puerto HTTP esté abierto.
