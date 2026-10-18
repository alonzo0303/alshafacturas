
export const permisos = {
  productos: "productos",
  inventario: "inventario",
  ventas: "ventas",
  compras: "compras",
  usuarios: "usuarios",
  reportes: "reportes",
} as const

export type Permiso =
  (typeof permisos)[keyof typeof permisos]

export const roles = {
  administrador: [
    "productos",
    "inventario",
    "ventas",
    "compras",
    "usuarios",
    "reportes",
  ],
  jefeAlmacen: [
    "productos",
    "inventario",
    "reportes",
  ],
  vendedor: [
    "ventas",
  ],
  encargadoCompras: [
    "compras",
    "productos",
  ],
} satisfies Record<string, Permiso[]>

export type Rol = keyof typeof roles

export function tienePermiso(
  rol: Rol,
  permiso: Permiso
): boolean {
  return roles[rol].some(
    (permisoAsignado) => permisoAsignado === permiso
  )
}
