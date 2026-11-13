import { useState } from "react";
import { api, date, type Empresa } from "../lib/api";
import { useData } from "../lib/useData";
import {
  Field,
  Form,
  Modal,
  PageTitle,
  ErrorNotice,
  Table,
  Badge,
} from "../components/ui";
import ConfirmarAccion from "../components/ConfirmarAccion";
import EditarCredenciales from "../components/EditarCredenciales";
type Cuenta = {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  activo: boolean;
  principal: boolean;
  desactivado_en: string | null;
  gracia_hasta: string | null;
};
function Equipo({ empresaId }: { empresaId: number }) {
  const users = useData(
      () => api<Cuenta[]>(`/admin/personal?empresaId=${empresaId}`),
      [],
    ),
    roles = useData(
      () =>
        api<{ roles: { codigo: string; nombre: string }[] }>(
          `/admin/personal/roles?empresaId=${empresaId}`,
        ),
      { roles: [] },
    );
  const [action, setAction] = useState<{
      u: Cuenta;
      kind: "estado" | "eliminar";
    } | null>(null),
    [credential, setCredential] = useState<Cuenta | null>(null),
    [role, setRole] = useState<Cuenta | null>(null);
  const [search, setSearch] = useState("");
  return (
    <>
      <ErrorNotice message={users.error || roles.error} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Cuentas y ciclo de vida</h2>
          <button onClick={() => void users.refresh()}>
            Actualizar personal
          </button>
        </div>
        <Field label="Buscar cuenta de personal">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <p className="hint">
          Las nuevas desactivaciones reservan cupo durante 15 días. Después se
          libera la reserva; la cuenta se conserva hasta que confirmes su
          eliminación.
        </p>
        {users.loading ? (
          <p role="status">Cargando personal…</p>
        ) : (
          <Table headers={["Personal", "Rol", "Estado y gracia", "Acciones"]}>
            {users.data
              .filter((u) =>
                `${u.nombre} ${u.correo}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nombre}</strong>
                    <small>{u.correo}</small>
                    {u.principal && (
                      <Badge neutral>Administrador principal</Badge>
                    )}
                  </td>
                  <td>{u.rol}</td>
                  <td>
                    <Badge neutral={u.activo}>
                      {u.activo ? "Activo" : "Desactivado"}
                    </Badge>
                    {!u.activo && u.gracia_hasta && (
                      <small>Reserva hasta {date(u.gracia_hasta)}</small>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => setCredential(u)}>
                        Editar acceso
                        <span className="sr-only"> de {u.nombre}</span>
                      </button>
                      <button
                        disabled={u.principal || roles.loading || !!roles.error}
                        onClick={() => setRole(u)}
                      >
                        Cambiar rol
                        <span className="sr-only"> de {u.nombre}</span>
                      </button>
                      <button onClick={() => setAction({ u, kind: "estado" })}>
                        {u.activo ? "Desactivar" : "Reactivar"}
                        <span className="sr-only"> {u.nombre}</span>
                      </button>
                      {!u.activo && !u.principal && (
                        <button
                          className="danger-button"
                          onClick={() => setAction({ u, kind: "eliminar" })}
                        >
                          Eliminar<span className="sr-only"> {u.nombre}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </Table>
        )}
      </section>
      <section className="surface">
        <h2>Transferir administración principal</h2>
        <p>
          Antes de eliminar o cambiar el rol del administrador principal,
          designa otro administrador activo.
        </p>
        <Form
          label="Transferir administración"
          onSave={(d) =>
            api(`/admin/personal/propietario?empresaId=${empresaId}`, "PATCH", {
              usuarioId: Number(d.get("usuarioId")),
            })
          }
          onDone={() => void users.refresh()}
        >
          <Field label="Nuevo administrador principal">
            <select name="usuarioId" required>
              <option value="">Selecciona un administrador activo</option>
              {users.data
                .filter((u) => u.activo && u.rol === "ADMIN" && !u.principal)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} · {u.correo}
                  </option>
                ))}
            </select>
          </Field>
        </Form>
      </section>
      {action && (
        <ConfirmarAccion
          titulo={
            action.kind === "eliminar"
              ? "Eliminar cuenta permanentemente"
              : "¿Está seguro de realizar esta acción?"
          }
          peligro={action.kind === "eliminar"}
          descripcion={
            action.kind === "eliminar"
              ? `Se eliminará el acceso de ${action.u.nombre} y se liberará su cupo. Sus operaciones y autoría histórica se conservan.`
              : action.u.activo
                ? `Se desactivará ${action.u.nombre}. No podrá ingresar y su cupo quedará reservado durante 15 días.`
                : `Se reactivará ${action.u.nombre} si el plan y los cupos lo permiten.`
          }
          onClose={() => setAction(null)}
          onConfirm={async () => {
            await api(
              `/admin/personal/${action.u.id}${action.kind === "estado" ? "/estado" : ""}?empresaId=${empresaId}`,
              action.kind === "estado" ? "PATCH" : "DELETE",
              action.kind === "estado"
                ? { activo: !action.u.activo, confirmado: true }
                : { confirmado: true },
            );
            await users.refresh();
          }}
        />
      )}
      {credential && (
        <EditarCredenciales
          usuario={credential}
          empresaId={empresaId}
          onClose={() => setCredential(null)}
          onDone={() => {
            setCredential(null);
            void users.refresh();
          }}
        />
      )}
      {role && (
        <Modal title={`Rol de ${role.nombre}`} onClose={() => setRole(null)}>
          <Form
            label="Guardar rol del usuario"
            onSave={(d) =>
              api(
                `/admin/personal/${role.id}/rol?empresaId=${empresaId}`,
                "PATCH",
                { rol: d.get("rol") },
              )
            }
            onDone={() => {
              setRole(null);
              void users.refresh();
            }}
          >
            <Field label="Rol del personal">
              <select name="rol" defaultValue={role.rol}>
                {roles.data.roles.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
export default function PersonalAdmin() {
  const empresas = useData(() => api<Empresa[]>("/empresas"), []);
  const [id, setId] = useState("");
  return (
    <>
      <PageTitle
        title="Personal y accesos"
        description="Reactivación, roles, contraseñas y eliminación manual de cuentas de negocios."
      />
      <ErrorNotice message={empresas.error} />
      <section className="surface">
        <Field label="Empresa del personal">
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Selecciona una empresa</option>
            {empresas.data
              .filter((e) => e.ruc !== "00000000000")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} · {e.razonSocial}
                </option>
              ))}
          </select>
        </Field>
      </section>
      {id && <Equipo key={id} empresaId={Number(id)} />}
    </>
  );
}
