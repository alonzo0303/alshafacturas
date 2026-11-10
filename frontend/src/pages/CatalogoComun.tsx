import { useState } from "react";
import { api, type Producto } from "../lib/api";
import { useData } from "../lib/useData";
import { can, useSession } from "../lib/session";
import {
  Field,
  Form,
  ErrorNotice,
  Empty,
  PageTitle,
  Table,
  Modal,
} from "../components/ui";
import ProductEditor, { type Plantilla } from "../components/ProductEditor";
export function CatalogoPicker({
  onChoose,
}: {
  onChoose: (item: Plantilla) => void;
}) {
  const { data, error, loading, refresh } = useData(
      () => api<Plantilla[]>("/catalogo-comun"),
      [],
    ),
    [search, setSearch] = useState(""),
    [rubro, setRubro] = useState("");
  const list = data.filter(
    (p) =>
      (!rubro || p.rubro === rubro) &&
      `${p.nombre} ${p.rubro}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <ErrorNotice message={error} />
      <div className="section-toolbar">
        <input
          aria-label="Buscar en catálogo común"
          value={search}
          type="search"
          placeholder="Buscar un producto común"
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label="Rubro">
          <select value={rubro} onChange={(e) => setRubro(e.target.value)}>
            <option value="">Todos los rubros</option>
            {[...new Set(data.map((p) => p.rubro))].sort().map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <button type="button" onClick={() => void refresh()}>
          Actualizar catálogo
        </button>
      </div>
      {loading ? (
        <p role="status">Cargando catálogo…</p>
      ) : list.length ? (
        <div className="catalog-grid">
          {list.map((p) => (
            <article className="catalog-item" key={p.id}>
              <h3>{p.nombre}</h3>
              <small>{p.rubro}</small>
              {p.descripcion && <p>{p.descripcion}</p>}
              <button type="button" onClick={() => onChoose(p)}>
                Usar producto<span className="sr-only"> {p.nombre}</span>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty>
          No hay productos para este filtro. Puedes crear mercadería propia
          desde Productos o Compras.
        </Empty>
      )}
    </>
  );
}
export function CatalogoNegocio() {
  const [selected, setSelected] = useState<Plantilla | null>(null),
    [message, setMessage] = useState(""),
    session = useSession();
  return (
    <>
      <PageTitle
        title="Catálogo común"
        description="Productos habituales por rubro. Cada negocio decide su marca, presentación y precio."
      />
      <p className="notice">
        Las plantillas no incluyen precios de venta ni existencias. Al
        incorporarlas se crean productos propios de tu negocio.
      </p>
      <p role="status">{message}</p>
      {can(session, "PRODUCTOS_EDITAR") ? (
        <section className="surface">
          <CatalogoPicker
            onChoose={(p) => {
              setMessage("");
              setSelected(p);
            }}
          />
        </section>
      ) : (
        <p>
          Tu rol permite consultar productos. Para incorporar una plantilla
          necesitas permiso de edición.
        </p>
      )}
      {selected && (
        <Modal
          title={`Incorporar ${selected.nombre}`}
          onClose={() => setSelected(null)}
        >
          <ProductEditor
            template={selected}
            onSaved={(p: Producto) => {
              setSelected(null);
              setMessage(
                `${p.nombre} incorporado. Añade existencias desde Compras o Inventario.`,
              );
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function CatalogoAdmin() {
  const { data, error, loading, refresh } = useData(
      () => api<Plantilla[]>("/catalogo-comun"),
      [],
    ),
    [editing, setEditing] = useState<Plantilla | null>(null),
    [search, setSearch] = useState("");
  return (
    <>
      <PageTitle
        title="Catálogo común de la plataforma"
        description="Define las plantillas que podrán incorporar los negocios de maquillaje, ferretería, abarrotes y otros rubros."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <h2>{editing ? "Editar plantilla" : "Nueva plantilla"}</h2>
        <Form
          key={editing?.id ?? "new"}
          onSave={(d) =>
            api(
              `/catalogo-comun${editing ? "/" + editing.id : ""}`,
              editing ? "PUT" : "POST",
              {
                nombre: d.get("nombre"),
                rubro: d.get("rubro"),
                descripcion: d.get("descripcion"),
                activo: d.get("activo") === "on",
              },
            )
          }
          onDone={() => {
            setEditing(null);
            void refresh();
          }}
        >
          <div className="form-grid">
            <Field label="Nombre del producto común">
              <input
                name="nombre"
                maxLength={200}
                required
                defaultValue={editing?.nombre}
              />
            </Field>
            <Field label="Rubro del catálogo">
              <input
                name="rubro"
                maxLength={100}
                required
                defaultValue={editing?.rubro}
              />
            </Field>
            <Field label="Descripción (opcional)">
              <input
                name="descripcion"
                maxLength={500}
                defaultValue={editing?.descripcion}
              />
            </Field>
          </div>
          <label className="check">
            <input
              name="activo"
              type="checkbox"
              defaultChecked={editing?.activo ?? true}
            />
            Disponible para los negocios
          </label>
          {editing && (
            <button type="button" onClick={() => setEditing(null)}>
              Cancelar edición
            </button>
          )}
        </Form>
      </section>
      <section className="surface">
        <div className="section-toolbar">
          <h2>Plantillas publicadas</h2>
          <input
            aria-label="Buscar plantillas"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o rubro"
          />
        </div>
        {loading ? (
          <p role="status">Cargando plantillas…</p>
        ) : (
          <Table headers={["Producto común", "Rubro", "Estado", "Acciones"]}>
            {data
              .filter((p) =>
                `${p.nombre} ${p.rubro}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.rubro}</td>
                  <td>{p.activo ? "Disponible" : "Oculto"}</td>
                  <td>
                    <button
                      onClick={() => {
                        setEditing(p);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Editar<span className="sr-only"> {p.nombre}</span>
                    </button>
                  </td>
                </tr>
              ))}
          </Table>
        )}
      </section>
    </>
  );
}
