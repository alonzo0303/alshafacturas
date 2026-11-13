import { useRef, useState } from "react";
import { api, date, type Session } from "../lib/api";
import { useSession, can } from "../lib/session";
import { useData } from "../lib/useData";
import type { Actividad, PerfilConfig } from "../lib/experiencia";
import {
  Field,
  Form,
  Modal,
  PageTitle,
  Table,
  ErrorNotice,
  Empty,
} from "../components/ui";
export default function Actividades({
  query = "",
  session: provided,
}: {
  query?: string;
  session?: Session;
}) {
  const current = useSession(),
    session = provided || current;
  const admin = ["ADMIN", "SUPERADMIN"].includes(session.rol);
  const perfil = useData(
    () => api<PerfilConfig>("/experiencia/configuracion" + query),
    null,
  );
  const rows = useData(
    () => api<Actividad[]>("/experiencia/actividades" + query),
    [],
  );
  const users = useData(
    () =>
      admin
        ? api<{ id: number; nombre: string }[]>(
            "/experiencia/actividades/responsables" + query,
          )
        : Promise.resolve([{ id: session.id, nombre: session.nombre }]),
    [],
  );
  const servicios = useData(
    () =>
      session.rol !== "SUPERADMIN" && can(session, "SERVICIOS_VER")
        ? api<{ id: number; nombre: string }[]>("/servicios")
        : Promise.resolve([]),
    [],
  );
  const creationKey = useRef(crypto.randomUUID());
  const [selected, setSelected] = useState<Actividad | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false),
    [nuevo, setNuevo] = useState(false);
  async function load(id: number) {
    setError("");
    try {
      setSelected(
        await api<Actividad>(`/experiencia/actividades/${id}${query}`),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function update(estado: string, motivo?: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api<Actividad>(
        `/experiencia/actividades/${selected.id}/etapa${query}`,
        "POST",
        { version: selected.version, estado, motivo },
      );
      setSelected(
        await api<Actividad>(`/experiencia/actividades/${selected.id}${query}`),
      );
      await rows.refresh();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const steps = selected?.flujo_definicion.etapas || [],
    index = steps.findIndex((s) => s.codigo === selected?.estado),
    next = steps[index + 1];
  return (
    <>
      <PageTitle
        title="Actividades y servicios"
        description="Registra trabajo real, responsable y etapas. Completar una actividad no cobra ni modifica inventario."
      />
      <ErrorNotice
        message={
          error || rows.error || perfil.error || users.error || servicios.error
        }
      />
      <div className="section-toolbar">
        <button
          className="primary"
          disabled={!perfil.data?.plantilla.definicion.flujos.length}
          onClick={() => {
            creationKey.current = crypto.randomUUID();
            setNuevo(true);
          }}
        >
          Nueva actividad
        </button>
        <button onClick={() => void rows.refresh()}>
          Actualizar actividades
        </button>
      </div>
      {rows.loading ? (
        <p role="status">Cargando actividades…</p>
      ) : rows.data.length ? (
        <section className="surface">
          <Table
            headers={[
              "Actividad",
              "Responsable",
              "Etapa",
              "Registro",
              "Acciones",
            ]}
          >
            {rows.data.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.titulo}
                  <small>{a.flujo_definicion.nombre}</small>
                </td>
                <td>{a.ejecutor_nombre}</td>
                <td>
                  {a.cancelada
                    ? "Cancelada"
                    : a.flujo_definicion.etapas.find(
                        (s) => s.codigo === a.estado,
                      )?.nombre || a.estado}
                </td>
                <td>{date(a.creada)}</td>
                <td>
                  <button onClick={() => void load(a.id)}>
                    Ver actividad #{a.id}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </section>
      ) : (
        <Empty>Aún no hay actividades registradas en este local.</Empty>
      )}
      {nuevo && perfil.data && (
        <Modal title="Nueva actividad" onClose={() => setNuevo(false)}>
          <Form
            label="Registrar actividad"
            onSave={(d) =>
              api("/experiencia/actividades" + query, "POST", {
                idempotencia: creationKey.current,
                flujoCodigo: d.get("flujo"),
                titulo: d.get("titulo"),
                detalle: d.get("detalle"),
                ejecutorId: Number(d.get("ejecutor")),
                servicioId: d.get("servicio")
                  ? Number(d.get("servicio"))
                  : null,
              })
            }
            onDone={() => {
              setNuevo(false);
              void rows.refresh();
            }}
          >
            <Field label="Flujo de trabajo">
              <select name="flujo" required>
                {perfil.data.plantilla.definicion.flujos.map((f) => (
                  <option value={f.codigo} key={f.codigo}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título de la actividad">
              <input name="titulo" maxLength={200} required />
            </Field>
            <Field label="Responsable de la actividad">
              <select
                name="ejecutor"
                required
                defaultValue={session.rol === "SUPERADMIN" ? "" : session.id}
              >
                <option value="">Selecciona responsable</option>
                {users.data.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Field>
            {servicios.data.length > 0 && (
              <Field label="Servicio relacionado (opcional)">
                <select name="servicio">
                  <option value="">Sin servicio relacionado</option>
                  {servicios.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Detalle de la actividad">
              <textarea name="detalle" maxLength={500} />
            </Field>
          </Form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={`Actividad #${selected.id}`}
          onClose={() => setSelected(null)}
        >
          <ErrorNotice message={error} />
          <h3>{selected.titulo}</h3>
          <p>
            Responsable: {selected.ejecutor_nombre}. Flujo:{" "}
            {selected.flujo_definicion.nombre}.
          </p>
          <p>{selected.detalle}</p>
          <p>
            Creada: {date(selected.creada)}
            {selected.iniciada ? ` · Inicio: ${date(selected.iniciada)}` : ""}
            {selected.completada
              ? ` · Final: ${date(selected.completada)}`
              : ""}
          </p>
          <button disabled={busy} onClick={() => void load(selected.id)}>
            Recargar actividad
          </button>
          {!selected.finalizada && !selected.cancelada && (
            <div className="form-actions">
              {next && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void update(next.codigo).catch(() => {})}
                >
                  {next.nombre}
                </button>
              )}
              <button disabled={busy} onClick={() => setCancel(true)}>
                Cancelar actividad
              </button>
            </div>
          )}
          {admin && !selected.finalizada && !selected.cancelada && (
            <Form
              label="Reasignar responsable"
              onSave={(d) =>
                api<Actividad>(
                  `/experiencia/actividades/${selected.id}/responsable${query}`,
                  "POST",
                  {
                    version: selected.version,
                    ejecutorId: Number(d.get("responsable")),
                  },
                )
              }
              onDone={() => {
                void load(selected.id);
                void rows.refresh();
              }}
            >
              <Field label="Nuevo responsable">
                <select
                  name="responsable"
                  required
                  defaultValue={selected.ejecutor_original_id}
                >
                  {users.data.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </Form>
          )}
          <h3>Historial de etapas</h3>
          <Table
            headers={["Etapa", "Persona que registró", "Fecha", "Detalle"]}
          >
            {selected.eventos?.map((e) => (
              <tr key={e.version}>
                <td>
                  {{
                    CREADA: "Creada",
                    REASIGNADA: "Responsable cambiado",
                    ETAPA_CAMBIADA: "Etapa cambiada",
                    COMPLETADA: "Completada",
                    CANCELADA: "Cancelada",
                  }[e.tipo] || "Actualizada"}
                  :{" "}
                  {e.estado === "CANCELADA"
                    ? "Cancelada"
                    : selected.flujo_definicion.etapas.find(
                        (s) => s.codigo === e.estado,
                      )?.nombre || e.estado}
                </td>
                <td>{e.actor_nombre}</td>
                <td>{date(e.ocurrido_en)}</td>
                <td>{e.detalle}</td>
              </tr>
            ))}
          </Table>
        </Modal>
      )}
      {cancel && selected && (
        <Modal title="Cancelar actividad" onClose={() => setCancel(false)}>
          <Form
            label="Confirmar cancelación de actividad"
            onSave={async (d) => {
              await update("CANCELADA", String(d.get("motivo")));
              setCancel(false);
            }}
          >
            <Field label="Motivo de cancelación">
              <textarea name="motivo" required maxLength={500} />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
