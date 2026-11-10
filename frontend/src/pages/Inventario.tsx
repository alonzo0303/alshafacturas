import { useData } from "../lib/useData";
import { api, date, type Producto } from "../lib/api";
import {
  Field,
  Form,
  ErrorNotice,
  Empty,
  PageTitle,
  Table,
} from "../components/ui";
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
  );
  return (
    <>
      <PageTitle
        title="Inventario"
        description="Entradas, salidas y trazabilidad de tus existencias."
      />
      <ErrorNotice message={error} />
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
          onDone={() => void refresh()}
        >
          <div className="form-grid">
            <Field label="Producto">
              <select name="productoId" required defaultValue="">
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
      <section className="surface">
        <div className="section-toolbar">
          <h2>Últimos 500 movimientos</h2>
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
        {loading ? (
          <p role="status">Cargando movimientos…</p>
        ) : data.movimientos.length ? (
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
                <td className="number">
                  {m.cantidad > 0 ? "+" : ""}
                  {m.cantidad}
                </td>
                <td className="number">{m.saldo}</td>
                <td>{m.motivo}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>
            No hay movimientos. Registra una compra o un ajuste inicial.
          </Empty>
        )}
      </section>
    </>
  );
}
