import { useEffect, useState } from "react";
import { api, date, money, exportCsv } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, Table, ErrorNotice, Empty } from "./ui";
export type CicloCompra = {
  origen: "ORDEN" | "HISTORICA";
  id: number;
  numero: string | null;
  proveedor: string;
  referencia: string;
  fecha: string;
  estado: string;
  total: number;
  compra_id: number | null;
  usuario_nombre: string;
  recibido_nombre?: string;
  recibido_en?: string;
  documento_recepcion?: string;
};
function estadoCompra(o: CicloCompra) {
  return o.origen === "HISTORICA"
    ? "Compra histórica sin OC"
    : o.estado === "PENDIENTE"
      ? "Pendiente de recepción"
      : o.estado === "RECIBIDA"
        ? "Recibido / Completado"
        : "Cancelada";
}
export default function ListaCicloCompra({
  paso,
  onOrden,
  onCompra,
}: {
  paso: 2 | 3;
  onOrden: (id: number) => void;
  onCompra: (id: number) => void;
}) {
  const { data, error, loading, refresh } = useData(
    () => api<CicloCompra[]>("/compras-ciclo"),
    [],
  );
  const [estado, setEstado] = useState(paso === 3 ? "RECIBIDA" : "TODOS"),
    [search, setSearch] = useState("");
  useEffect(() => {
    const changed = () => void refresh();
    window.addEventListener("compras-updated", changed);
    return () => window.removeEventListener("compras-updated", changed);
  }, [refresh]);
  const rows = data.filter(
    (o) =>
      (estado === "TODOS" || o.estado === estado) &&
      `${o.numero || ""} ${o.compra_id || ""} ${o.proveedor} ${o.referencia} ${o.usuario_nombre}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="surface">
      <div className="section-toolbar">
        <h2>
          {paso === 2
            ? "Órdenes y su compra final"
            : "Compras recibidas y su OC de origen"}
        </h2>
        <button onClick={() => void refresh()}>Actualizar documentos</button>
        <button
          onClick={() =>
            exportCsv(
              "ciclo-compras.csv",
              [
                "OC",
                "Compra final",
                "Estado",
                "Proveedor",
                "Referencia",
                "Registró",
                "Fecha y hora (Perú)",
                "Recibió",
                "Fecha recepción (Perú)",
                "Documento recepción",
                "Total PEN",
              ],
              rows.map((o) => [
                o.numero,
                o.compra_id,
                estadoCompra(o),
                o.proveedor,
                o.referencia,
                o.usuario_nombre,
                date(o.fecha),
                o.recibido_nombre,
                o.recibido_en ? date(o.recibido_en) : "",
                o.documento_recepcion,
                o.total,
              ]),
            )
          }
        >
          Exportar CSV
        </button>
      </div>
      <ErrorNotice message={error} />
      <div className="form-grid">
        <Field label="Buscar OC, compra o proveedor">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Estado del ciclo de compra">
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="TODOS">Todos los estados</option>
            <option value="PENDIENTE">Pendiente de recepción</option>
            <option value="RECIBIDA">Recibido / Completado</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </Field>
      </div>
      {loading ? (
        <p role="status">Consultando pedidos y compras…</p>
      ) : rows.length ? (
        <Table
          headers={[
            "OC → Compra final",
            "Estado",
            "Proveedor / Referencia",
            "Registró / Fecha y hora (Perú)",
            "Recibió / Fecha y hora (Perú)",
            "Total",
            "Acciones",
          ]}
        >
          {rows.map((o) => (
            <tr key={`${o.origen}-${o.id}`}>
              <td>
                <strong>{o.numero || "Sin OC · Registro histórico"}</strong>
                <small>
                  {o.compra_id
                    ? `Compra #${o.compra_id}`
                    : o.estado === "CANCELADA"
                      ? "Sin compra final · Pedido cancelado"
                      : "Compra final: pendiente de recepción"}
                </small>
              </td>
              <td>{estadoCompra(o)}</td>
              <td>
                {o.proveedor}
                <small>{o.referencia}</small>
              </td>
              <td>
                {o.usuario_nombre || "Sin autor histórico"}
                <small>{date(o.fecha)}</small>
              </td>
              <td>
                {o.recibido_nombre || "Sin recepción registrada"}
                <small>{o.recibido_en && date(o.recibido_en)}</small>
                <small>{o.documento_recepcion}</small>
              </td>
              <td>{money(o.total)}</td>
              <td>
                <div className="row-actions">
                  {o.origen === "ORDEN" && (
                    <button onClick={() => onOrden(o.id)}>
                      Ver orden<span className="sr-only"> {o.numero}</span>
                    </button>
                  )}
                  {o.compra_id && (
                    <button onClick={() => onCompra(o.compra_id!)}>
                      Ver / descargar compra
                      <span className="sr-only"> #{o.compra_id}</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>
          No hay documentos para este filtro. Registra un pedido en el paso 1 o
          elige otro estado.
        </Empty>
      )}
    </section>
  );
}
