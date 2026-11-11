import { searchText } from "../lib/search";
import { useState } from "react";
import { api, type Empresa } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, Form, ErrorNotice } from "../components/ui";
type Access = { disponibles: string[]; habilitados: string[] };
function Selector({ empresa }: { empresa: string }) {
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, loading, refresh } = useData(
    () => api<Access>(`/empresas/${empresa}/rubros-catalogo`),
    null,
  );
  return (
    <>
      <ErrorNotice message={error} />
      <p role="status">{message}</p>
      {loading ? (
        <p role="status">Consultando rubros…</p>
      ) : (
        data && (
          <Form
            key={data.habilitados.join(",")}
            label="Guardar acceso al catálogo"
            onSave={(d) =>
              api(`/empresas/${empresa}/rubros-catalogo`, "PUT", {
                rubros: d.getAll("rubros"),
              })
            }
            onDone={() => {
              setMessage("Acceso al catálogo actualizado.");
              void refresh();
            }}
          >
            <Field label="Buscar rubros para habilitar">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Por ejemplo: ferretería"
              />
            </Field>
            {!data.disponibles.some((r) =>
              searchText(r).includes(searchText(search)),
            ) && <p role="status">No se encontraron rubros.</p>}
            <div className="permission-list">
              {data.disponibles.map((r) => (
                <label
                  key={r}
                  hidden={!searchText(r).includes(searchText(search))}
                >
                  <input
                    name="rubros"
                    type="checkbox"
                    value={r}
                    defaultChecked={data.habilitados.includes(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
            <p className="hint">
              La selección se conserva al buscar. Sin rubros seleccionados, el
              negocio no verá plantillas comunes. Sus productos propios se
              conservan. Puedes habilitar más de un rubro.
            </p>
          </Form>
        )
      )}
    </>
  );
}
export default function RubrosAcceso() {
  const { data, error } = useData(() => api<Empresa[]>("/empresas"), []),
    [empresa, setEmpresa] = useState("");
  return (
    <section className="surface">
      <h2>Acceso al catálogo por rubro</h2>
      <p>Habilita únicamente las plantillas que correspondan a cada negocio.</p>
      <ErrorNotice message={error} />
      <Field label="Negocio para habilitar rubros">
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
          <option value="">Selecciona un negocio</option>
          {data
            .filter((e) => e.ruc !== "00000000000")
            .map((e) => (
              <option key={e.id} value={e.id}>
                #{e.id} · {e.razonSocial}
              </option>
            ))}
        </select>
      </Field>
      {empresa && <Selector key={empresa} empresa={empresa} />}
    </section>
  );
}
