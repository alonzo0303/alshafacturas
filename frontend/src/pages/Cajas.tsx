import { useState } from "react";
import { api, date, money, type Session } from "../lib/api";
import { useData } from "../lib/useData";
import {
  Field,
  Form,
  PageTitle,
  ErrorNotice,
  Table,
  Modal,
  Badge,
} from "../components/ui";
type Caja = {
  id: number;
  usuario_original_id: number;
  usuario_nombre: string;
  abierta: string;
  cerrada: string | null;
  estado: string;
  fondo: number;
  cerrado_nombre: string | null;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  total_ventas: number | null;
  cantidad_ventas: number | null;
  medios?: { metodo_pago: string; ventas: number; total: number }[];
};
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
        description="El corte conserva responsable, ventas y diferencia de efectivo. El efectivo esperado incluye el fondo inicial y las ventas en efectivo confirmadas."
      />
      <ErrorNotice message={error || failure} />
      {session.rol !== "SUPERADMIN" &&
        !data.some(
          (c) => c.estado === "ABIERTA" && c.usuario_original_id === session.id,
        ) && (
          <section className="surface">
            <h2>Abrir mi caja</h2>
            <Form
              label="Abrir caja"
              onSave={(d) =>
                api("/cajas", "POST", { fondo: Number(d.get("fondo")) })
              }
              onDone={() => void refresh()}
            >
              <Field label="Fondo inicial en efectivo (S/)">
                <input
                  name="fondo"
                  type="number"
                  min="0"
                  max="999999999.99"
                  step="0.01"
                  defaultValue="0"
                  required
                />
              </Field>
            </Form>
          </section>
        )}
      <section className="surface">
        <div className="section-toolbar">
          <h2>Cajas registradas</h2>
          <button onClick={() => void refresh()}>Actualizar cajas</button>
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
        <Modal title={`Caja #${selected.id}`} onClose={() => setSelected(null)}>
          <p>
            Responsable: <strong>{selected.usuario_nombre}</strong> · Fondo:{" "}
            {money(selected.fondo)}
          </p>
          <Table headers={["Medio de pago", "Ventas", "Total"]}>
            {selected.medios?.map((m) => (
              <tr key={m.metodo_pago}>
                <td>{m.metodo_pago}</td>
                <td>{m.ventas}</td>
                <td>{money(m.total)}</td>
              </tr>
            ))}
          </Table>
          {selected.estado === "ABIERTA" ? (
            <Form
              label="Confirmar cierre de caja"
              onSave={(d) =>
                api(`/cajas/${selected.id}/cerrar${query}`, "POST", {
                  efectivoContado: Number(d.get("efectivo")),
                })
              }
              onDone={() => {
                setSelected(null);
                void refresh();
              }}
            >
              <p>
                Las ventas de esta caja quedarán cerradas. No se incluyen
                retiros ni gastos de caja en esta versión.
              </p>
              <Field label="Efectivo contado al cierre (S/)">
                <input
                  name="efectivo"
                  type="number"
                  min="0"
                  max="999999999999.99"
                  step="0.01"
                  required
                />
              </Field>
            </Form>
          ) : (
            <>
              <p>
                Cerró: {selected.cerrado_nombre} ·{" "}
                {selected.cerrada && date(selected.cerrada)}
              </p>
              <p>Efectivo esperado: {money(selected.efectivo_esperado || 0)}</p>
              <p>Efectivo contado: {money(selected.efectivo_contado || 0)}</p>
              <p>
                Diferencia: <strong>{money(selected.diferencia || 0)}</strong>
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
