# Servicios, sucursales y accesos

## Tipos de atención y servicios

SUPERADMIN entra en **Visualizaciones de usuarios → Agregar tipo de atención** y registra, por ejemplo, Spa o Discoteca. Los tipos se guardan en la base y se pueden asignar a cada usuario; no añaden automáticamente funciones especializadas de esos rubros.

En **Atención y servicios → Servicios** se crean o editan servicios con nombre, precio final en PEN, duración y disponibilidad. Se puede buscar y desactivar un servicio conservando sus ventas anteriores. Cada local mantiene su propio catálogo de servicios.

**Cobrar servicios** registra una nota interna, cantidad, medio de pago y usuario que cobra; conserva nombre, precio e IGV por línea. Los reintentos con la misma clave no duplican el cobro. No descuenta stock ni genera movimientos de almacén, incluso al anular. No se pueden comprar servicios ni ajustar sus existencias.

Los roles incluyen **Consultar servicios** y **Crear y editar servicios**. El administrador tiene acceso; el permiso de ventas permite consultar y cobrar servicios, y **Anular ventas internas** controla la anulación. Las agendas, mesas, comandas, recetas, comisiones y asignación de un profesional distinto del usuario que cobra todavía no forman parte de esta entrega. El cobro no conecta con bancos ni constituye emisión fiscal.

## Un correo, varios negocios

El mismo correo puede tener una cuenta en empresas diferentes. Si correo y contraseña coinciden con más de una cuenta activa y habilitada, el login muestra **Tienda a la que deseas ingresar**. Elegir negocio y confirmar inicia la sesión en esa empresa.

Solo se muestran negocios cuyas credenciales se validaron. El selector no establece sesión ni revela las otras cuentas con una contraseña distinta. Se mantiene el ingreso mediante código de negocio o RUC. Las empresas independientes conservan usuarios, contraseñas y planes independientes, aunque compartan un correo.

## Editar correo o contraseña

Desde **SUPERADMIN → Visualizaciones de usuarios**, seleccionar la empresa y usar **Editar correo y contraseña de…**. Se conserva la misma cuenta y sus datos. El correo se normaliza y no puede duplicarse dentro de la misma empresa; puede usarse en otra empresa.

Dejar la contraseña vacía la conserva. La contraseña nueva exige 8 caracteres y hasta 72 bytes UTF-8 y se protege con BCrypt. La contraseña anterior no se muestra. Cambiar correo o contraseña incrementa la versión de credenciales: las sesiones anteriores quedan revocadas en su siguiente petición. Una operación sin cambios no revoca sesiones. Esta opción administra cuentas de negocios, no cuentas SUPERADMIN.

## Agregar RUC

En **Empresas → Editar** aparece **Agregar RUC (opcional)** para un negocio sin RUC. Se registra una sola vez, con 11 dígitos y sin duplicar otro negocio. El código de empresa y los datos se conservan. Un RUC ya registrado sigue protegido contra sustitución desde este formulario.

El RUC habilita la configuración tributaria del negocio y el valor predeterminado gravado para artículos nuevos. No activa SUNAT ni verifica por sí solo la condición fiscal del contribuyente. Los productos antiguos y las líneas históricas conservan su tratamiento e importes; para solicitar factura o boleta con un artículo antes marcado SIN_IGV se debe revisar su tratamiento tributario. Las notas anteriores siguen siendo internas. Los encabezados de los recibos consultan los datos actuales del negocio y local; sus importes y líneas son históricos.

## Sucursales de una empresa

SUPERADMIN usa **Sucursales** y selecciona la empresa. El administrador del negocio usa **Locales**. Se pueden crear más de dos locales y editar nombre y dirección. Comparten RUC, configuración tributaria, personal, roles, plan y cupos de empleados. Las empresas que ya existían no se fusionan ni se convierten automáticamente en sucursales.

Cada local tiene **productos y stock, clientes, compras, ventas, movimientos, servicios, imágenes de productos y reportes operativos separados**. El catálogo común y sus permisos por rubro siguen siendo de empresa. El selector **Local de trabajo** cambia el contexto; el catálogo del local nuevo empieza vacío. Los números comerciales y fiscales se mantienen únicos por empresa y entorno, no se reinician al cambiar de sucursal.

Los administradores acceden a todos los locales. El personal empieza en el Local principal y se le pueden asignar uno o varios desde **Acceso del personal por local**. Acceder a un local no cambia el rol ni amplía permisos de operación. Los precios y cupos de S/35, S/50 y S/70 se mantienen a nivel de empresa, sin multiplicar cupos por sucursal. Cambiar una cuenta que pertenece a esta empresa cambia su acceso a todos sus locales.

Una pestaña con un local anterior recibe un aviso para recargar si intenta operar después de cambiar el local en otra pestaña. Las consultas y escrituras validan el local en el servidor, incluidos acceso directo por ID, fotos y documentos fiscales. No se incluyen transferencias entre almacenes ni reportes consolidados entre locales.

## Migración y validación

V11 añade locales, tipos ampliables, servicios y versión de credenciales. Crea un Local principal por empresa y asigna allí las filas existentes, sin borrar ni copiar operaciones. Se probó una actualización desde V10 sobre una copia de la base de pruebas: se compararon conteos y resúmenes criptográficos de 12 tablas; las columnas anteriores quedaron iguales (44 productos, 21 ventas, 5 compras, 51 movimientos, 43 usuarios, fotos y pagos incluidos).

Las pruebas API cubren correo compartido, cambio de credenciales y sesiones, RUC sobre operaciones previas, tres locales, permisos de personal, acceso cruzado por ID, imágenes, compras y ajustes de servicios, reintentos sin duplicar, stock, cupos y pestañas con un local anterior. Los recorridos de navegador prueban las pantallas, además de las regresiones existentes de Comercio y Atención. La integración fiscal simulada comprueba que otro local no puede listar, descargar, consultar ni reintentar documentos ajenos ni causar envíos externos.
