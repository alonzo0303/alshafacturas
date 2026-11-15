import { useRef, useState } from "react";
import { occupationHelp, roleTemplates } from "../lib/roleHelp";
import { api } from "../lib/api";
import { useData } from "../lib/useData";
import { permissionLabels } from "../lib/session";
import { Field, Form, ErrorNotice, PageTitle, Table } from "../components/ui";
export type Role = {
  codigo: string;
  nombre: string;
  permisos: string[];
  personalizado: boolean;
};
export type RolesData = { roles: Role[]; permisosDisponibles: string[] };
export default function Roles() {
  const { data, error, loading, refresh } = useData(
      () => api<RolesData>("/roles"),
      { roles: [], permisosDisponibles: [] },
    ),
    [editing, setEditing] = useState<Role | null>(null);
  const [template, setTemplate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageTitle
        title="Roles y permisos"
        description="Crea funciones para tu equipo y define qué puede consultar o modificar cada una."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <h2>
          {editing ? "Editar rol personalizado" : "Nuevo rol personalizado"}
        </h2>
        <Form
          key={editing?.codigo ?? "new"}
          onSave={(d) =>
            api("/roles", "POST", {
              codigo:
                editing?.codigo ||
                "R_" +
                  crypto
                    .randomUUID()
                    .replaceAll("-", "")
                    .slice(0, 20)
                    .toUpperCase(),
              nombre: d.get("nombre"),
              permisos: d.getAll("permisos"),
            })
          }
          label="Guardar rol"
          onDone={() => {
            setEditing(null);
            setSelected([]);
            setTemplate("");
            void refresh();
          }}
        >
          {!editing && (
            <Field label="Usar plantilla de puesto (opcional)">
              <select
                value={template}
                onChange={(e) => {
                  const value = e.target.value;
                  setTemplate(value);
                  const t = roleTemplates.find((t) => t.nombre === value);
                  if (nameRef.current) nameRef.current.value = t?.nombre ?? "";
                  setSelected(t?.permisos ?? []);
                }}
              >
                <option value="">Personalizado: elegir permisos</option>
                {roleTemplates.map((t) => (
                  <option key={t.nombre}>{t.nombre}</option>
                ))}
              </select>
            </Field>
          )}
          <p className="hint">
            La plantilla es una sugerencia. Revisa los permisos antes de
            guardar. El personal ve operaciones propias o asignadas; el
            administrador ve el consolidado. El catálogo y las existencias del
            local se comparten para trabajar.
          </p>
          <Field label="Nombre del rol">
            <input
              name="nombre"
              maxLength={100}
              required
              ref={nameRef}
              defaultValue={editing?.nombre ?? ""}
              placeholder="Por ejemplo: supervisor de tienda"
            />
          </Field>
          <div className="permission-list">
            {data.permisosDisponibles.map((p) => (
              <label key={p}>
                <input
                  aria-label={permissionLabels[p] || p}
                  aria-describedby={occupationHelp[p] ? `help-${p}` : undefined}
                  name="permisos"
                  type="checkbox"
                  value={p}
                  checked={selected.includes(p)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, p]
                        : old.filter((v) => v !== p),
                    )
                  }
                />
                {permissionLabels[p] || p}{" "}
                {occupationHelp[p] && (
                  <span id={`help-${p}`} className="hint">
                    ({occupationHelp[p]})
                  </span>
                )}
              </label>
            ))}
          </div>
          <p className="hint">
            Los permisos de consulta necesarios se añaden automáticamente. La
            gestión de usuarios y planes queda reservada al administrador.
          </p>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setSelected([]);
                setTemplate("");
              }}
            >
              Cancelar edición
            </button>
          )}
        </Form>
      </section>
      <section className="surface">
        <h2>Roles disponibles</h2>
        {loading ? (
          <p role="status">Cargando roles…</p>
        ) : (
          <Table headers={["Rol", "Permisos", "Tipo", "Acciones"]}>
            {data.roles.map((role) => (
              <tr key={role.codigo}>
                <td>{role.nombre}</td>
                <td>
                  {role.permisos
                    .map((p) => permissionLabels[p] || p)
                    .join(", ")}
                </td>
                <td>
                  {role.personalizado ? "Personalizado" : "Predeterminado"}
                </td>
                <td>
                  {role.personalizado && (
                    <button
                      onClick={() => {
                        setEditing(role);
                        setSelected(role.permisos);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Editar<span className="sr-only"> {role.nombre}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </>
  );
}
