# Visualizaciones por usuario

El superadministrador entra en **Visualizaciones de usuarios**, selecciona la empresa y guarda la modalidad de cada persona. Puede buscar por nombre, correo o rol. Los cambios se aplican al recargar AlshaFacturas o iniciar sesión; no se transmiten automáticamente a una pestaña abierta.

- **Comercio**: conserva las pantallas y rutas existentes para maquillaje, abarrotes, ferretería y otros comercios.
- **Atención y servicios**: abre `/atencion`, con tipo **Restaurante**, **Barbería** u **Otros servicios**. La pantalla muestra el usuario, empresa, rol y tipo guardados, sin operaciones ficticias ni botones de funciones sin implementar.
- Los administradores de Atención pueden gestionar **Personal**, **Roles** y **Mi plan** en rutas propias del apartado, reutilizando la gestión existente del negocio. El personal sin rol ADMIN no puede gestionar cuentas o roles.

La selección es individual, no por empresa: dos personas del mismo negocio pueden tener experiencias distintas. Los usuarios existentes y los nuevos empiezan en Comercio hasta que el superadministrador los configure. Crear un empleado desde Atención no le asigna automáticamente la modalidad del administrador.

La migración V10 añade únicamente `modalidad` y `tipo_atencion` a usuarios; asigna Comercio a los existentes y valida combinaciones en PostgreSQL. El endpoint de asignación es exclusivo de SUPERADMIN y exige empresa e ID coincidentes. El guardado actualiza solo esos dos campos, sin editar contraseña, correo, empresa, rol o estado. Las cuentas SUPERADMIN conservan la administración de plataforma.

**Modalidad no es permiso ni una separación de datos.** La empresa sigue delimitando los datos y el rol sigue delimitando las operaciones permitidas por la API. Ocultar las rutas de Comercio en Atención no revoca permisos comerciales previamente otorgados: sus endpoints siguen aplicando los permisos existentes. La modalidad no altera plan, pago, cupos, productos, fotos, existencias, compras ni ventas. Los planes mantienen sus precios de S/35, S/50 y S/70 y sus límites actuales.

Esta entrega prepara la asignación y el espacio separado acordados. No implementa agendas, comisiones, mesas, comandas, recetas ni cobro de servicios. Los permisos específicos de esas funciones se definirán al desarrollarlas; los roles personalizados existentes pueden utilizarse para organizar el personal desde ahora.

## Verificación

Las pruebas API verifican exclusividad de SUPERADMIN, selección individual, combinaciones inválidas, coincidencia empresa/usuario, sesiones abiertas, vuelta a Comercio y conservación de datos, permisos y plan. Las pruebas de navegador recorren la asignación, los tres tipos, las rutas separadas, personal y roles, acceso de empleado y retorno a Comercio; comprueban anchos de 320, 768, 1024 y 1440 px y accesibilidad automatizada.
