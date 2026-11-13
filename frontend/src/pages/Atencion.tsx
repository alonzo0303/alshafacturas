import { Link } from "react-router-dom";
import { type Session } from "../lib/api";
import { api } from "../lib/api";
import { useData } from "../lib/useData";
import { PageTitle, ErrorNotice } from "../components/ui";

export default function Atencion({ session }: { session: Session }) {
  const tipos = useData(
    () => api<{ codigo: string; nombre: string }[]>("/tipos-atencion"),
    [],
  );
  const tipo =
    tipos.data.find((t) => t.codigo === session.tipoAtencion)?.nombre ||
    "Atención";
  return (
    <>
      <PageTitle
        title={tipo}
        description="Atención y servicios · Tu espacio de trabajo en AlshaFacturas."
      />
      <ErrorNotice message={tipos.error} />
      <section className="surface">
        <h2>Tu acceso</h2>
        <dl className="atencion-access">
          <div>
            <dt>Usuario</dt>
            <dd>{session.nombre}</dd>
          </div>
          <div>
            <dt>Negocio</dt>
            <dd>Empresa #{session.empresaId}</dd>
          </div>
          <div>
            <dt>Rol asignado</dt>
            <dd>{session.rol}</dd>
          </div>
          <div>
            <dt>Tipo de atención</dt>
            <dd>{tipo}</dd>
          </div>
        </dl>
        <p>
          Gestiona los servicios, cobros y ventas de este local desde el menú.
          Las citas, mesas y comandas se desarrollarán en sus módulos
          específicos.
        </p>
      </section>
      {session.rol === "ADMIN" ? (
        <section className="surface">
          <h2>Administración del equipo</h2>
          <p>
            Gestiona las cuentas del personal, sus roles y los cupos disponibles
            del negocio.
          </p>
          <div className="row-actions">
            <Link className="button" to="/atencion/usuarios">
              Personal
            </Link>
            <Link className="button" to="/atencion/roles">
              Roles y permisos
            </Link>
            <Link className="button" to="/atencion/plan">
              Mi plan
            </Link>
          </div>
        </section>
      ) : (
        <section className="surface">
          <h2>Personal y permisos</h2>
          <p>
            Tu administrador gestiona tu rol y los permisos del negocio. El
            superadministrador asigna la visualización de cada usuario.
          </p>
        </section>
      )}
    </>
  );
}
