import { useRef, useState } from "react";
import { api, money } from "../lib/api";
import type { PlanState } from "../pages/Planes";
import { Field, Form, ErrorNotice } from "./ui";
type Cotizacion = {
  pagoId: number;
  planAnterior: string;
  plan: string;
  fecha: string;
  hasta: string;
  diasCiclo: number;
  diasRestantes: number;
  importe: number;
};
export default function UpgradePlan({
  empresa,
  state,
  onChanged,
}: {
  empresa: string;
  state: PlanState;
  onChanged: (s: PlanState) => void;
}) {
  const [codigo, setCodigo] = useState(""),
    [q, setQ] = useState<Cotizacion | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  if (!state.vigente) return null;
  return (
    <section className="surface">
      <h2>Subir de plan desde hoy</h2>
      <p>
        Conserva el vencimiento actual. Se cobra la diferencia de tarifa por los
        días restantes, incluyendo hoy. Las renovaciones futuras conservan su
        plan.
      </p>
      <ErrorNotice message={error} />
      <Field label="Nuevo plan para este período">
        <select
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            setQ(null);
          }}
        >
          <option value="">Seleccionar plan superior</option>
          {state.planes
            .filter(
              (p) =>
                p.precio >
                Number(
                  state.pagoActual?.tarifa_actual ??
                    state.pagoActual?.importe ??
                    0,
                ),
            )
            .map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {money(p.precio)} · {p.nombre}
              </option>
            ))}
        </select>
      </Field>
      <button
        disabled={!codigo || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setQ(
              await api<Cotizacion>(
                `/empresas/${empresa}/upgrade?plan=${codigo}`,
              ),
            );
            key.current = crypto.randomUUID();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Calcular diferencia de hoy
      </button>
      {q && (
        <>
          <p>
            Desde {q.fecha} hasta {q.hasta}. Restan {q.diasRestantes} de{" "}
            {q.diasCiclo} días. Diferencia a recibir:{" "}
            <strong>{money(q.importe)}</strong>.
          </p>
          <Form
            key={q.plan + q.fecha + q.importe}
            label="Confirmar upgrade inmediato"
            onSave={async (d) => {
              const result = await api<PlanState>(
                `/empresas/${empresa}/upgrade`,
                "POST",
                {
                  ...q,
                  referencia: d.get("referencia"),
                  confirmado: d.get("confirmado") === "on",
                  idempotencia: key.current,
                },
              );
              onChanged(result);
            }}
            onDone={() => {
              setQ(null);
              setCodigo("");
            }}
          >
            <Field label="Referencia del pago adicional">
              <input name="referencia" required maxLength={120} />
            </Field>
            <label className="check">
              <input type="checkbox" name="confirmado" required />
              Confirmo que recibí y verifiqué este pago adicional
            </label>
          </Form>
        </>
      )}
    </section>
  );
}
