# Operación, personal y documentos

## Personal y licencias

En **SUPERADMIN → Personal y accesos**, selecciona la empresa. Puedes buscar personal, cambiar correo/contraseña, rol, desactivar con confirmación y reactivar. El cambio de acceso invalida sesiones anteriores; no reactiva una cuenta desactivada. No se muestran contraseñas almacenadas.

Las nuevas desactivaciones reservan licencia durante **15 días exactos**. Reactivar dentro de ese plazo usa la misma reserva. Tras el vencimiento la cuenta sigue guardada, con la reserva liberada. Nunca se elimina automáticamente. Las cuentas desactivadas antes de V12 conservan su estado y no reciben reservas retroactivas. Los planes siguen en S/35 (principal + 2), S/50 (principal + 3), S/70 (sin límite de empleados).

Eliminar requiere cuenta inactiva, confirmación y marcar la advertencia de eliminación permanente. Libera inmediatamente la reserva y conserva la atribución histórica de ventas, compras y cierres. Una caja abierta bloquea la eliminación: primero debe cerrarse. No elimina productos ni operaciones de la empresa. El administrador principal debe transferirse a otro ADMIN activo antes de eliminarlo o cambiar su rol; las acciones quedan en Auditoría.

## Catálogo y nichos

**Catálogo común** de SUPERADMIN permite publicar Producto o Servicio, marca, rubro, foto y duración en servicios. **Acceso al catálogo** asigna los rubros visibles de cada negocio. El negocio incorpora una copia con su propio precio; editar la plantilla no modifica copias existentes. Importar un servicio exige permiso para editar servicios, no amplía los permisos de productos.

**Visualizaciones → Apariencia por tipo de atención** permite configurar emoji y tema predefinido para Restaurante, Barbería, Spa u otros tipos. La marca mantiene #7C3AED; los estilos se seleccionan de una lista validada, sin inyectar HTML/CSS. La asignación sigue siendo individual por usuario y no cambia roles, empresa, plan ni datos.

## Configuración por empresa y local

En **SUPERADMIN → Control operativo**, elige empresa y local. Los interruptores habilitan preparación de mercancía y caja obligatoria; el modo de rendimiento es Comercio, Servicios o Ambos. ADMIN y SUPERADMIN ven el equipo; el colaborador solo ve sus propias métricas y cajas. Los permisos operativos se administran desde Roles. Compartir visualización no equivale a compartir permisos.

## Mesas y pedidos

Para un usuario con tema Restaurante y permiso **MESAS_GESTIONAR**, abre **Mesas**. Crea/edita mesas del local con nombre y capacidad. Una mesa admite un pedido abierto, con mercancía y/o servicios. Marca los servicios de comida con **Cuenta como comida** para sumar sus unidades en rendimiento. Esa marca se conserva en cada venta.

Guardar o preparar no cobra ni mueve stock. Los pedidos usan versión: si otro empleado modificó el pedido, recarga antes de continuar. Cobrar exige también permiso de ventas, valida precio actual y existencias, registra una sola venta y libera la mesa. Reintentar un cobro ya completado devuelve la misma venta.

## Preparación antes de cobrar

Con el interruptor habilitado y permiso **PREPARACION_GESTIONAR**, Comercio muestra **Preparaciones** y en Punto de venta **Generar preparación antes de cobrar**. Se imprime A4, 80 mm o 58 mm. Si cambias el carrito, actualiza la preparación antes de cobrar. El cobro queda vinculado al pedido preparado.

Es una **hoja interna de preparación**, no una guía de remisión electrónica SUNAT, comprobante fiscal ni reserva de stock. El stock se valida y descuenta al cobrar. Puede usarse para recoger mercancía anticipadamente sin registrar una venta ficticia.

## Caja y rendimiento

En **Caja y cierres**, cada colaborador abre su caja del local con fondo inicial. Sus ventas posteriores se vinculan a ella. Con caja obligatoria, no se acepta vender sin abrirla. Cerrar registra autor del cierre, cantidad e importe de ventas confirmadas, efectivo esperado (fondo + ventas en efectivo), efectivo contado y diferencia. Tarjeta/transferencia se muestran por separado.

Un cierre es inmutable. No se anulan ventas de una caja cerrada ni se reescribe un cierre al repetir la solicitud. Si necesitas corregir una venta, hazlo antes del corte. Ventas anteriores a la apertura no se añaden retroactivamente.

**Rendimiento** permite fechas (hasta 366 días), total y cantidad por autor de venta, anulaciones, cortes por quien los cerró y unidades marcadas como comida por día. La fecha diaria utiliza America/Lima. Comercio/Servicios filtra las líneas incluidas: no inventa repartos por turno o por quien preparó el pedido. No es un estado de utilidades ni calcula comisiones. La auditoría muestra eventos sensibles por empresa, con paginación.

## Stock y compras

**Inventario → Descargar stock CSV** exporta mercancía del local actual. Las alertas incluyen texto: rojo para stock bajo, azul para óptimo. En ventas muestran **stock actual**, no el saldo histórico al vender. No se aplican a servicios sin inventario.

**Registrar compra** distingue ingreso inmediato y orden sin stock. **Órdenes de compra** conserva artículos/costos y permite cancelar o confirmar recepción una vez. Solo al recibir se registra la compra y aumenta el inventario. El detalle de compra ofrece impresión y CSV.

Los detalles de compra y orden permiten adjuntar documentos **PDF, JPEG y PNG, hasta 10 MB y 10 documentos por registro**. Subir exige pulsar **Subir documento**. Los adjuntos se guardan en PostgreSQL y solo se descargan con sesión, permiso de compras y acceso al mismo local. Los documentos de la orden siguen accesibles desde la compra recibida. Las fotos de producto siguen guardándose al confirmar el formulario correspondiente. Copiar el repositorio no copia datos ni archivos: respalda la base de datos.

## Actualizar y abrir en Windows

Con respaldo previo de la base, actualiza la rama que contiene estos cambios. Detén el backend anterior con Ctrl+C para liberar 8080. Desde la raíz del proyecto, en PowerShell:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Flyway aplicará V12 y V13 sin borrar las tablas existentes. Espera `Started BackendApplication`. En otra terminal, desde la raíz:

```powershell
npm.cmd ci --prefix frontend
npm.cmd run dev --prefix frontend
```

Abre la dirección que Vite muestre (normalmente http://localhost:5173). Mantén ambas terminales abiertas. La interfaz no se inicia con Maven. No cambies ni vuelvas a ejecutar manualmente migraciones ya aplicadas.
