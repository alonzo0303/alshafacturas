import { useState } from "react";
import { api, type Empresa, type Session } from "../lib/api";
import SeleccionUsuario from "../components/SeleccionVisualizacion";
import { useData } from "../lib/useData";
import { Empty, ErrorNotice, Field, PageTitle } from "../components/ui";

type Usuario = Session & { activo: boolean };

function UsuariosEmpresa({ empresaId }: { empresaId: number }) {
  const { data, loading, error, refresh } = useData(
    () => api<Usuario[]>(`/admin/visualizaciones?empresaId=${empresaId}`),
    [],
  );
  const [busqueda, setBusqueda] = useState("");
  const [guardados, setGuardados] = useState<Record<number, Usuario>>({});
  const [revision, setRevision] = useState(0);
  const usuarios = data.filter((u) =>
    `${u.nombre} ${u.correo} ${u.rol}`
      .toLocaleLowerCase("es")
      .includes(busqueda.toLocaleLowerCase("es")),
  );
  return (
    <>
      <section className="surface">
        <div className="section-toolbar">
          <h2>Usuarios del negocio</h2>
          <button
            onClick={async () => {
              await refresh();
              setGuardados({});
              setRevision((r) => r + 1);
            }}
          >
            Actualizar usuarios
          </button>
        </div>
        <Field label="Buscar usuario, correo o rol">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Field>
      </section>
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Cargando usuarios…</p>
      ) : usuarios.length ? (
        usuarios.map((u) => (
          <SeleccionUsuario
            key={`${u.id}-${revision}`}
            usuario={guardados[u.id] || u}
            empresaId={empresaId}
            onSaved={(actualizado) =>
              setGuardados((prev) => ({
                ...prev,
                [actualizado.id]: actualizado,
              }))
            }
          />
        ))
      ) : (
        <Empty>No hay usuarios que coincidan.</Empty>
      )}
    </>
  );
}

export default function Visualizaciones() {
  const { data, loading, error, refresh } = useData(
    () => api<Empresa[]>("/empresas"),
    [],
  );
  const [empresaId, setEmpresaId] = useState("");
  return (
    <>
      <PageTitle
        title="Visualizaciones de usuarios"
        description="Asigna a cada persona su modalidad y tipo de atención."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Seleccionar negocio</h2>
          <button onClick={() => void refresh()}>Actualizar empresas</button>
        </div>
        <Field label="Empresa para asignar visualizaciones">
          <select
            value={empresaId}
            disabled={loading}
            onChange={(e) => setEmpresaId(e.target.value)}
          >
            <option value="">
              {loading ? "Cargando empresas…" : "Selecciona una empresa"}
            </option>
            {data
              .filter((e) => e.ruc !== "00000000000")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} · {e.razonSocial}
                </option>
              ))}
          </select>
        </Field>
        <p className="hint">
          Cada usuario conserva su empresa, rol y plan. Comercio utiliza la
          experiencia actual. Atención y servicios abre el espacio independiente
          del rubro elegido.
        </p>
      </section>
      {empresaId && (
        <UsuariosEmpresa key={empresaId} empresaId={Number(empresaId)} />
      )}
    </>
  );
}
