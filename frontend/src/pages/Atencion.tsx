import { Link } from "react-router-dom";
import { type Session } from "../lib/api";
import { tiposAtencion } from "../lib/modalidades";
import { PageTitle } from "../components/ui";

export default function Atencion({ session }: { session: Session }) {
  const tipo = session.tipoAtencion
    ? tiposAtencion[session.tipoAtencion]
    : "Atención";
  return (
    <>
      <PageTitle
        title={tipo}
        description="Atención y servicios · Tu espacio de trabajo en AlshaFacturas."
      />
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
          Este espacio está separado de Comercio. Las funciones de{" "}
          {tipo.toLocaleLowerCase("es")} se están desarrollando aquí; este
          apartado todavía no registra operaciones de atención.
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
