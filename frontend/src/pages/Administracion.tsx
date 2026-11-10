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
} from "../components/ui";
import { useState } from "react";
type Usuario = Session & { activo: boolean };
export function Empresas() {
  const { data, error, loading, refresh } = useData(
    () => api<Empresa[]>("/empresas"),
    [],
  );
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
      <section className="surface">
        <h2>Nueva empresa y administrador</h2>
        <Form
          onSave={(d) => api("/empresas/alta", "POST", Object.fromEntries(d))}
          label="Crear empresa"
          onDone={() => void refresh()}
        >
          <div className="form-grid">
            <Field label="RUC">
              <input
                name="ruc"
                inputMode="numeric"
                pattern="[0-9]{11}"
                maxLength={11}
                required
              />
            </Field>
            <Field label="Razón social">
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
          <Table headers={["Empresa", "RUC", "Estado", "Acciones"]}>
            {data.map((e) => (
              <tr key={e.id}>
                <td>{e.razonSocial}</td>
                <td className="mono">{e.ruc}</td>
                <td>
                  <Badge neutral={e.estado === "ACTIVA"}>{e.estado}</Badge>
                </td>
                <td>
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
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No hay empresas registradas.</Empty>
        )}
      </section>
    </>
  );
}
export function Usuarios({ session }: { session: Session }) {
  const { data, error, loading, refresh } = useData(
    () => api<Usuario[]>("/usuarios"),
    [],
  );
  const [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  async function estado(u: Usuario) {
    setBusy(true);
    setActionError("");
    try {
      await api(`/usuarios/${u.id}/activo`, "PATCH", { activo: !u.activo });
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Usuarios"
        description="Administradores y vendedores de tu empresa."
      />
      <ErrorNotice message={error || actionError} />
      <section className="surface">
        <h2>Nuevo usuario</h2>
        <Form
          onSave={(d) => api("/usuarios", "POST", Object.fromEntries(d))}
          label="Crear usuario"
          onDone={() => void refresh()}
        >
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
                <option value="VENDEDOR">Vendedor · Ventas y clientes</option>
                <option value="ADMIN">Administrador · Gestión completa</option>
              </select>
            </Field>
          </div>
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
                <td>{u.rol}</td>
                <td>{u.activo ? "Activo" : "Inactivo"}</td>
                <td>
                  {u.id === session.id ? (
                    "Tu cuenta"
                  ) : (
                    <button disabled={busy} onClick={() => void estado(u)}>
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
