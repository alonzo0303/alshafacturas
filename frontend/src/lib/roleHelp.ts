export const occupationHelp: Record<string, string> = {
  ACTIVIDADES_GESTIONAR:
    "personal obrero, barbero, cocinero, bartender o secretario",
  MESAS_GESTIONAR: "mesero, cocinero o bartender; pedidos propios o asignados",
  PREPARACION_GESTIONAR: "almacenero, despachador o personal de logística",
  CAJA_GESTIONAR: "cajero o vendedor; su propia caja",
  RENDIMIENTO_VER: "cada colaborador consulta sus propias cifras",
  SERVICIOS_VER: "barbero, estilista o recepcionista",
  SERVICIOS_EDITAR: "encargado de servicios o supervisor",
  RESUMEN_VER: "personal administrativo; resumen de sus operaciones",
  PRODUCTOS_VER: "vendedor, bartender o personal de inventario",
  PRODUCTOS_EDITAR: "encargado del catálogo o personal de inventario",
  INVENTARIO_VER: "almacenero o personal de inventario; existencias del local",
  INVENTARIO_EDITAR: "personal de inventario; registra sus ajustes",
  COMPRAS_GESTIONAR: "comprador, contador o secretario; compras propias",
  VENTAS_GESTIONAR: "vendedor, barbero, cajero o bartender; ventas propias",
  VENTAS_ANULAR: "vendedor autorizado; sus ventas internas",
  CLIENTES_GESTIONAR: "recepcionista, secretario o vendedor",
  FACTURACION_VER: "contador o auxiliar administrativo; documentos propios",
  FACTURACION_EMITIR: "contador o facturador autorizado; ventas propias",
  IMPUESTOS_VER: "contador; impuestos de sus propias operaciones",
};
export const roleTemplates = [
  { nombre: "Personal obrero", permisos: ["ACTIVIDADES_GESTIONAR"] },
  {
    nombre: "Personal de inventario",
    permisos: [
      "INVENTARIO_VER",
      "INVENTARIO_EDITAR",
      "PRODUCTOS_VER",
      "ACTIVIDADES_GESTIONAR",
    ],
  },
  {
    nombre: "Barbero",
    permisos: ["SERVICIOS_VER", "ACTIVIDADES_GESTIONAR", "VENTAS_GESTIONAR"],
  },
  {
    nombre: "Cocinero",
    permisos: ["MESAS_GESTIONAR", "ACTIVIDADES_GESTIONAR"],
  },
  {
    nombre: "Bartender",
    permisos: ["MESAS_GESTIONAR", "PRODUCTOS_VER", "ACTIVIDADES_GESTIONAR"],
  },
  {
    nombre: "Contador",
    permisos: ["IMPUESTOS_VER", "FACTURACION_VER", "COMPRAS_GESTIONAR"],
  },
  {
    nombre: "Secretario",
    permisos: ["CLIENTES_GESTIONAR", "ACTIVIDADES_GESTIONAR"],
  },
  {
    nombre: "Vendedor",
    permisos: ["VENTAS_GESTIONAR", "PRODUCTOS_VER", "CLIENTES_GESTIONAR"],
  },
];
