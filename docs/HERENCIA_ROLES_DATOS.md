# Apariencia compartida y datos por persona

## Configuración del negocio

El administrador abre Configuración → Visualización del negocio y su personal. Elige Comercio o Atención y servicios, el tipo de atención, un color opcional y la distribución amplia o compacta. Puede habilitar módulos y cambiar su orden con los botones Subir/Bajar. Guarda una sola configuración para toda la empresa, incluidas sus sucursales. SuperAdmin tiene el mismo formulario al seleccionar una empresa en Visualizaciones de usuarios.

La configuración pertenece a la empresa, no a un usuario. El personal existente y nuevo hereda modalidad, tipo, emoji/tema del rubro, color, distribución, módulos y orden. La estructura visual es común; el menú muestra únicamente las funciones autorizadas por el rol. Nunca se conceden permisos al cambiar colores, plantilla o modalidad. Personal, roles y configuración siguen disponibles para el administrador aunque oculte todos los módulos operativos.

Las sesiones consultan los cambios cada 30 segundos, al recuperar el foco y después de guardar la apariencia. Si hay formularios pendientes, se informa del cambio y se aplaza la actualización visual hasta guardarlos o descartarlos. La autorización del servidor se actualiza en cada petición, independientemente de ese aplazamiento. La sincronización no cambia el local seleccionado ni las credenciales. Una versión evita sobrescribir una configuración guardada desde otra pestaña.

## Roles fáciles de configurar

Roles y permisos ofrece plantillas iniciales para personal obrero, inventario, barbero, cocinero, bartender, contador, secretario y vendedor. Cada permiso explica entre paréntesis los puestos habituales. Las plantillas son sugerencias que el administrador puede revisar antes de guardar; no crean cuentas ni conceden acceso automáticamente.

Un contador no recibe el consolidado por su nombre de puesto: como cualquier personal, consulta sus propias operaciones. El consolidado exige rol Administrador. El código interno de un rol personalizado se conserva como identificador; el encabezado muestra su nombre legible.

## Matriz de acceso

Todos los accesos requieren empresa activa, membresía, sesión válida, local autorizado, módulo habilitado y permiso correspondiente.

| Recurso | Administrador | Personal con permiso |
| --- | --- | --- |
| Apariencia y módulos | Configura su empresa | Hereda, no edita |
| Personal, roles y plan | Gestiona su empresa | Sin acceso |
| Ventas, detalle, impresión y CSV | Consolidado del local seleccionado | Ventas realizadas por la propia cuenta |
| Compras, órdenes y adjuntos | Consolidado del local seleccionado | Operaciones creadas por la propia cuenta |
| Movimientos de inventario | Movimientos del local | Movimientos registrados por la propia cuenta |
| Catálogo, servicios y existencias | Datos compartidos del local | Referencias compartidas según permisos; no último coste de compra |
| Impuestos y documentos electrónicos | Operaciones del local | Operaciones y documentos propios |
| Caja y rendimiento | Equipo del local | Cajas y métricas propias |
| Actividades | Equipo del local | Ejecución asignada, según el flujo existente |
| Pedidos | Todos en el local; asigna responsables | Creados por la cuenta o asignados a ella |
| Mesas | Crea y edita mesas | Consulta ocupación; abre solo pedidos propios/asignados |

Los filtros se aplican en el servidor. Conocer un identificador ajeno no permite abrir una venta, anularla, obtener su comprobante o descargar un adjunto. Las reintentos con claves de idempotencia tampoco devuelven operaciones de otros autores. El nombre de rol y la cantidad de permisos no amplían el alcance de datos. Los registros históricos sin autor identificable quedan reservados al administrador.

Los resúmenes personales excluyen la valoración global de inventario. Las existencias son una referencia operativa compartida; no se trata de un inventario privado por empleado. Los clientes también son una referencia compartida para vender, sujetos al permiso de gestión correspondiente.

## Pedidos asignados

En el editor de un pedido abierto, el administrador puede seleccionar un responsable activo del local. Guarda antes cualquier modificación de líneas. La asignación aumenta la versión y deja auditoría; otro empleado no puede reasignarse el pedido. El responsable necesita además el permiso de mesas o preparación correspondiente. La mesa permanece ocupada para todo el equipo, pero no revela el identificador del pedido a quienes no pueden atenderlo. Los pedidos cerrados no se reasignan. Deben cerrarse los pedidos creados por una cuenta y reasignarse los que tiene a cargo antes de eliminarla.

## Migración y límites

V16 toma la visualización del administrador principal de cada empresa, o del primer Administrador si no hay principal, para iniciar la configuración heredada. No borra las selecciones históricas de usuarios, productos, ventas ni compras. Los campos visuales antiguos del usuario dejan de determinar su sesión. El endpoint antiguo de SuperAdmin admite cambiar la modalidad al seleccionar un Administrador, aplicándola al negocio completo; rechaza cambios independientes al personal con 409.

El consolidado actual corresponde al local seleccionado, no a una combinación nueva de todas las sucursales. Las áreas de soporte o departamentos futuros deben implementar el mismo filtro explícito de autor/asignación antes de conceder permisos; esta entrega no crea módulos nuevos de soporte ni una contabilidad global para empleados.

## Verificación

`tests/test_herencia.py` comprueba herencia en personal existente/nuevo, versiones en conflicto, permisos de edición, módulos ocultos, separación de ventas/compras/movimientos/adjuntos y asignación de pedidos. Las regresiones de API, control, suscripciones y experiencia continúan ejecutándose. Playwright comprueba la plantilla Barbero, ausencia de desbordamiento en 320/768/1440 px, herencia visual al personal y accesibilidad de la pantalla de ventas propia.

Resultados locales: 20 pruebas Java aprobadas y 2 externas SUNAT omitidas; 60 pruebas de API y 3 guardas Python aprobadas. Los 25 recorridos de navegador se comprobaron, con repetición de los dos afectados por las nuevas etiquetas/formulario. Se verificó también que el borrador de rol se conserva al recibir un cambio de modalidad. V16 se ejecutó sobre una copia V15 y las huellas de las columnas originales de sus 37 tablas permanecieron idénticas. El arranque con Flyway en otra copia fue correcto; sus cambios posteriores de suscripción correspondieron a las tareas de vencimiento ya existentes.
