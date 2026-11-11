import { useState } from "react";
import { api, date, money, type Venta } from "../lib/api";
import { useData } from "../lib/useData";
import { ErrorNotice, Empty, PageTitle, Table, Badge } from "../components/ui";
type Config = {
  configurado: boolean;
  ambiente: string;
  mensaje: string;
  serieFactura?: string;
  serieBoleta?: string;
};
type Cpe = {
  id: number;
  venta_id: number;
  ambiente: string;
  tipo: string;
  numero: string;
  estado: string;
  ticket?: string;
  codigo?: string;
  mensaje?: string;
  creado: string;
  venta_numero: string;
};
export default function Sunat({ admin }: { admin: boolean }) {
  const { data, error, loading, refresh } = useData<{
    config: Config | null;
    ventas: Venta[];
    comprobantes: Cpe[];
  }>(
    async () => ({
      config: await api<Config>("/sunat/configuracion"),
      ventas: await api<Venta[]>("/ventas"),
      comprobantes: await api<Cpe[]>("/sunat/comprobantes"),
    }),
    { config: null, ventas: [], comprobantes: [] },
  );
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  async function action(path: string, confirm: string) {
    if (!window.confirm(confirm)) return;
    setBusy(true);
    setActionError("");
    try {
      await api(path, "POST");
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = data.ventas.filter(
    (v) =>
      v.tipo !== "TICKET" &&
      v.estado === "CONFIRMADA" &&
      !data.comprobantes.some(
        (c) => c.venta_id === v.id && c.ambiente === data.config?.ambiente,
      ),
  );
  return (
    <>
      <PageTitle
        title="Facturación electrónica"
        description="Conexión directa con SUNAT. Facturas y resúmenes de boletas."
      >
        <button disabled={busy} onClick={() => void refresh()}>
          Actualizar
        </button>
      </PageTitle>
      <ErrorNotice message={error || actionError} />
      {loading ? (
        <p role="status">Consultando configuración y comprobantes…</p>
      ) : (
        <>
          <section className="surface">
            <h2>Estado de la conexión</h2>
            <p>
              <strong>
                {data.config?.ambiente === "BETA"
                  ? "BETA · Pruebas sin validez tributaria"
                  : data.config?.ambiente === "PRODUCCION"
                    ? "PRODUCCIÓN"
                    : "Pendiente de configuración segura"}
              </strong>
            </p>
            <p>{data.config?.mensaje}</p>
            {data.config?.configurado && (
              <p>
                Serie de facturas: {data.config.serieFactura}. Serie de boletas:{" "}
                {data.config.serieBoleta}.
              </p>
            )}
            <p>
              La configuración disponible no acredita que SUNAT haya aceptado un
              documento. Solo el CDR determina su resultado. Las notas NV01
              siguen siendo documentos internos.
            </p>
          </section>
          <section className="surface">
            <h2>Ventas pendientes de preparar comprobante</h2>
            {pending.length ? (
              <Table
                headers={["Venta", "Fecha", "Documento", "Total", "Acciones"]}
              >
                {pending.map((v) => (
                  <tr key={v.id}>
                    <td>{v.numero}</td>
                    <td>{date(v.fecha)}</td>
                    <td>{v.tipo}</td>
                    <td className="number">{money(v.total)}</td>
                    <td>
                      {admin ? (
                        <button
                          className="primary"
                          disabled={busy || !data.config?.configurado}
                          onClick={() =>
                            void action(
                              `/sunat/ventas/${v.id}/emitir`,
                              `¿Preparar y enviar ${v.tipo.toLowerCase()} de ${v.numero} a SUNAT en ${data.config?.ambiente}? Esta operación reservará un correlativo fiscal y bloqueará la anulación interna de la venta.`,
                            )
                          }
                        >
                          {busy ? "Procesando…" : "Preparar y enviar a SUNAT"}
                        </button>
                      ) : (
                        "El administrador realiza el envío"
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>
                No hay solicitudes pendientes en el ambiente configurado.
                Selecciona boleta o factura al registrar una venta.
              </Empty>
            )}
          </section>
          <section className="surface">
            <h2>Comprobantes y constancias</h2>
            {data.comprobantes.length ? (
              <Table
                headers={[
                  "Comprobante",
                  "Ambiente",
                  "Resultado",
                  "Detalle",
                  "Archivos / Acciones",
                ]}
              >
                {data.comprobantes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong className="mono">{c.numero}</strong>
                      <small>Venta {c.venta_numero}</small>
                    </td>
                    <td>
                      {c.ambiente === "BETA"
                        ? "BETA · Sin validez tributaria"
                        : "PRODUCCIÓN"}
                    </td>
                    <td>
                      <Badge neutral={c.estado === "ACEPTADO"}>
                        {c.estado}
                      </Badge>
                      {c.codigo && <small>Código CDR: {c.codigo}</small>}
                    </td>
                    <td>
                      {c.mensaje}
                      {c.ticket && <small>Ticket: {c.ticket}</small>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <a
                          className="button"
                          href={`/api/sunat/comprobantes/${c.id}/xml`}
                        >
                          XML firmado
                        </a>
                        {c.tipo === "03" && (
                          <a
                            className="button"
                            href={`/api/sunat/comprobantes/${c.id}/resumen`}
                          >
                            Resumen
                          </a>
                        )}
                        {["ACEPTADO", "RECHAZADO"].includes(c.estado) && (
                          <a
                            className="button"
                            href={`/api/sunat/comprobantes/${c.id}/cdr`}
                          >
                            CDR ZIP
                          </a>
                        )}
                        {admin && c.ticket && c.estado === "EN_PROCESO" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action(
                                `/sunat/comprobantes/${c.id}/consultar`,
                                "¿Consultar el resultado del ticket en SUNAT?",
                              )
                            }
                          >
                            Consultar ticket
                          </button>
                        )}
                        {admin &&
                          ["REVISAR", "ENVIANDO"].includes(c.estado) && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void action(
                                  `/sunat/comprobantes/${c.id}/reintentar`,
                                  "Confirma que revisaste el estado directamente en SUNAT. Se reenviará exactamente el mismo XML y número; no se descontará stock otra vez. Si ya fue aceptado, conserva su CDR y no intentes emitir otro documento.",
                                )
                              }
                            >
                              Reintentar tras revisión
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>
                Todavía no se ha preparado ningún comprobante fiscal.
              </Empty>
            )}
          </section>
          <div className="notice">
            Las notas de crédito y comunicaciones de baja aún requieren un flujo
            adicional. No anules internamente una venta cuyo comprobante haya
            sido preparado o enviado a SUNAT.
          </div>
        </>
      )}
    </>
  );
}
