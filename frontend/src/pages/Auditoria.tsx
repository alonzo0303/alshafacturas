import { useState } from "react";
import { api, date } from "../lib/api";
import { useData } from "../lib/useData";
import { PageTitle, ErrorNotice, Table } from "../components/ui";
type Evento = {
  id: number;
  fecha: string;
  actor_nombre: string;
  evento: string;
  objetivo: string;
  detalle: string;
  local_id: number | null;
};
export default function Auditoria({ query = "" }: { query?: string }) {
  const [before, setBefore] = useState(0);
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  params.set("antesDe", String(before));
  return (
    <>
      <PageTitle
        title="Auditoría"
        description="Registro de acciones críticas. No contiene contraseñas ni contenido de documentos."
      />
      <Eventos
        key={params.toString()}
        query={"?" + params.toString()}
        setBefore={setBefore}
      />
    </>
  );
}
function Eventos({
  query,
  setBefore,
}: {
  query: string;
  setBefore: (id: number) => void;
}) {
  const { data, error, loading, refresh } = useData(
    () => api<Evento[]>("/auditoria" + query),
    [],
  );
  return (
    <>
      <ErrorNotice message={error} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Últimos eventos</h2>
          <button onClick={() => void refresh()}>Actualizar auditoría</button>
        </div>
        {loading ? (
          <p role="status">Cargando auditoría…</p>
        ) : (
          <Table
            headers={[
              "Fecha",
              "Responsable",
              "Local",
              "Acción",
              "Registro",
              "Detalle",
            ]}
          >
            {data.map((e) => (
              <tr key={e.id}>
                <td>{date(e.fecha)}</td>
                <td>{e.actor_nombre}</td>
                <td>{e.local_id || "Empresa"}</td>
                <td>{e.evento}</td>
                <td>{e.objetivo}</td>
                <td>{e.detalle}</td>
              </tr>
            ))}
          </Table>
        )}
        <div className="row-actions">
          <button onClick={() => setBefore(0)}>Más recientes</button>
          <button
            disabled={data.length < 100}
            onClick={() => setBefore(data[data.length - 1].id)}
          >
            Ver anteriores
          </button>
        </div>
      </section>
    </>
  );
}
