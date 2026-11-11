import { useState } from "react";
import { api, money, type Session } from "../lib/api";
import { useData } from "../lib/useData";
import { can } from "../lib/session";
import {
  Field,
  Form,
  Modal,
  PageTitle,
  ErrorNotice,
  Table,
  Empty,
} from "../components/ui";

type Servicio = {
  id: number;
  nombre: string;
  precio: number;
  duracion_minutos: number;
  activo: boolean;
  afectacion_igv: string;
};
export default function Servicios({ session }: { session: Session }) {
  const { data, loading, error, refresh } = useData(
    () => api<Servicio[]>("/servicios"),
    [],
  );
  const [editing, setEditing] = useState<Servicio | null | undefined>(
      undefined,
    ),
    [search, setSearch] = useState("");
  const editar = can(session, "SERVICIOS_EDITAR");
  return (
    <>
      <PageTitle
        title="Servicios"
        description={`Catálogo de servicios de ${session.localNombre || "este local"}. No utiliza existencias de almacén.`}
      >
        {editar && (
          <button className="primary" onClick={() => setEditing(null)}>
            Nuevo servicio
          </button>
        )}
      </PageTitle>
      <ErrorNotice message={error} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Servicios registrados</h2>
          <button onClick={() => void refresh()}>Actualizar servicios</button>
        </div>
        <Field label="Buscar servicio">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        {loading ? (
          <p role="status">Cargando servicios…</p>
        ) : data.length ? (
          <Table
            headers={["Servicio", "Precio", "Duración", "Estado", "Acciones"]}
          >
            {data
              .filter((s) =>
                s.nombre.toLowerCase().includes(search.toLowerCase()),
              )
              .map((s) => (
                <tr key={s.id}>
                  <td>{s.nombre}</td>
                  <td>{money(s.precio)}</td>
                  <td>
                    {s.duracion_minutos
                      ? `${s.duracion_minutos} min`
                      : "Sin duración"}
                  </td>
                  <td>{s.activo ? "Activo" : "Inactivo"}</td>
                  <td>
                    {editar && (
                      <button onClick={() => setEditing(s)}>
                        Editar<span className="sr-only"> {s.nombre}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </Table>
        ) : (
          <Empty>Agrega el primer servicio de este local.</Empty>
        )}
      </section>
      {editing !== undefined && (
        <Modal
          title={editing ? "Editar servicio" : "Nuevo servicio"}
          onClose={() => setEditing(undefined)}
        >
          <Form
            label="Guardar servicio"
            onSave={(d) =>
              api(
                editing ? `/servicios/${editing.id}` : "/servicios",
                editing ? "PUT" : "POST",
                {
                  nombre: d.get("nombre"),
                  precio: Number(d.get("precio")),
                  duracionMinutos: Number(d.get("duracionMinutos")),
                  activo: d.get("activo") === "on",
                  afectacionIgv: d.get("afectacionIgv"),
                },
              )
            }
            onDone={() => {
              setEditing(undefined);
              void refresh();
            }}
          >
            <Field label="Nombre del servicio">
              <input
                name="nombre"
                required
                maxLength={200}
                defaultValue={editing?.nombre}
              />
            </Field>
            <div className="form-grid">
              <Field label="Precio del servicio (S/)">
                <input
                  name="precio"
                  type="number"
                  min="0.01"
                  max="999999999.99"
                  step="0.01"
                  required
                  defaultValue={editing?.precio}
                />
              </Field>
              <Field label="Duración en minutos">
                <input
                  name="duracionMinutos"
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  defaultValue={editing?.duracion_minutos || 0}
                />
              </Field>
              <Field label="Tratamiento tributario del servicio">
                <select
                  name="afectacionIgv"
                  defaultValue={
                    editing?.afectacion_igv === "SIN_IGV"
                      ? "GRAVADO"
                      : editing?.afectacion_igv || "GRAVADO"
                  }
                >
                  <option value="GRAVADO">Gravado · IGV incluido</option>
                  <option value="EXONERADO">Exonerado</option>
                  <option value="INAFECTO">Inafecto</option>
                </select>
              </Field>
            </div>
            <p className="hint">
              El precio ingresado es el final. Si el negocio no tiene RUC, se
              guarda como gestión interna sin IGV.
            </p>
            <label>
              <input
                name="activo"
                type="checkbox"
                defaultChecked={editing?.activo ?? true}
              />{" "}
              Disponible para cobrar
            </label>
          </Form>
        </Modal>
      )}
    </>
  );
}
