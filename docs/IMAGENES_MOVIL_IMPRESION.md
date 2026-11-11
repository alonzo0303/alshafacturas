# Fotos, catálogo por rubro y tickets

## Acceso por rubro

En SUPERADMIN → Empresas → **Acceso al catálogo por rubro**, selecciona el negocio, marca uno o varios rubros y guarda. Los rubros disponibles se crean al publicar plantillas en el catálogo común. Un negocio de maquillaje puede recibir solo Maquillaje, o varios rubros si lo necesita. Sin rubros habilitados, no ve plantillas comunes y sí conserva sus productos propios.

La migración V8 no adivina el rubro ni concede acceso a todos los negocios existentes. La plataforma debe asignarlo. El servidor bloquea también la incorporación por ID de plantillas no autorizadas y la lectura de sus fotos. Retirar un rubro no borra los productos ni las imágenes que el negocio ya incorporó.

## Fotos de mercancía

Nuevo producto, edición de producto, mercancía creada en Compras y plantilla común permiten elegir o quitar una foto. Se aceptan JPEG, PNG y WebP de hasta 10 MB en el navegador; se optimizan a un máximo de 800 píxeles antes de subir. El servidor acepta JPEG/PNG de hasta 2 MB y 2048 × 2048, valida y vuelve a codificar la imagen sin metadatos.

Las imágenes se guardan en PostgreSQL, separadas del listado de productos. Necesitan sesión y permiso; las de un negocio no son accesibles por otros. Al incorporar una plantilla con foto se guarda una copia propia. Cambiar después la plantilla no modifica la foto del negocio.

Las fotos se muestran en Productos, Catálogo común y las tarjetas de selección del punto de venta o compra. Guardar un producto e intentar de nuevo una subida fallida no crea un segundo producto. Una imagen por producto o variante; no incluye una galería múltiple.

## Pantallas pequeñas y desplazamiento

En teléfono y tablet estrecha, el botón **Menú** abre la navegación en dos columnas y se cierra al elegir una sección. No hace falta deslizar horizontalmente todos los enlaces. Las tablas mantienen sus columnas legibles dentro de su propio contenedor: se pueden arrastrar, enfocar con teclado o mover con **Más columnas** y **Columnas anteriores**. La página conserva su ancho.

El morado principal es **#7C3AED**, indicado por Alsha Group. Los estados de alerta conservan rojo y los de confirmación verde.

El lector utiliza versiones compatibles fijadas de ZXing para evitar avisos repetidos por fotogramas sin código. Se mantienen cámara, foto y lector que escribe el código con Enter. La cámara en vivo sigue necesitando HTTPS o localhost y permiso del navegador.

## Impresión de 58 y 80 mm

Al abrir **Ver / Imprimir**, elige **Hoja A4**, **Ticket térmico 80 mm** o **Ticket térmico 58 mm**. La vista previa adapta texto y columnas. El PDF usa el ancho elegido y una altura calculada para el contenido.

En la impresión física, instala el controlador correspondiente y selecciona el ancho real del papel, escala 100%, márgenes mínimos y sin encabezados/pies del navegador. Si admite rollo continuo, configura esa opción. El navegador abre el diálogo de impresión: no selecciona impresora, no imprime en silencio y no controla corte, cajón ni Bluetooth directamente. El comportamiento físico depende del controlador y debe probarse con el equipo real.

**El formato térmico no convierte una nota interna en boleta electrónica.** La nota conserva el aviso de documento sin validez tributaria. La emisión fiscal real necesita RUC, configuración del emisor, certificado y el procedimiento SUNAT correspondiente; esta mejora no incorpora una representación fiscal con QR ni acredita aceptación en producción. El ticket mostrado en la referencia comercial corresponde a otro sistema; aquí se implementa el tamaño de papel para la nota interna existente.

## Referencia de experiencia de uso

Se consultó el contenido público de [tefacturo.pe](https://tefacturo.pe/) como referencia de organización por rubros y módulos empresariales. No se reutilizan su código, textos, imágenes, logotipo ni afirmaciones comerciales. AlshaFacturas mantiene su navegación, morado, planes y permisos propios. El punto de venta añade filtros por categoría y acceso al detalle de la operación en móvil. El video de YouTube compartido no pudo cargarse desde el entorno; no se afirma haber revisado su contenido.

## Editar un negocio existente y guardar fotos

En SUPERADMIN → Empresas → Empresas registradas, pulsa **Editar** en la fila del negocio. Se abre su código existente y permite cambiar nombre y dirección. **Guardar cambios del negocio** actualiza esa misma empresa; no crea otra, no altera RUC, estado, cuentas ni plan, y no borra productos, fotos, saldos u operaciones. No uses Crear empresa para renombrar una existente. Los nombres/direcciones de las notas internas consultadas pueden reflejar los datos actuales; los XML ya guardados no se reescriben.

La barra inferior de tablas es un control con un tirador visible: se puede arrastrar con ratón o dedo, pulsar en la pista o usar teclado Home/End y flechas. Sigue sincronizada con el desplazamiento de la tabla y los botones anteriores/siguientes.

Seleccionar **Foto del producto** muestra una vista previa. La imagen solo se almacena al confirmar **Guardar producto** o **Guardar** en la plantilla común. Se desactiva la confirmación mientras se prepara la imagen. Persiste en PostgreSQL junto con el sistema; al ejecutar localmente queda en la base local, y al desplegar en un servidor compartido queda en su base. Copiar o mover únicamente el código fuente no copia los datos ni las fotos: se necesita el respaldo de la base.

**Leer código desde una imagen** (antes Escanear foto) es otra función: reconoce el código y no guarda esa imagen como foto de mercancía. Una foto nueva en una plantilla común no sustituye automáticamente las fotos de productos ya incorporados por los negocios.

## Buscar rubros

Los campos **Rubro** del catálogo y **Rubro del catálogo** permiten escribir para filtrar la lista sin distinguir mayúsculas o tildes: `ferreteria` encuentra `Ferretería`. Se puede elegir con ratón o flechas y Enter, cerrar con Escape y volver a Todos los rubros en el filtro del negocio. El selector muestra solamente los rubros de las plantillas autorizadas para ese negocio.

En la edición/alta de plantilla común se puede elegir un rubro existente o escribir uno nuevo y confirmarlo con Guardar. En productos, Rubro / categoría ofrece las categorías del negocio y permite escribir una propia. Al editar se conserva el valor actual.

En **Acceso al catálogo por rubro**, Buscar rubros para habilitar filtra las casillas. Las casillas marcadas que no coinciden con la búsqueda siguen seleccionadas y se guardan. Buscar no modifica permisos hasta confirmar Guardar acceso al catálogo.

## Marca en ambos catálogos

SUPERADMIN puede registrar y editar **Marca** en las plantillas comunes; se muestra en la tabla, en las tarjetas disponibles para el negocio y se incluye en la búsqueda. Al incorporar, el campo Marca del producto comienza con la marca de la plantilla y el negocio puede conservarla o reemplazarla por una propia. Si no se define marca de plantilla, se usa Genérico.

La migración V9 asigna Genérico a las plantillas antiguas y no modifica las marcas de productos existentes. Cambiar la marca común no actualiza copias ya incorporadas. El API también aplica la marca de plantilla a nuevas incorporaciones sin marca explícita y respeta una marca propia enviada por el negocio. Las ediciones de plantilla desde clientes antiguos que omiten el campo conservan su marca actual.
