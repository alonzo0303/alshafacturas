import { useData } from "../lib/useData";
import { useState } from "react";
import { api, money, type Producto, type Cliente } from "../lib/api";
import {
  Field,
  Form,
  ErrorNotice,
  Empty,
  PageTitle,
  Table,
  Badge,
} from "../components/ui";
export function Productos() {
  const { data, error, loading, refresh } = useData(
    () => api<Producto[]>("/productos"),
    [],
  );
  const [editing, setEditing] = useState<Producto | null>(null),
    [search, setSearch] = useState("");
  const list = data.filter((p) =>
    `${p.sku} ${p.nombre}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Productos"
        description="Catálogo y precios de venta de tu negocio."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <h2>{editing ? "Editar producto" : "Nuevo producto"}</h2>
        <Form
          key={editing?.id ?? "new"}
          onSave={(d) =>
            api(
              `/productos${editing ? "/" + editing.id : ""}`,
              editing ? "PUT" : "POST",
              {
                sku: d.get("sku"),
                nombre: d.get("nombre"),
                precio: Number(d.get("precio")),
                minimo: Number(d.get("minimo")),
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
            <Field label="Código / SKU">
              <input
                name="sku"
                required
                maxLength={60}
                defaultValue={editing?.sku}
              />
            </Field>
            <Field label="Nombre">
              <input
                name="nombre"
                required
                maxLength={200}
                defaultValue={editing?.nombre}
              />
            </Field>
            <Field label="Precio de venta (S/)">
              <input
                name="precio"
                type="number"
                min="0.01"
                max="999999999.99"
                step="0.01"
                required
                defaultValue={editing?.precio}
              />
            </Field>
            <Field label="Stock mínimo">
              <input
                name="minimo"
                type="number"
                min="0"
                max="1000000"
                required
                defaultValue={editing?.minimo ?? 5}
              />
            </Field>
          </div>
          <label className="check">
            <input
              name="activo"
              type="checkbox"
              defaultChecked={editing?.activo ?? true}
            />
            Disponible para venta
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
          <h2>Catálogo ({data.length})</h2>
          <input
            aria-label="Buscar productos"
            type="search"
            placeholder="Buscar por nombre o código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando productos…</p>
        ) : list.length ? (
          <Table
            headers={[
              "Código",
              "Producto",
              "Precio",
              "Stock",
              "Estado",
              "Acciones",
            ]}
          >
            {list.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.sku}</td>
                <td>{p.nombre}</td>
                <td className="number">{money(p.precio)}</td>
                <td>
                  <Badge neutral={p.stock > p.minimo}>
                    {p.stock} unidades{p.stock <= p.minimo ? " · Bajo" : ""}
                  </Badge>
                </td>
                <td>{p.activo ? "Activo" : "Inactivo"}</td>
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
        ) : (
          <Empty>
            {search
              ? "No se encontraron coincidencias."
              : "Registra tu primer producto. Añade existencias desde Compras o Inventario."}
          </Empty>
        )}
      </section>
    </>
  );
}
export function Clientes() {
  const { data, error, loading, refresh } = useData(
    () => api<Cliente[]>("/clientes"),
    [],
  );
  const [editing, setEditing] = useState<Cliente | null>(null),
    [search, setSearch] = useState("");
  const list = data.filter((c) =>
    `${c.documento} ${c.nombre}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Clientes"
        description="Datos de contacto e identificación para tus ventas."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <h2>{editing ? "Editar cliente" : "Nuevo cliente"}</h2>
        <Form
          key={editing?.id ?? "new"}
          onSave={(d) =>
            api(
              `/clientes${editing ? "/" + editing.id : ""}`,
              editing ? "PUT" : "POST",
              Object.fromEntries(d),
            )
          }
          onDone={() => {
            setEditing(null);
            void refresh();
          }}
        >
          <div className="form-grid">
            <Field label="DNI (8 dígitos) o RUC (11 dígitos)">
              <input
                name="documento"
                required
                pattern="[0-9]{8}|[0-9]{11}"
                inputMode="numeric"
                maxLength={11}
                defaultValue={editing?.documento}
              />
            </Field>
            <Field label="Nombre o razón social">
              <input
                name="nombre"
                required
                maxLength={200}
                defaultValue={editing?.nombre}
              />
            </Field>
            <Field label="Correo (opcional)">
              <input
                name="correo"
                type="email"
                maxLength={150}
                defaultValue={editing?.correo}
              />
            </Field>
            <Field label="Dirección (opcional)">
              <input
                name="direccion"
                maxLength={255}
                defaultValue={editing?.direccion}
              />
            </Field>
          </div>
          {editing && (
            <button type="button" onClick={() => setEditing(null)}>
              Cancelar edición
            </button>
          )}
        </Form>
      </section>
      <section className="surface">
        <div className="section-toolbar">
          <h2>Directorio ({data.length})</h2>
          <input
            aria-label="Buscar clientes"
            type="search"
            placeholder="Buscar nombre o documento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando clientes…</p>
        ) : list.length ? (
          <Table headers={["Documento", "Cliente", "Correo", "Acciones"]}>
            {list.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.documento}</td>
                <td>{c.nombre}</td>
                <td>{c.correo || "Sin correo"}</td>
                <td>
                  <button
                    onClick={() => {
                      setEditing(c);
                      window.scrollTo({ top: 0 });
                    }}
                  >
                    Editar<span className="sr-only"> {c.nombre}</span>
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>
            {search
              ? "No se encontraron coincidencias."
              : "Registra un cliente para asociarlo a una venta."}
          </Empty>
        )}
      </section>
    </>
  );
}
