import { useRef, useState } from "react";
import { api, money, type Session, type Venta } from "../lib/api";
import { useData } from "../lib/useData";

import { Field, PageTitle, ErrorNotice, Empty } from "../components/ui";
import Recibo from "./Recibo";
type Servicio = {
  id: number;
  nombre: string;
  precio: number;
  duracion_minutos: number;
  activo: boolean;
  afectacion_igv: string;
};
export default function CobrarServicios({ session }: { session: Session }) {
  const { data, error, loading } = useData(
    () => api<Servicio[]>("/servicios"),
    [],
  );
  const [receipt, setReceipt] = useState<Venta | null>(null),
    [service, setService] = useState(""),
    [qty, setQty] = useState(1),
    [payment, setPayment] = useState("EFECTIVO"),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const selected = data.find((s) => String(s.id) === service && s.activo);
  return (
    <>
      <PageTitle
        title="Cobrar servicios"
        description={`Registra una atención en ${session.localNombre || "este local"}. El usuario que cobra queda registrado.`}
      />
      <ErrorNotice message={error || failure} />
      <section className="surface">
        {loading ? (
          <p role="status">Cargando servicios…</p>
        ) : !data.some((s) => s.activo) ? (
          <Empty>
            No hay servicios activos. El administrador puede crearlos en
            Servicios.
          </Empty>
        ) : (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selected || busy) return;
              setBusy(true);
              setFailure("");
              const body = {
                tipo: "TICKET",
                metodoPago: payment,
                lineas: [{ productoId: selected.id, cantidad: qty }],
              };
              const fingerprint = JSON.stringify(body);
              if (attempt.current?.body !== fingerprint)
                attempt.current = {
                  body: fingerprint,
                  id: crypto.randomUUID(),
                };
              try {
                setReceipt(
                  await api<Venta>("/ventas", "POST", {
                    ...body,
                    idempotencia: attempt.current.id,
                  }),
                );
                attempt.current = null;
              } catch (e) {
                setFailure((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              <legend className="sr-only">Datos del cobro</legend>
              <Field label="Servicio a cobrar">
                <select
                  value={service}
                  required
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value="">Selecciona un servicio</option>
                  {data
                    .filter((s) => s.activo)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} · {money(s.precio)}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Cantidad de servicios">
                  <input
                    value={qty}
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    required
                    onChange={(e) => setQty(Number(e.target.value))}
                  />
                </Field>
                <Field label="Medio de pago del servicio">
                  <select
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                  </select>
                </Field>
              </div>
            </fieldset>
            <p>
              Total: <strong>{money((selected?.precio || 0) * qty)}</strong>
            </p>
            <p className="hint">
              Genera una nota de venta interna. No conecta con bancos ni
              registra citas o comisiones.
            </p>
            <button className="primary" disabled={busy || !selected}>
              {busy ? "Registrando…" : "Confirmar cobro de servicio"}
            </button>
          </form>
        )}
      </section>
      {receipt && <Recibo venta={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
