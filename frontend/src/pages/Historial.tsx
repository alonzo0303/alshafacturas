import OrdenesCompra from "./OrdenesCompra";
import { useSession } from "../lib/session";
import { useData } from "../lib/useData";
import { useState } from "react";
import { api, money, localDay, exportCsv, type Venta } from "../lib/api";
import { ErrorNotice, Empty, PageTitle, Table, Badge } from "../components/ui";
import Recibo from "./Recibo";
const saleDate = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
const saleTime = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));
export function Ventas({
  admin,
  fiscal = false,
  atencion = false,
}: {
  admin: boolean;
  fiscal?: boolean;
  atencion?: boolean;
}) {
  const own = useSession().rol !== "ADMIN";
  const { data, loading, error, refresh } = useData(
    () => api<Venta[]>("/ventas"),
    [],
  );
  const [receipt, setReceipt] = useState<Venta | null>(null),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const filtered = data.filter(
    (v) =>
      (!fiscal || v.tipo !== "TICKET") &&
      `${v.numero} ${v.cliente || ""} ${v.usuario_nombre || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!from || localDay(v.fecha) >= from) &&
      (!to || localDay(v.fecha) <= to),
  );
  async function ver(id: number) {
    setBusy(true);
    setActionError("");
    try {
      setReceipt(await api<Venta>(`/ventas/${id}`));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function anular(v: Venta) {
    const motivo = window.prompt(
      atencion
        ? `Motivo de anulación de ${v.numero}. Los servicios no generan movimientos de almacén.`
        : `Motivo de anulación de ${v.numero}. Se devolverán las unidades al inventario.`,
    );
    if (!motivo?.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/ventas/${v.id}/anular`, "POST", { motivo });
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title={
          fiscal
            ? "Facturación electrónica"
            : own
              ? "Mis ventas y reportes"
              : "Ventas y reportes"
        }
        description={
          fiscal
            ? "Solicitudes de comprobantes pendientes de emisión fiscal."
            : own
              ? "Últimas 500 ventas realizadas por ti. Filtra y exporta tus resultados."
              : "Últimas 500 ventas de tu empresa. Filtra y exporta el resultado."
        }
      >
        <button
          onClick={() =>
            exportCsv(
              "ventas.csv",
              [
                "Número",
                "Fecha (Perú)",
                "Hora (Perú)",
                "Vendido / cobrado por",
                "Cliente",
                "Tipo",
                "Estado",
                "Total PEN",
              ],
              filtered.map((v) => [
                v.numero,
                saleDate(v.fecha),
                saleTime(v.fecha),
                v.usuario_nombre || "Sin autor registrado",
                v.cliente,
                v.tipo,
                v.estado,
                v.total,
              ]),
            )
          }
        >
          Exportar CSV
        </button>
      </PageTitle>
      {fiscal && (
        <div className="notice">
          <strong>Integración fiscal pendiente.</strong> No se han enviado
          documentos a SUNAT. Para emitir comprobantes válidos se requiere
          definir proveedor, credenciales, certificado, series y pruebas de
          aceptación. Las notas NV01 son documentos internos.
        </div>
      )}
      <ErrorNotice message={error || actionError} />
      <section className="surface">
        <div className="section-toolbar">
          <input
            aria-label="Buscar ventas"
            placeholder="Número, cliente o personal"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="field">
            <span>Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button disabled={busy} onClick={() => void refresh()}>
            Actualizar
          </button>
        </div>
        {loading ? (
          <p role="status">Cargando ventas…</p>
        ) : filtered.length ? (
          <Table
            headers={[
              "Número / Fecha y hora (Perú)",
              "Vendido / cobrado por",
              "Cliente",
              "Documento",
              "Estado",
              "Stock actual",
              "Total",
              "Acciones",
            ]}
          >
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong className="mono">{v.numero}</strong>
                  <small>
                    <time dateTime={v.fecha}>
                      {saleDate(v.fecha)} · {saleTime(v.fecha)}
                    </time>
                  </small>
                </td>
                <td>{v.usuario_nombre || "Sin autor registrado"}</td>
                <td>{v.cliente || "Venta al público"}</td>
                <td>
                  {v.tipo}
                  <small>
                    {v.estado_fiscal === "PENDIENTE_CONFIGURACION"
                      ? "Sin emisión fiscal"
                      : "Documento interno"}
                  </small>
                </td>
                <td>
                  <Badge neutral={v.estado === "CONFIRMADA"}>{v.estado}</Badge>
                </td>
                <td>
                  {v.tiene_productos ? (
                    <span
                      className={
                        v.stock_alerta
                          ? "stock-level stock-low"
                          : "stock-level stock-optimal"
                      }
                    >
                      {v.stock_alerta ? "🔴 Stock bajo" : "🔵 Óptimo"}
                    </span>
                  ) : (
                    "No aplica"
                  )}
                </td>
                <td className="number">{money(v.total)}</td>
                <td>
                  <div className="row-actions">
                    <button disabled={busy} onClick={() => void ver(v.id)}>
                      Ver / Imprimir
                    </button>
                    {admin && v.estado === "CONFIRMADA" && (
                      <button disabled={busy} onClick={() => void anular(v)}>
                        Anular
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No hay ventas que coincidan con estos filtros.</Empty>
        )}
        <p className="report-total">
          Total confirmado del resultado:{" "}
          <strong>
            {money(
              filtered
                .filter((v) => v.estado === "CONFIRMADA")
                .reduce((t, v) => t + v.total, 0),
            )}
          </strong>
        </p>
      </section>
      {receipt && <Recibo venta={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
export function Compras() {
  return <OrdenesCompra paso={3} />;
}
