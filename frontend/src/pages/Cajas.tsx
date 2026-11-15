import type { Caja } from "../lib/cajas";
import DetalleCaja from "../components/DetalleCaja";
import CajaPersonal from "../components/CajaPersonal";
import { useState } from "react";
import { api, date, money, type Session } from "../lib/api";
import { useData } from "../lib/useData";
import {
  Field,
  Form,
  PageTitle,
  ErrorNotice,
  Table,
  Badge,
} from "../components/ui";

export default function Cajas({
  session,
  query = "",
}: {
  session: Session;
  query?: string;
}) {
  const { data, error, loading, refresh } = useData(
    () => api<Caja[]>("/cajas" + query),
    [],
  );
  const acceso = useData(
    () =>
      session.rol === "SUPERADMIN"
        ? Promise.resolve({ fondoAsignado: null as number | null })
        : api<{ fondoAsignado: number | null }>("/cajas/mi-acceso"),
    { fondoAsignado: null as number | null },
  );
  const [selected, setSelected] = useState<Caja | null>(null),
    [failure, setFailure] = useState("");
  async function ver(id: number) {
    setFailure("");
    try {
      setSelected(await api<Caja>(`/cajas/${id}${query}`));
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        title="Caja y cierres"
        description="El corte conserva responsable, ventas y diferencia de efectivo. El efectivo esperado incluye fondo, ventas e ingresos de efectivo, menos egresos registrados."
      />
      <ErrorNotice message={error || failure || acceso.error} />
      {session.rol === "ADMIN" && (
        <CajaPersonal
          onChanged={() => {
            void refresh();
            void acceso.refresh();
          }}
        />
      )}
      {session.rol !== "SUPERADMIN" &&
        !data.some(
          (c) => c.estado === "ABIERTA" && c.usuario_original_id === session.id,
        ) && (
          <section className="surface">
            <h2>Abrir mi caja</h2>
            <Form
              label="Abrir caja"
              disabled={loading || acceso.loading}
              onSave={(d) =>
                api("/cajas", "POST", { fondo: Number(d.get("fondo")) })
              }
              onDone={() => {
                void refresh();
                window.dispatchEvent(new Event("caja-updated"));
              }}
            >
              <Field label="Fondo inicial en efectivo (S/)">
                <input
                  name="fondo"
                  type="number"
                  min="0"
                  max="999999999.99"
                  step="0.01"
                  key={String(acceso.data.fondoAsignado)}
                  defaultValue={acceso.data.fondoAsignado ?? 0}
                  readOnly={acceso.data.fondoAsignado !== null}
                  required
                />
              </Field>
              {acceso.data.fondoAsignado !== null && (
                <p className="hint">
                  Este fondo fue fijado por el administrador y no puede
                  modificarse al abrir.
                </p>
              )}
            </Form>
          </section>
        )}
      <section className="surface">
        <div className="section-toolbar">
          <h2>Cajas registradas</h2>
          <button
            onClick={() => {
              void refresh();
              void acceso.refresh();
            }}
          >
            Actualizar cajas
          </button>
        </div>
        {loading ? (
          <p role="status">Cargando cajas…</p>
        ) : (
          <Table
            headers={[
              "Caja",
              "Responsable",
              "Apertura",
              "Estado",
              "Cerró",
              "Ventas del corte",
              "Acciones",
            ]}
          >
            {data.map((c) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td>{c.usuario_nombre}</td>
                <td>{date(c.abierta)}</td>
                <td>
                  <Badge neutral={c.estado === "ABIERTA"}>{c.estado}</Badge>
                </td>
                <td>{c.cerrado_nombre || "—"}</td>
                <td>
                  {c.estado === "CERRADA"
                    ? `${c.cantidad_ventas} · ${money(c.total_ventas || 0)}`
                    : "En curso"}
                </td>
                <td>
                  <button onClick={() => void ver(c.id)}>
                    Ver caja<span className="sr-only"> {c.id}</span>
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {selected && (
        <DetalleCaja
          key={selected.id}
          caja={selected}
          query={query}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void refresh();
            window.dispatchEvent(new Event("caja-updated"));
          }}
        />
      )}
    </>
  );
}
