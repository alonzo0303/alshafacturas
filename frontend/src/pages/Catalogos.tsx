import { ProductImage } from "../components/ProductImage";
import { useData } from "../lib/useData";
import { useState } from "react";
import { api, money, type Producto, type Cliente } from "../lib/api";
import { can, useSession, taxLabels } from "../lib/session";
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
import ProductEditor from "../components/ProductEditor";
import BarcodeScanner from "../components/BarcodeScanner";
export function Productos() {
  const { data, error, loading, refresh } = useData(
      () => api<Producto[]>("/productos"),
      [],
    ),
    [editing, setEditing] = useState<Producto | null>(null),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState(""),
    session = useSession();
  const list = data.filter((p) =>
    `${p.sku} ${p.nombre} ${p.marca} ${p.codigo_barras || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Productos"
        description="Mercadería propia con marca, código de barras y precio de venta."
      >
        {can(session, "PRODUCTOS_EDITAR") && (
          <button className="primary" onClick={() => setCreate(true)}>
            Nuevo producto
          </button>
        )}
      </PageTitle>
      <ErrorNotice message={error} />
      <section className="surface">
        <BarcodeScanner
          value={search}
          onChange={setSearch}
          onScan={setSearch}
        />
        <div className="section-toolbar">
          <h2>Catálogo ({data.length})</h2>
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando productos…</p>
        ) : list.length ? (
          <Table
            headers={[
              "Código",
              "Producto / Marca",
              "Precio final",
              "Stock",
              "Mínimo",
              "Estado",
              "Acciones",
            ]}
          >
            {list.map((p) => (
              <tr key={p.id}>
                <td className="mono">
                  {p.sku}
                  <small>{p.codigo_barras || "Sin código de barras"}</small>
                </td>
                <td>
                  <div className="product-identity">
                    <ProductImage
                      id={p.id}
                      version={p.imagen_version}
                      name={p.nombre}
                      className="product-thumb"
                    />
                    <span>{p.nombre}</span>
                  </div>
                  <small>
                    {p.marca} · {p.presentacion || p.categoria}
                  </small>
                </td>
                <td>
                  {p.precio > 0 ? money(p.precio) : "Por definir"}
                  <small>{taxLabels[p.afectacion_igv]}</small>
                </td>
                <td>
                  <Badge
                    neutral={p.stock > p.minimo}
                    danger={p.stock <= p.minimo}
                  >
                    {p.stock}
                    {p.stock <= p.minimo ? " · Stock bajo" : ""}
                  </Badge>
                </td>
                <td>{p.minimo}</td>
                <td>{p.activo ? "Activo" : "Inactivo"}</td>
                <td>
                  {can(session, "PRODUCTOS_EDITAR") && (
                    <button onClick={() => setEditing(p)}>
                      Editar<span className="sr-only"> {p.nombre}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>
            {search
              ? "No se encontraron coincidencias."
              : "Registra tu primera mercadería o incorpora una plantilla del catálogo común."}
          </Empty>
        )}
      </section>
      {(create || editing) && (
        <Modal
          title={editing ? "Editar producto" : "Nuevo producto"}
          onClose={() => {
            setEditing(null);
            setCreate(false);
          }}
        >
          <ProductEditor
            categories={data.map((p) => p.categoria)}
            product={editing || undefined}
            onSaved={() => {
              setEditing(null);
              setCreate(false);
              void refresh();
            }}
          />
        </Modal>
      )}
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
