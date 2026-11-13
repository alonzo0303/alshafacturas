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

## Actualización: planes, catálogo común, compras y permisos

Verificación del 10 de noviembre de 2026 en instancia local con PostgreSQL de pruebas:

- Backend: 8 pruebas ejecutadas y aprobadas; 2 pruebas externas de SUNAT omitidas. Incluye XML firmado con líneas gravadas, exoneradas e inafectas.
- API: 21 pruebas aprobadas. Incluye planes de 35/50/70 soles, cupos de personal y reactivación, dos solicitudes para el último cupo (una creación y un rechazo), roles personalizados con cambios de permisos sobre una sesión abierta, aislamiento entre negocios, catálogo compartido, marcas y códigos de barras, costo de compra independiente y crédito fiscal potencial.
- Frontend: compilación TypeScript/Vite y lint aprobados sin advertencias de código. El lector de imagen se carga al solicitarlo.
- Navegador: recorrido de venta e impresión, alta sin RUC, compras con nueva mercancía, catálogo común, planes/roles y vendedor con inventario en consulta. Se verifican el rojo de stock bajo y la alineación numérica; vistas de 320, 768, 1024 y 1440 px en los recorridos aplicables.
- Escaneo: escritura de código con Enter y decodificación local de imagen de prueba; permiso de cámara denegado con mensaje recuperable. No se ha probado cámara/lector físico en teléfono o tablet.

No se reconstruyeron contenedores ni se enviaron documentos a SUNAT en esta actualización. El registro de pago es manual, con fechas explícitas; no implica un depósito real ni un cobro automático. Los datos de integración son ficticios. Los nuevos tratamientos fiscales requieren la validación del emisor antes de producción.

## Actualización: fotos, móvil, rubros e impresión térmica

Verificado el 10 de noviembre de 2026:

- Maven `verify`: 8 pruebas aprobadas y 2 pruebas externas SUNAT omitidas. Migración V8 aplicada sobre la base de pruebas existente.
- API: 23 pruebas aprobadas, incluidas subida/lectura/borrado de foto, imágenes inválidas o mayores al límite, aislamiento entre negocios, restricción por rubro tanto al listar como al incorporar por ID y conservación de copias al retirar acceso.
- Frontend: TypeScript/Vite y lint aprobados. Dependencias de cámara compatibles y fijadas en package-lock.
- Navegador: 7 recorridos aprobados contra Vite y 7 contra la compilación de producción servida por Nginx, con las cabeceras CSP del despliegue. Se comprobó una foto subida con ancho natural válido, el morado #7C3AED, menú móvil, desplazamiento real con botones, filtros de categoría y asignación de rubro desde SUPERADMIN.
- Tamaños probados: 320, 390, 622, 768, 1024 y 1440 px en el recorrido de fotos; sin desbordamiento global. Las tablas se desplazan dentro del contenedor.
- PDF: A4 y medidas térmicas de 58 y 80 mm; el ancho de MediaBox coincide con el formato elegido. Continúa siendo nota interna. No se probó una impresora física, corte ni Bluetooth.
- Accesibilidad automática: sin infracciones axe A/AA en las pantallas probadas. No sustituye revisión manual completa ni uso en dispositivos físicos.

El ensayo de Nginx reutilizó una imagen existente con archivos compilados/configuración montados de solo lectura; no reconstruyó imágenes ni reemplazó contenedores de bases de datos. Se habilitaron imágenes `blob:` y medios locales en CSP para vista previa y escaneo. No se enviaron comprobantes a SUNAT ni se copiaron recursos de la referencia comercial. El contenido público de tefacturo.pe pudo consultarse; el video de YouTube no cargó desde el entorno.

## Actualización: edición de empresa y barra arrastrable

Verificado el 10 de noviembre de 2026: 8 pruebas Java, 24 de API y 8 recorridos de navegador aprobados; 2 pruebas externas SUNAT omitidas. TypeScript/Vite y lint aprobados.

La prueba de edición comprueba el mismo ID, RUC y estado; compara productos, ventas, compras, movimientos, usuarios y plan antes/después, verifica lectura de la foto y acceso posterior con las mismas credenciales. Se rechazan edición sin permiso y nombre vacío. El recorrido de SUPERADMIN edita nombre/dirección y vuelve a ingresar al negocio para consultar su producto existente.

El control de tabla se probó con arrastre real del ratón hasta el extremo y movimiento efectivo de scrollLeft, además de flechas y teclas Home/End. No se trata solo de un color sobre la tabla. Se conserva el desplazamiento táctil y se oculta la antigua barra nativa pequeña para evitar duplicarla.

Las fotos se confirman al guardar el formulario; se impide confirmar mientras se prepara el archivo. El texto del lector distingue la lectura de un código desde imagen del almacenamiento de una foto de producto. No se ejecutaron migraciones nuevas ni se modificaron datos del equipo del usuario.

## Actualización: búsqueda de rubros

Compilación TypeScript/Vite y lint aprobados. Nueve recorridos de navegador aprobados; las dos pruebas de búsqueda/asignación se repitieron tras el ajuste final del selector y pasaron. Incluye búsqueda sin tilde/mayúsculas, selección con teclado sin enviar accidentalmente el formulario, volver a Todos los rubros, rubro nuevo, valor conservado al editar y casillas seleccionadas fuera del filtro. Se comprobó el selector a 320 px y axe A/AA sin infracciones en la pantalla probada. Solo cambia frontend; no requiere migración ni modifica datos existentes.

## Actualización: marca del catálogo común

Verificado: Maven verify (8 pruebas aprobadas y 2 externas omitidas), 25 pruebas API, 10 de navegador, compilación TypeScript/Vite y lint aprobados. La migración V9 se aplicó sobre la base de pruebas existente.

La prueba API cubre marca predeterminada Genérico, creación/edición de marca común, incorporación con marca heredada o propia, incorporación directa con catalogoId, compatibilidad de ediciones que omiten marca y rechazo de valores demasiado largos o cambios no autorizados. Comprueba que editar la marca común no modifica los productos ya incorporados.

El navegador verifica creación y edición por SUPERADMIN, columna Marca, búsqueda por marca, visualización en tarjetas del negocio, valor inicial al incorporar y una marca propia conservada en Productos sin alterar la plantilla común. Solo datos ficticios de prueba.


## Operación, auditoría y ciclo de personal (12/11/2026)

- Java 21 / Maven verify: 12 pruebas aprobadas y 2 externas SUNAT omitidas. Incluye expiración de gracia sin borrar cuenta, límite de intentos concurrentes y regresión fiscal simulada (XXE, aislamiento y reintentos).
- API sobre PostgreSQL 17: 30 regresiones existentes + 11 pruebas operativas/de seguridad. `python -m unittest discover -s tests -p 'test_*.py' -v`.
- Playwright: 16 recorridos aprobados. Después del parche Jackson se repitieron los 3 nuevos con éxito. Incluyen confirmaciones, restablecimiento/reactivación/eliminación, mesas, hoja previa sin movimiento de stock, cobro único, caja/corte, CSV, orden de compra y adjunto privado.
- Interfaz: TypeScript/Vite y oxlint aprobados. Axe sin infracciones en las pantallas incluidas en los recorridos; tamaños 320, 768, 1024 y 1440 px sin desbordamiento global en el flujo nuevo de restaurante.
- Impresión: PDFs reales generados por Chromium para A4, 80 mm y 58 mm, verificando MediaBox; no se imprimió en hardware físico.
- Concurrencia: 48 peticiones de una sesión con cambios de local, sin intercambio de datos; sobreventa, cupos, versiones de pedido e idempotencia entre flujos comprobados.
- Migración: copia independiente de base V11, actualización a V13; conteos y hashes de todas las columnas originales de 22 tablas idénticos antes/después. La base fuente no se modificó.
- Dependencias: npm audit sin avisos; OSV detectó 7 avisos en Jackson 3.1.5, corregidos con BOM 3.1.7. Nueva consulta de las 33 coordenadas Maven identificadas sin avisos conocidos.

Los registros, capturas y PDFs de ejecución se guardaron fuera del repositorio, sin credenciales ni datos reales. La CI ejecuta Maven, compilación/lint, ambas baterías API y todos los recorridos Playwright. Ver [guía operativa](OPERACION_CONTROL.md) e [informe de seguridad y límites](SEGURIDAD_OPERATIVA.md).


## Rubros y suscripciones (12/11/2026)

- Maven verify: 17 pruebas aprobadas, 2 externas SUNAT omitidas. Cinco nuevas verifican límite de día de Perú, D-5…D-0 sin duplicados, plan futuro, plan corto futuro y renovación sin retirar suspensión manual.
- API: 49 pruebas aprobadas (30 existentes + 11 operativas + 8 de rubros/suscripciones). Incluye altas y cambios de rubro, herencia/override por local, conservación de copias, denegación por ID e imagen, costos/fechas/estado, sesiones y login vencidos, contraseña incorrecta sin información de membresía, renovación con datos intactos, cron concurrente y aislamiento de avisos.
- Navegador: 19 recorridos aprobados; tras el último ajuste de recordatorios se repitieron los 3 nuevos. Rubro desde el formulario, incorporación de servicio, plan programado, bloqueo y reingreso tras pago. Axe sin infracciones en las vistas nuevas comprobadas; planes/notificaciones a 320, 768, 1024 y 1440 px y bloqueo a 320 px sin desbordamiento global.
- TypeScript/Vite y oxlint aprobados, sin advertencias de lint.
- Actualización V13→V14 en copia independiente: 29 tablas originales comparadas por conteo/hash de sus columnas y registros preexistentes, sin alteraciones; se permiten únicamente las altas de rubros/plantillas previstas en V14. La copia arrancó correctamente con Hibernate validate.

Instancias, bases de prueba, registros y capturas quedan fuera del repositorio. No se cambió la base del equipo del usuario ni se enviaron notificaciones externas. Ver [Rubros y suscripciones](RUBROS_SUSCRIPCIONES.md) para reglas de acceso, cron, canales e instrucciones de actualización.
