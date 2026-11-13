import { useState } from "react";
import { api, date, money } from "../lib/api";
import { useData } from "../lib/useData";
import type { Pedido } from "../lib/pedidos";
import {
  PageTitle,
  Field,
  Form,
  ErrorNotice,
  Modal,
  Table,
  Badge,
} from "../components/ui";
import EditorPedido from "../components/EditorPedido";
type Mesa = {
  id: number;
  nombre: string;
  capacidad: number;
  activo: boolean;
  pedido_id: number | null;
};
export function Mesas() {
  const { data, error, loading, refresh } = useData(
    () => api<Mesa[]>("/mesas"),
    [],
  );
  const [edit, setEdit] = useState<Mesa | null | undefined>(undefined),
    [pedido, setPedido] = useState<Pedido | null>(null),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  async function abrir(m: Mesa) {
    setBusy(true);
    setFailure("");
    try {
      setPedido(
        m.pedido_id
          ? await api<Pedido>(`/pedidos/${m.pedido_id}`)
          : await api<Pedido>("/pedidos", "POST", {
              clase: "MESA",
              mesaId: m.id,
              idempotencia: crypto.randomUUID(),
            }),
      );
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Mesas"
        description="Crea y organiza las mesas de este local. Un pedido abierto por mesa; el stock se descuenta al cobrar."
      >
        <button className="primary" onClick={() => setEdit(null)}>
          Nueva mesa
        </button>
      </PageTitle>
      <ErrorNotice message={error || failure} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Mesas del local</h2>
          <button onClick={() => void refresh()}>Actualizar mesas</button>
        </div>
        {loading ? (
          <p role="status">Cargando mesas…</p>
        ) : (
          <div className="catalog-grid">
            {data.map((m) => (
              <article className="catalog-item" key={m.id}>
                <h3>{m.nombre}</h3>
                <p>{m.capacidad} personas</p>
                <Badge neutral={!m.pedido_id}>
                  {!m.activo
                    ? "Inactiva"
                    : m.pedido_id
                      ? "Con pedido abierto"
                      : "Libre"}
                </Badge>
                <div className="row-actions">
                  <button
                    disabled={busy || !m.activo}
                    onClick={() => void abrir(m)}
                  >
                    {m.pedido_id ? "Abrir pedido" : "Atender mesa"}
                    <span className="sr-only"> {m.nombre}</span>
                  </button>
                  <button disabled={busy} onClick={() => setEdit(m)}>
                    Editar mesa<span className="sr-only"> {m.nombre}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {edit !== undefined && (
        <Modal
          title={edit ? "Editar mesa" : "Nueva mesa"}
          onClose={() => setEdit(undefined)}
        >
          <Form
            label="Guardar mesa"
            onSave={(d) =>
              api(
                edit ? `/mesas/${edit.id}` : "/mesas",
                edit ? "PUT" : "POST",
                {
                  nombre: d.get("nombre"),
                  capacidad: Number(d.get("capacidad")),
                  activo: d.get("activo") === "on",
                },
              )
            }
            onDone={() => {
              setEdit(undefined);
              void refresh();
            }}
          >
            <Field label="Nombre de la mesa">
              <input
                name="nombre"
                required
                maxLength={100}
                defaultValue={edit?.nombre}
              />
            </Field>
            <Field label="Capacidad de la mesa">
              <input
                name="capacidad"
                type="number"
                min="1"
                max="100"
                step="1"
                defaultValue={edit?.capacidad || 4}
                required
              />
            </Field>
            <label className="check">
              <input
                name="activo"
                type="checkbox"
                defaultChecked={edit?.activo ?? true}
              />
              Mesa activa
            </label>
          </Form>
        </Modal>
      )}
      {pedido && (
        <EditorPedido
          key={pedido.id}
          pedido={pedido}
          onClose={() => {
            setPedido(null);
            void refresh();
          }}
          onChanged={() => void refresh()}
        />
      )}
    </>
  );
}
export default function Preparaciones() {
  const { data, error, loading, refresh } = useData(
    () => api<(Pedido & { total: number })[]>("/pedidos?clase=PREPARACION"),
    [],
  );
  const [pedido, setPedido] = useState<Pedido | null>(null),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  async function abrir(id?: number) {
    setFailure("");
    setBusy(true);
    try {
      setPedido(
        id
          ? await api<Pedido>(`/pedidos/${id}`)
          : await api<Pedido>("/pedidos", "POST", {
              clase: "PREPARACION",
              idempotencia: crypto.randomUUID(),
            }),
      );
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Preparación de pedidos"
        description="Hojas internas para recolectar artículos antes del cobro. No son guías de remisión electrónicas ni reservan stock."
      >
        <button
          className="primary"
          disabled={busy}
          onClick={() => void abrir()}
        >
          Nueva preparación
        </button>
      </PageTitle>
      <ErrorNotice message={error || failure} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Pedidos registrados</h2>
          <button disabled={busy} onClick={() => void refresh()}>
            Actualizar preparaciones
          </button>
        </div>
        {loading ? (
          <p role="status">Cargando pedidos…</p>
        ) : (
          <Table
            headers={[
              "Pedido",
              "Fecha",
              "Responsable",
              "Estado",
              "Total",
              "Acciones",
            ]}
          >
            {data.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{date(p.fecha)}</td>
                <td>{p.usuario_nombre}</td>
                <td>{p.estado}</td>
                <td>{money(p.total)}</td>
                <td>
                  <button disabled={busy} onClick={() => void abrir(p.id)}>
                    Abrir preparación<span className="sr-only"> {p.id}</span>
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {pedido && (
        <EditorPedido
          key={pedido.id}
          pedido={pedido}
          onClose={() => setPedido(null)}
          onChanged={() => void refresh()}
        />
      )}
    </>
  );
}
