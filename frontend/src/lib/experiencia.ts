export type Etapa = { codigo: string; nombre: string };
export type Flujo = {
  codigo: string;
  nombre: string;
  clase: "SERVICIO" | "LOGISTICA" | "ATENCION";
  etapas: Etapa[];
};
export type Metrica = {
  clave: string;
  titulo: string;
  operacion: string;
  flujoCodigo: string | null;
  clase: Flujo["clase"] | null;
  meta: number | null;
};
export type Definicion = { metricas: Metrica[]; flujos: Flujo[] };
export type PlantillaPerfil = {
  id: number;
  familia: string;
  version: number;
  empresa_propietaria_id: number | null;
  codigo: string;
  nombre: string;
  rubro: string;
  tipo: "BASE" | "PERSONALIZADA";
  definicion: Definicion;
};
export type PerfilConfig = {
  empresaId: number;
  localId: number;
  modo: "GENERAL" | "ESPECIFICO" | "PERSONALIZADO";
  heredado: boolean;
  plantilla: PlantillaPerfil;
};
export type ValorMetrica = {
  clave: string;
  titulo: string;
  operacion: string;
  valor: number | null;
  unidad: "MONEDA" | "MINUTOS" | "ENTERO" | "RATIO";
  disponible: boolean;
  detalle: string;
  meta: number | null;
  alcance: string;
};
export type ReportePerfil = {
  configuracion: PerfilConfig;
  metricas: ValorMetrica[];
  colaboradores: { id: number; nombre: string; metricas: ValorMetrica[] }[];
  atribucion: string;
};
export type Actividad = {
  id: number;
  titulo: string;
  detalle: string;
  estado: string;
  version: number;
  flujo_codigo: string;
  flujo_definicion: Flujo;
  ejecutor_original_id: number;
  ejecutor_nombre: string;
  creador_nombre: string;
  creada: string;
  iniciada: string | null;
  completada: string | null;
  finalizada: boolean;
  cancelada: boolean;
  eventos?: {
    version: number;
    tipo: string;
    estado: string;
    actor_nombre: string;
    ocurrido_en: string;
    detalle: string;
  }[];
};
export const operaciones: Record<string, string> = {
  VENTAS_CONTAR: "Ventas confirmadas",
  VENTAS_TOTAL: "Total vendido",
  VENTAS_UNIDADES: "Unidades vendidas",
  VENTAS_TICKET_PROMEDIO: "Ticket promedio",
  VENTAS_UNIDADES_TICKET: "Unidades por ticket",
  VENTAS_COMIDAS: "Comidas marcadas vendidas",
  CAJAS_CIERRES: "Cierres de caja",
  CAJAS_DIFERENCIA: "Diferencia de caja",
  ACTIVIDADES_CREADAS: "Actividades creadas para el responsable",
  ACTIVIDADES_COMPLETADAS: "Actividades completadas",
  ACTIVIDADES_TIEMPO_PROMEDIO: "Duración real promedio de actividades",
  PEDIDOS_TOMADOS: "Pedidos de mesa tomados",
  PEDIDOS_TIEMPO_PRIMER_SERVICIO: "Tiempo hasta primera entrega a mesa",
  INVENTARIO_ROTACION_UNIDADES: "Rotación del inventario en unidades",
};

export const editorKey = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 10);
export const nuevaMetrica = (): Metrica => ({
  clave: "m_" + editorKey(),
  titulo: "",
  operacion: "VENTAS_CONTAR",
  flujoCodigo: null,
  clase: null,
  meta: null,
});
export const nuevoFlujo = (): Flujo => ({
  codigo: "F_" + editorKey().toUpperCase(),
  nombre: "",
  clase: "SERVICIO",
  etapas: [
    { codigo: "PENDIENTE", nombre: "Pendiente" },
    { codigo: "EN_CURSO", nombre: "En curso" },
    { codigo: "FINALIZADO", nombre: "Completado" },
  ],
});
