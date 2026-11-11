import { useState } from "react";
import { api, type Empresa } from "../lib/api";
import { useData } from "../lib/useData";
import {
  Field,
  Form,
  ErrorNotice,
  PageTitle,
  Modal,
  Table,
} from "../components/ui";
type Local = { id: number; nombre: string; direccion: string };
type Usuario = {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  locales: string;
};
function DatosLocal({ local }: { local?: Local }) {
  return (
    <>
      <Field label="Nombre del local">
        <input
          name="nombre"
          required
          maxLength={100}
          defaultValue={local?.nombre}
        />
      </Field>
      <Field label="Dirección del local">
        <input
          name="direccion"
          maxLength={255}
          defaultValue={local?.direccion}
        />
      </Field>
    </>
  );
}
export function LocalesNegocio({ empresaId }: { empresaId?: number }) {
  const query = empresaId ? `?empresaId=${empresaId}` : "";
  const locales = useData(() => api<Local[]>(`/locales${query}`), []),
    usuarios = useData(() => api<Usuario[]>(`/locales/usuarios${query}`), []);
  const [edit, setEdit] = useState<Local | null>(null);
  async function refresh() {
    await Promise.all([locales.refresh(), usuarios.refresh()]);
    window.dispatchEvent(new Event("locales-updated"));
  }
  return (
    <>
      <PageTitle
        title="Locales del negocio"
        description="Una empresa y RUC compartidos. Inventario, compras, ventas y servicios separados por local."
      />
      <ErrorNotice message={locales.error || usuarios.error} />
      <section className="surface">
        <h2>Nuevo local</h2>
        <Form
          label="Crear local"
          onSave={(d) => api(`/locales${query}`, "POST", Object.fromEntries(d))}
          onDone={() => void refresh()}
        >
          <DatosLocal />
        </Form>
      </section>
      <section className="surface">
        <div className="section-toolbar">
          <h2>Locales registrados</h2>
          <button onClick={() => void refresh()}>Actualizar locales</button>
        </div>
        {locales.loading ? (
          <p role="status">Cargando locales…</p>
        ) : (
          <Table headers={["Local", "Dirección", "Acciones"]}>
            {locales.data.map((l) => (
              <tr key={l.id}>
                <td>{l.nombre}</td>
                <td>{l.direccion}</td>
                <td>
                  <button onClick={() => setEdit(l)}>
                    Editar<span className="sr-only"> {l.nombre}</span>
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section className="surface">
        <h2>Acceso del personal por local</h2>
        <p>
          Los administradores acceden a todos los locales. El personal nuevo
          empieza en el Local principal; puedes asignarle uno o varios locales.
        </p>
        {usuarios.loading ? (
          <p role="status">Cargando personal…</p>
        ) : (
          usuarios.data.map((u) => (
            <div className="surface" key={`${u.id}-${u.locales}`}>
              <h3>{u.nombre}</h3>
              <p>
                {u.correo} · {u.rol}
              </p>
              {u.rol === "ADMIN" ? (
                <p>Todos los locales</p>
              ) : (
                <Form
                  label={`Guardar locales de ${u.nombre}`}
                  onSave={(d) =>
                    api(`/locales/usuarios/${u.id}${query}`, "PUT", {
                      locales: d.getAll("locales").map(Number),
                    })
                  }
                  onDone={() => void usuarios.refresh()}
                >
                  <div className="permission-list">
                    {locales.data.map((l, i) => (
                      <label key={l.id}>
                        <input
                          name="locales"
                          value={l.id}
                          type="checkbox"
                          defaultChecked={
                            JSON.parse(u.locales).length
                              ? JSON.parse(u.locales).includes(l.id)
                              : i === 0
                          }
                        />
                        {l.nombre}
                      </label>
                    ))}
                  </div>
                </Form>
              )}
            </div>
          ))
        )}
      </section>
      {edit && (
        <Modal title="Editar local" onClose={() => setEdit(null)}>
          <Form
            label="Guardar local"
            onSave={(d) =>
              api(`/locales/${edit.id}${query}`, "PUT", Object.fromEntries(d))
            }
            onDone={() => {
              setEdit(null);
              void refresh();
            }}
          >
            <DatosLocal local={edit} />
          </Form>
        </Modal>
      )}
    </>
  );
}
export default function LocalesAdmin() {
  const { data, error } = useData(() => api<Empresa[]>("/empresas"), []);
  const [id, setId] = useState("");
  return (
    <>
      <PageTitle
        title="Sucursales"
        description="Configura los locales de cada empresa y el acceso de su personal."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <Field label="Empresa de las sucursales">
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Selecciona una empresa</option>
            {data
              .filter((e) => e.ruc !== "00000000000")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} · {e.razonSocial}
                </option>
              ))}
          </select>
        </Field>
      </section>
      {id && <LocalesNegocio key={id} empresaId={Number(id)} />}
    </>
  );
}
