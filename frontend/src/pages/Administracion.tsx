import ConfirmarAccion from "../components/ConfirmarAccion";
import RubroNegocio from "../components/RubroNegocio";
import RubrosAcceso from "./RubrosAcceso";
import { PlanInfo, type PlanState } from "./Planes";
import { useData } from "../lib/useData";
import { api, type Empresa, type Session } from "../lib/api";
import {
  Field,
  Form,
  ErrorNotice,
  Empty,
  PageTitle,
  Table,
  Badge,
  Modal,
} from "../components/ui";
import { useState } from "react";
type Usuario = Session & { activo: boolean };
export function Empresas() {
  const { data, error, loading, refresh } = useData(
    () => api<Empresa[]>("/empresas"),
    [],
  );
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState<number | null>(null);
  async function estado(e: Empresa) {
    if (
      !window.confirm(
        `¿Deseas ${e.estado === "ACTIVA" ? "suspender" : "activar"} a ${e.razonSocial}?`,
      )
    )
      return;
    setBusy(e.id);
    setActionError("");
    try {
      await api(`/empresas/${e.id}/estado`, "PATCH", {
        estado: e.estado === "ACTIVA" ? "SUSPENDIDA" : "ACTIVA",
      });
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageTitle
        title="Empresas"
        description="Alta y control de acceso de las empresas de la plataforma."
      />
      <ErrorNotice message={error || actionError} />
      <p role="status">{message}</p>
      <RubrosAcceso />
      <section className="surface">
        <h2>Nueva empresa y administrador</h2>
        <p>
          El RUC es opcional para inventario, compras y ventas internas. Se
          requiere para facturación electrónica.
        </p>
        <Form
          onSave={(d) => api("/empresas/alta", "POST", Object.fromEntries(d))}
          label="Crear empresa"
          onDone={() => void refresh()}
        >
          <div className="form-grid">
            <RubroNegocio />
            <Field label="RUC (opcional)">
              <input
                name="ruc"
                inputMode="numeric"
                pattern="[0-9]{11}"
                maxLength={11}
              />
            </Field>
            <Field label="Nombre del negocio o razón social">
              <input name="razonSocial" maxLength={200} required />
            </Field>
            <Field label="Dirección">
              <input name="direccion" maxLength={255} />
            </Field>
            <Field label="Nombre del administrador">
              <input name="administradorNombre" maxLength={150} required />
            </Field>
            <Field label="Correo del administrador">
              <input
                name="administradorCorreo"
                type="email"
                maxLength={150}
                required
              />
            </Field>
            <Field label="Contraseña inicial (8 a 72 caracteres)">
              <input
                name="administradorPassword"
                type="password"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </Field>
          </div>
        </Form>
      </section>
      <section className="surface">
        <div className="section-toolbar">
          <h2>Empresas registradas</h2>
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando empresas…</p>
        ) : data.length ? (
          <Table
            headers={[
              "Código",
              "Empresa",
              "Rubro",
              "RUC",
              "Estado",
              "Acciones",
            ]}
          >
            {data.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.id}</td>
                <td>{e.razonSocial}</td>
                <td>{e.rubroNegocio || "Sin rubro principal"}</td>
                <td className="mono">{e.ruc || "Sin RUC · Gestión interna"}</td>
                <td>
                  <Badge neutral={e.estado === "ACTIVA"}>{e.estado}</Badge>
                </td>
                <td>
                  <div className="row-actions">
                    {e.ruc !== "00000000000" && (
                      <button
                        disabled={busy !== null}
                        onClick={() => {
                          setMessage("");
                          setEditing(e);
                        }}
                      >
                        Editar<span className="sr-only"> {e.razonSocial}</span>
                      </button>
                    )}
                    {e.ruc !== "00000000000" && (
                      <button
                        disabled={busy !== null}
                        onClick={() => void estado(e)}
                      >
                        {busy === e.id
                          ? "Guardando…"
                          : e.estado === "ACTIVA"
                            ? "Suspender"
                            : "Activar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No hay empresas registradas.</Empty>
        )}
      </section>
      {editing && (
        <Modal
          title={`Editar negocio #${editing.id}`}
          onClose={() => setEditing(null)}
        >
          <p className="notice">
            Se conserva el código #{editing.id}, los productos, usuarios,
            existencias y operaciones del negocio.
          </p>
          <Form
            label="Guardar cambios del negocio"
            onSave={(d) =>
              api(`/empresas/${editing.id}`, "PUT", {
                razonSocial: d.get("razonSocial"),
                direccion: d.get("direccion"),
                ruc: d.get("ruc") || null,
                rubroNegocio: d.get("rubroNegocio"),
              })
            }
            onDone={() => {
              setEditing(null);
              setMessage(
                "Datos del negocio actualizados. Se conservó el mismo código.",
              );
              void refresh();
            }}
          >
            <RubroNegocio initial={editing.rubroNegocio} />
            <Field label="Nombre del negocio o razón social">
              <input
                name="razonSocial"
                required
                maxLength={200}
                defaultValue={editing.razonSocial}
              />
            </Field>
            <Field label="Dirección">
              <input
                name="direccion"
                maxLength={255}
                defaultValue={editing.direccion || ""}
              />
            </Field>
            <Field
              label={editing.ruc ? "RUC actual" : "Agregar RUC (opcional)"}
            >
              <input
                name="ruc"
                readOnly={!!editing.ruc}
                defaultValue={editing.ruc || ""}
                inputMode="numeric"
                pattern="[0-9]{11}"
                maxLength={11}
              />
            </Field>
            <p className="hint">
              Puedes agregar el RUC si el negocio no tiene uno. Los documentos
              anteriores conservan sus importes y tratamiento tributario.
              Registrar RUC no activa SUNAT automáticamente.
            </p>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function Usuarios({ session }: { session: Session }) {
  const { data, error, loading, refresh } = useData(
    () => api<Usuario[]>("/usuarios"),
    [],
  );
  const [pending, setPending] = useState<Usuario | null>(null);
  const plan = useData(() => api<PlanState>("/plan"), null);
  const roles = useData(
    () => api<{ roles: { codigo: string; nombre: string }[] }>("/roles"),
    { roles: [] },
  );
  const cupo =
    !!plan.data?.vigente &&
    (plan.data.limiteEmpleados < 0 ||
      (plan.data.cuposOcupados ?? plan.data.empleadosActivos) <
        plan.data.limiteEmpleados);
  async function reload() {
    await Promise.all([refresh(), plan.refresh()]);
  }
  async function cambiarRol(u: Usuario, rol: string) {
    setBusy(true);
    setActionError("");
    try {
      await api(`/usuarios/${u.id}/rol`, "PATCH", { rol });
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  async function estado(u: Usuario) {
    setBusy(true);
    setActionError("");
    try {
      await api(`/usuarios/${u.id}/activo`, "PATCH", { activo: !u.activo });
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {pending && (
        <ConfirmarAccion
          titulo="¿Está seguro de realizar esta acción?"
          descripcion={
            pending.activo
              ? `Se desactivará ${pending.nombre}; su cupo se reserva durante 15 días.`
              : `Se reactivará ${pending.nombre} si el plan lo permite.`
          }
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await estado(pending);
          }}
        />
      )}
      <PageTitle
        title="Usuarios"
        description="Gestiona las cuentas, sus funciones y los cupos de tu plan."
      />
      <ErrorNotice
        message={error || plan.error || roles.error || actionError}
      />
      {plan.data && (
        <section className="surface">
          <PlanInfo plan={plan.data} />
        </section>
      )}
      <section className="surface">
        <h2>Nuevo usuario</h2>
        {!cupo && (
          <p className="notice">
            No hay cupos disponibles. Revisa Mi plan y los cupos reservados por
            desactivaciones.
          </p>
        )}
        <Form
          onSave={(d) => {
            if (!cupo)
              throw new Error("No hay cupos disponibles en el plan vigente.");
            return api("/usuarios", "POST", Object.fromEntries(d));
          }}
          label="Crear usuario"
          onDone={() => void reload()}
        >
          <fieldset disabled={!cupo || busy}>
            <legend className="sr-only">Datos del nuevo usuario</legend>
            <div className="form-grid">
              <Field label="Nombre completo">
                <input name="nombre" required maxLength={150} />
              </Field>
              <Field label="Correo">
                <input name="correo" type="email" required maxLength={150} />
              </Field>
              <Field label="Contraseña inicial (8 a 72 caracteres)">
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Field label="Rol">
                <select name="rol">
                  {roles.data.roles.map((r) => (
                    <option key={r.codigo} value={r.codigo}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>
        </Form>
      </section>
      <section className="surface">
        <div className="section-toolbar">
          <h2>Equipo</h2>
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando usuarios…</p>
        ) : (
          <Table headers={["Nombre", "Correo", "Rol", "Estado", "Acciones"]}>
            {data.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.correo}</td>
                <td>
                  {u.id === session.id || u.id === plan.data?.propietarioId ? (
                    roles.data.roles.find((r) => r.codigo === u.rol)?.nombre ||
                    u.rol
                  ) : (
                    <select
                      aria-label={`Rol de ${u.nombre}`}
                      value={u.rol}
                      disabled={busy}
                      onChange={(e) => void cambiarRol(u, e.target.value)}
                    >
                      {roles.data.roles.map((r) => (
                        <option key={r.codigo} value={r.codigo}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>{u.activo ? "Activo" : "Inactivo"}</td>
                <td>
                  {u.id === session.id || u.id === plan.data?.propietarioId ? (
                    "Tu cuenta"
                  ) : (
                    <button disabled={busy} onClick={() => setPending(u)}>
                      {u.activo ? "Desactivar" : "Reactivar"}
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
