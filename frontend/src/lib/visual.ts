export const moduleLabels: Record<string, string> = {
  RESUMEN: "Resumen",
  PRODUCTOS: "Productos y catálogo",
  SERVICIOS: "Servicios",
  VENTAS: "Ventas",
  CLIENTES: "Clientes",
  INVENTARIO: "Inventario",
  COMPRAS: "Compras",
  PREPARACION: "Preparación",
  MESAS: "Mesas y pedidos",
  CAJA: "Caja",
  ACTIVIDADES: "Actividades",
  RENDIMIENTO: "Rendimiento",
  FACTURACION: "Facturación",
  IMPUESTOS: "Impuestos",
};
export type VisualConfig = {
  modalidad: "COMERCIO" | "ATENCION";
  tipoAtencion: string | null;
  colorPrimario: string | null;
  diseno: "AMPLIO" | "COMPACTO";
  modulosVisibles: string[];
  ordenModulos: string[];
  version: number;
};
export function moduleForPath(path: string) {
  const part = path.split("/").pop() || "";
  const map: Record<string, string> = {
    panel: "RESUMEN",
    pos: "VENTAS",
    ventas: "VENTAS",
    productos: "PRODUCTOS",
    catalogo: "PRODUCTOS",
    servicios: "SERVICIOS",
    cobrar: "VENTAS",
    clientes: "CLIENTES",
    inventario: "INVENTARIO",
    compra: "COMPRAS",
    compras: "COMPRAS",
    "ordenes-compra": "COMPRAS",
    preparaciones: "PREPARACION",
    mesas: "MESAS",
    cajas: "CAJA",
    actividades: "ACTIVIDADES",
    rendimiento: "RENDIMIENTO",
    facturacion: "FACTURACION",
    tributacion: "IMPUESTOS",
  };
  return map[part];
}
