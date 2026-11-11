import { createContext, useContext } from "react";
import type { Session } from "./api";
export const SessionContext = createContext<Session | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Sesión requerida");
  return session;
}
export function can(session: Session, permission: string) {
  return session.rol === "ADMIN" || session.permisos?.includes(permission);
}
export const permissionLabels: Record<string, string> = {
  RESUMEN_VER: "Ver resumen del negocio",
  PRODUCTOS_VER: "Consultar productos y catálogo",
  PRODUCTOS_EDITAR: "Crear y editar productos",
  INVENTARIO_VER: "Consultar inventario",
  INVENTARIO_EDITAR: "Registrar ajustes de inventario",
  COMPRAS_GESTIONAR: "Registrar y consultar compras",
  VENTAS_GESTIONAR: "Registrar y consultar ventas",
  VENTAS_ANULAR: "Anular ventas internas",
  CLIENTES_GESTIONAR: "Gestionar clientes",
  FACTURACION_VER: "Consultar documentos electrónicos",
  FACTURACION_EMITIR: "Enviar comprobantes a SUNAT",
  IMPUESTOS_VER: "Consultar información de IGV",
};
export const taxLabels: Record<string, string> = {
  GRAVADO: "Gravado · IGV 18%",
  EXONERADO: "Exonerado",
  INAFECTO: "Inafecto",
  SIN_IGV: "Gestión interna sin desglose fiscal",
};
