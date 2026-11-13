export type Session = {
  id: number;
  empresaId: number;
  nombre: string;
  correo: string;
  rol: string;
  permisos: string[];
  modalidad: "COMERCIO" | "ATENCION";
  tipoAtencion: string | null;
  localId: number | null;
  localNombre: string | null;
  tipoNombre?: string;
  nichoEmoji?: string;
  nichoTema?: string;
};
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
let currentLocal: number | null = null;
type Csrf = { headerName: string; token: string };
async function transport(
  path: string,
  options: RequestInit,
): Promise<Response> {
  try {
    return await fetch(path, options);
  } catch {
    throw new Error(
      "No se pudo completar la conexión. Revisa el historial antes de repetir una venta o compra.",
    );
  }
}
export const localDay = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (currentLocal !== null) headers["X-Local-Id"] = String(currentLocal);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD"].includes(method)) {
    const response = await transport("/api/auth/csrf", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if ([401, 403].includes(response.status))
        window.dispatchEvent(new Event("session-invalid"));
      throw new ApiError(
        "No se pudo verificar la sesión. Inténtalo nuevamente.",
        response.status,
      );
    }
    const csrf: Csrf = await response.json();
    headers[csrf.headerName] = csrf.token;
  }
  const res = await transport(`/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    signal: AbortSignal.timeout(path.startsWith("/sunat/") ? 65000 : 20000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (
      (res.status === 401 ||
        (res.status === 403 && data.codigo === "SESION_REVOCADA")) &&
      !path.includes("/login")
    )
      window.dispatchEvent(new Event("session-invalid"));
    throw new ApiError(
      data.mensaje ||
        "No se pudo completar la operación. Inténtalo nuevamente.",
      res.status,
    );
  }
  const text = await res.text();
  const result = text ? JSON.parse(text) : undefined;
  if (result && ["/auth/me", "/auth/login", "/auth/admin/login"].includes(path))
    currentLocal = result.localId ?? null;
  return result as T;
}
export const money = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    value || 0,
  );
export const date = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
export type Producto = {
  imagen_version?: string | null;
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  stock: number;
  minimo: number;
  activo: boolean;
  marca: string;
  categoria: string;
  presentacion: string;
  codigo_barras: string | null;
  catalogo_id: number | null;
  ultimo_costo?: number | null;
  afectacion_igv: string;
  precio_sin_igv: number;
};
export type Cliente = {
  id: number;
  documento: string;
  nombre: string;
  correo: string;
  direccion: string;
};
export type Empresa = {
  id: number;
  ruc: string | null;
  razonSocial: string;
  direccion: string;
  estado: "ACTIVA" | "PENDIENTE" | "SUSPENDIDA";
};
export type Venta = {
  id: number;
  numero: string;
  fecha: string;
  estado: string;
  tipo: string;
  estado_fiscal: string;
  stock_alerta?: boolean;
  tiene_productos?: boolean;
  total: number;
  subtotal: number;
  igv: number;
  metodo_pago: string;
  cliente?: string;
  cliente_documento?: string;
  local_id?: number;
  local_nombre?: string;
  local_direccion?: string;
  razon_social?: string;
  ruc?: string;
  direccion?: string;
  lineas?: {
    id: number;
    nombre: string;
    cantidad: number;
    precio: number;
    total: number;
    afectacion_igv?: string;
    base?: number;
    igv?: number;
  }[];
};
export function exportCsv(name: string, headers: string[], rows: unknown[][]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@-]/.test(s.trimStart()) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const url = URL.createObjectURL(
    new Blob(
      [
        "\ufeff" +
          [headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function localHeaders(): Record<string, string> {
  return currentLocal === null ? {} : { "X-Local-Id": String(currentLocal) };
}
export async function binary(
  path: string,
  method = "GET",
  file?: File,
): Promise<Response> {
  const headers: Record<string, string> = { ...localHeaders() };
  if (method !== "GET") {
    const token = await api<{ headerName: string; token: string }>(
      "/auth/csrf",
    );
    headers[token.headerName] = token.token;
  }
  if (file) headers["Content-Type"] = file.type;
  const response = await transport("/api" + path, {
    method,
    headers,
    body: file,
    credentials: "same-origin",
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (
      response.status === 401 ||
      (response.status === 403 && data.codigo === "SESION_REVOCADA")
    )
      window.dispatchEvent(new Event("session-invalid"));
    throw new ApiError(
      data.mensaje || "No se pudo completar la descarga o subida.",
      response.status,
    );
  }
  return response;
}
export async function downloadFile(path: string, name: string) {
  const response = await binary(path);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
