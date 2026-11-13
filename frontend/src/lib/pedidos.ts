export type PedidoLinea = {
  producto_id: number;
  nombre: string;
  sku: string;
  cantidad: number;
  precio: number;
};
export type Pedido = {
  id: number;
  clase: string;
  estado: string;
  version: number;
  mesa_id: number | null;
  mesa?: string;
  fecha: string;
  usuario_nombre: string;
  observacion: string;
  venta_id: number | null;
  lineas: PedidoLinea[];
  empresa?: { razon_social: string; ruc: string | null; direccion: string };
  local?: { nombre: string; direccion: string };
};
export type ArticuloPedido = {
  id: number;
  nombre: string;
  sku: string;
  precio: number;
  clase: string;
  stock: number;
};
