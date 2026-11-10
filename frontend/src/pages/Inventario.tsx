import { useState } from "react";
import { useData } from "../lib/useData";
import { api, date, type Producto } from "../lib/api";
import { can, useSession } from "../lib/session";
import {
  Field,
  Form,
  ErrorNotice,
  Empty,
  PageTitle,
  Table,
  Badge,
} from "../components/ui";
import BarcodeScanner from "../components/BarcodeScanner";
type Movimiento = {
  id: number;
  fecha: string;
  sku: string;
  nombre: string;
  tipo: string;
  cantidad: number;
  saldo: number;
  motivo: string;
};
export default function Inventario() {
  const { data, error, loading, refresh } = useData(
      async () => ({
        productos: await api<Producto[]>("/productos"),
        movimientos: await api<Movimiento[]>("/inventario"),
      }),
      { productos: [], movimientos: [] },
    ),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    session = useSession();
  const list = data.productos.filter((p) =>
    `${p.nombre} ${p.sku} ${p.codigo_barras || ""} ${p.marca}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function scan(code: string) {
    setSearch(code);
    const p = data.productos.find(
      (p) =>
        p.codigo_barras === code || p.sku.toUpperCase() === code.toUpperCase(),
    );
    if (p) setSelected(String(p.id));
  }
  return (
    <>
      <PageTitle
        title="Inventario"
        description="Existencias actuales, stock mínimo e historial de movimientos."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <BarcodeScanner value={search} onChange={setSearch} onScan={scan} />
        <div className="section-toolbar">
          <h2>Existencias actuales</h2>
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando inventario…</p>
        ) : list.length ? (
          <Table
            headers={[
              "Código",
              "Producto / Marca",
              "Stock",
              "Mínimo",
              "Estado",
            ]}
          >
            {list.map((p) => (
              <tr key={p.id}>
                <td className="mono">
                  {p.sku}
                  <small>{p.codigo_barras}</small>
                </td>
                <td>
                  {p.nombre}
                  <small>
                    {p.marca} · {p.presentacion || p.categoria}
                  </small>
                </td>
                <td>
                  <Badge
                    danger={p.stock <= p.minimo}
                    neutral={p.stock > p.minimo}
                  >
                    {p.stock}
                    {p.stock <= p.minimo ? " · Stock bajo" : ""}
                  </Badge>
                </td>
                <td>{p.minimo}</td>
                <td>{p.activo ? "Activo" : "Inactivo"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No hay productos que coincidan con la búsqueda.</Empty>
        )}
      </section>
      {can(session, "INVENTARIO_EDITAR") && (
        <section className="surface">
          <h2>Ajustar existencias</h2>
          <p>
            Usa cantidades positivas para entradas y negativas para salidas. Las
            compras se registran en su módulo.
          </p>
          <Form
            onSave={(d) =>
              api("/inventario/ajustes", "POST", {
                productoId: Number(d.get("productoId")),
                cantidad: Number(d.get("cantidad")),
                motivo: d.get("motivo"),
              })
            }
            label="Registrar ajuste"
            onDone={() => {
              setSelected("");
              void refresh();
            }}
          >
            <div className="form-grid">
              <Field label="Producto para ajustar">
                <select
                  name="productoId"
                  required
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="" disabled>
                    Selecciona un producto
                  </option>
                  {data.productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.nombre} · Stock {p.stock}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad a sumar o restar">
                <input
                  name="cantidad"
                  type="number"
                  min="-1000000"
                  max="1000000"
                  required
                />
              </Field>
              <Field label="Motivo del ajuste">
                <input name="motivo" required maxLength={200} />
              </Field>
            </div>
          </Form>
        </section>
      )}
      <section className="surface">
        <h2>Últimos 500 movimientos</h2>
        {data.movimientos.length ? (
          <Table
            headers={[
              "Fecha",
              "Producto",
              "Movimiento",
              "Cantidad",
              "Saldo",
              "Motivo",
            ]}
          >
            {data.movimientos.map((m) => (
              <tr key={m.id}>
                <td>{date(m.fecha)}</td>
                <td>
                  {m.sku} · {m.nombre}
                </td>
                <td>{m.tipo}</td>
                <td>
                  {m.cantidad > 0 ? "+" : ""}
                  {m.cantidad}
                </td>
                <td>{m.saldo}</td>
                <td>{m.motivo}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No hay movimientos registrados.</Empty>
        )}
      </section>
    </>
  );
}
