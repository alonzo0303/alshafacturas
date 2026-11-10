import { useData } from "../lib/useData";
import { Link } from "react-router-dom";
import {
  api,
  money,
  type Producto,
  type Venta,
  type Empresa,
} from "../lib/api";
import { ErrorNotice, Empty, PageTitle, Table } from "../components/ui";
type Resumen = {
  productos: number;
  stock_bajo: number;
  valor_inventario: number;
  ventas_total: number;
  ventas_cantidad: number;
  pendientes_fiscales: number;
};
export default function Dashboard() {
  const { data, loading, error, refresh } = useData<{
    resumen: Resumen | null;
    productos: Producto[];
    ventas: Venta[];
  }>(
    async () => ({
      resumen: await api<Resumen>("/resumen"),
      productos: await api<Producto[]>("/productos"),
      ventas: await api<Venta[]>("/ventas"),
    }),
    { resumen: null, productos: [], ventas: [] },
  );
  return (
    <>
      <PageTitle
        title="Resumen del negocio"
        description="Ventas e inventario de tu empresa, con datos actualizados."
      >
        <Link className="button primary" to="/panel/pos">
          Nueva venta
        </Link>
      </PageTitle>
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Cargando resumen…</p>
      ) : (
        data.resumen && (
          <>
            <section className="metrics" aria-label="Indicadores del negocio">
              {[
                {
                  label: "Ventas confirmadas",
                  value: money(data.resumen.ventas_total),
                  detail: `${data.resumen.ventas_cantidad} operaciones`,
                },
                {
                  label: "Productos",
                  value: data.resumen.productos,
                  detail: "En tu catálogo",
                },
                {
                  label: "Stock bajo",
                  value: data.resumen.stock_bajo,
                  detail: "Productos por reponer",
                },
                {
                  label: "Valor de inventario",
                  value: money(data.resumen.valor_inventario),
                  detail: "A precio de venta",
                },
              ].map((m) => (
                <article key={m.label}>
                  <p>{m.label}</p>
                  <strong>{m.value}</strong>
                  <small>{m.detail}</small>
                </article>
              ))}
            </section>
            {data.resumen.pendientes_fiscales > 0 && (
              <div className="notice">
                Tienes {data.resumen.pendientes_fiscales} solicitudes sin
                emisión electrónica.{" "}
                <Link to="/panel/facturacion">Revisar facturación</Link>
              </div>
            )}
            <section className="surface">
              <div className="section-toolbar">
                <h2>Productos por reponer</h2>
                <Link to="/panel/compra">Registrar compra</Link>
                <button onClick={() => void refresh()}>Actualizar</button>
              </div>
              {data.productos.some((p) => p.activo && p.stock <= p.minimo) ? (
                <Table headers={["Código", "Producto", "Stock", "Mínimo"]}>
                  {data.productos
                    .filter((p) => p.activo && p.stock <= p.minimo)
                    .slice(0, 20)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.sku}</td>
                        <td>{p.nombre}</td>
                        <td className="number">{p.stock}</td>
                        <td className="number">{p.minimo}</td>
                      </tr>
                    ))}
                </Table>
              ) : (
                <Empty>No hay productos por debajo del stock mínimo.</Empty>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
export function Configuracion() {
  const { data, error, loading, refresh } = useData(
    () => api<Empresa>("/empresas/mi-empresa"),
    null,
  );
  return (
    <>
      <PageTitle
        title="Configuración"
        description="Información de tu empresa y condiciones de operación."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <h2>Datos de la empresa</h2>
        {loading ? (
          <p role="status">Cargando datos…</p>
        ) : (
          data && (
            <dl className="details">
              <div>
                <dt>Razón social</dt>
                <dd>{data.razonSocial}</dd>
              </div>
              <div>
                <dt>RUC</dt>
                <dd>{data.ruc || "Sin RUC · Gestión interna"}</dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>{data.direccion || "Sin dirección registrada"}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{data.estado}</dd>
              </div>
            </dl>
          )
        )}
        <button onClick={() => void refresh()}>Actualizar</button>
      </section>
      <section className="surface">
        <h2>Operación comercial</h2>
        <p>
          {data?.ruc
            ? "Moneda: soles (PEN). Precios con IGV del 18%. NV01 son notas internas. Otros regímenes requieren configuración."
            : "Gestión interna sin RUC. Moneda: soles (PEN). Inventario y notas internas sin desglose fiscal; no se emiten comprobantes electrónicos."}
        </p>
        <p>
          Para cambiar los datos de empresa, contacta al administrador de la
          plataforma.
        </p>
      </section>
    </>
  );
}
