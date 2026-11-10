import { useData } from "../lib/useData";
import { useState } from "react";
import { api, money, date, localDay, exportCsv, type Venta } from "../lib/api";
import { ErrorNotice, Empty, PageTitle, Table, Badge } from "../components/ui";
import Recibo from "./Recibo";
export function Ventas({
  admin,
  fiscal = false,
}: {
  admin: boolean;
  fiscal?: boolean;
}) {
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
      `${v.numero} ${v.cliente || ""}`
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
      `Motivo de anulación de ${v.numero}. Se devolverán las unidades al inventario.`,
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
        title={fiscal ? "Facturación electrónica" : "Ventas y reportes"}
        description={
          fiscal
            ? "Solicitudes de comprobantes pendientes de emisión fiscal."
            : "Últimas 500 ventas de tu empresa. Filtra y exporta el resultado."
        }
      >
        <button
          onClick={() =>
            exportCsv(
              "ventas.csv",
              ["Número", "Fecha", "Cliente", "Tipo", "Estado", "Total PEN"],
              filtered.map((v) => [
                v.numero,
                v.fecha,
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
            placeholder="Número o cliente"
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
              "Número / Fecha",
              "Cliente",
              "Documento",
              "Estado",
              "Total",
              "Acciones",
            ]}
          >
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong className="mono">{v.numero}</strong>
                  <small>{date(v.fecha)}</small>
                </td>
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
type Compra = {
  id: number;
  fecha: string;
  proveedor: string;
  referencia: string;
  total: number;
  subtotal: number;
  igv: number;
  tipo_documento: string;
  proveedor_ruc?: string;
  credito_fiscal: boolean;
};
export function Compras() {
  const { data, loading, error, refresh } = useData(
    () => api<Compra[]>("/compras"),
    [],
  );
  return (
    <>
      <PageTitle
        title="Historial de compras"
        description="Últimas 500 entradas de mercadería registradas."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Compras registradas</h2>
          <button onClick={() => void refresh()}>Actualizar</button>
          <button
            onClick={() =>
              exportCsv(
                "compras.csv",
                [
                  "Fecha",
                  "Proveedor",
                  "Referencia",
                  "Base PEN",
                  "IGV PEN",
                  "Total PEN",
                  "Crédito fiscal potencial",
                ],
                data.map((c) => [
                  c.fecha,
                  c.proveedor,
                  c.referencia,
                  c.subtotal,
                  c.igv,
                  c.total,
                  c.credito_fiscal ? "Por validar" : "No marcado",
                ]),
              )
            }
          >
            Exportar CSV
          </button>
        </div>
        {loading ? (
          <p role="status">Cargando compras…</p>
        ) : data.length ? (
          <Table
            headers={[
              "Fecha",
              "Proveedor",
              "Documento",
              "Base",
              "IGV",
              "Total",
              "Crédito fiscal potencial",
            ]}
          >
            {data.map((c) => (
              <tr key={c.id}>
                <td>{date(c.fecha)}</td>
                <td>
                  {c.proveedor}
                  <small>{c.proveedor_ruc}</small>
                </td>
                <td>
                  {c.tipo_documento}
                  <small>{c.referencia}</small>
                </td>
                <td>{money(c.subtotal)}</td>
                <td>{money(c.igv)}</td>
                <td className="number">{money(c.total)}</td>
                <td>
                  {c.credito_fiscal ? "Por validar con contador" : "No marcado"}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Registra una compra para ingresar mercadería.</Empty>
        )}
      </section>
    </>
  );
}
