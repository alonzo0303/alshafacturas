import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, Form, ErrorNotice } from "./ui";
export default function CobranzaAdmin() {
  const config = useData(
    () =>
      api<{ instruccionesPago: string }>("/admin/suscripciones/configuracion"),
    null,
  );
  const resumen = useData(
    () =>
      api<{ activos: number; programados: number; vencidos: number }>(
        "/admin/suscripciones/resumen",
      ),
    null,
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mensaje, setMensaje] = useState("");
  return (
    <>
      <ErrorNotice message={error || config.error || resumen.error} />
      {resumen.data && (
        <section
          className="surface plan-summary"
          aria-label="Resumen de membresías"
        >
          <div>
            <small>Planes activos</small>
            <strong>{resumen.data.activos}</strong>
          </div>
          <div>
            <small>Programados</small>
            <strong>{resumen.data.programados}</strong>
          </div>
          <div>
            <small>Vencidos</small>
            <strong>{resumen.data.vencidos}</strong>
          </div>
        </section>
      )}
      <section className="surface">
        <h2>Recordatorios y renovación</h2>
        <p>
          Revisión diaria a las 00:05, hora de Perú, y al iniciar el servidor.
          Se emite un aviso interno al día de D-5 a D-0, sin duplicados.
        </p>
        {config.data && (
          <Form
            label="Guardar instrucciones de pago"
            key={config.data.instruccionesPago}
            onSave={(d) =>
              api("/admin/suscripciones/configuracion", "PUT", {
                instruccionesPago: d.get("instruccionesPago"),
              })
            }
            onDone={() => void config.refresh()}
          >
            <Field label="Instrucciones de pago para los negocios">
              <textarea
                name="instruccionesPago"
                required
                maxLength={1500}
                rows={3}
                defaultValue={config.data.instruccionesPago}
              />
            </Field>
          </Form>
        )}
        <button
          className="review-subscriptions"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMensaje("");
            try {
              await api("/admin/suscripciones/revisar", "POST", {});
              await resumen.refresh();
              setMensaje(
                "Revisión completada. Los recordatorios existentes no se duplican.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Revisando…" : "Revisar vencimientos ahora"}
        </button>
        <p role="status">{mensaje}</p>
      </section>
    </>
  );
}
