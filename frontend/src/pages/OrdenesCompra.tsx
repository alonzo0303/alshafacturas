import { useState } from "react";
import { api, date, money } from "../lib/api";
import { useData } from "../lib/useData";
import { PageTitle, ErrorNotice, Table, Modal } from "../components/ui";
import DocumentosCompra from "../components/DocumentosCompra";
import DetalleCompra from "../components/DetalleCompra";
import ConfirmarAccion from "../components/ConfirmarAccion";
import ImpresionInterna from "../components/ImpresionInterna";
type Orden = {
  id: number;
  numero: string;
  proveedor: string;
  referencia: string;
  fecha: string;
  estado: string;
  total: number;
  compra_id: number | null;
  usuario_nombre: string;
  articulos?: {
    productoId: number;
    nombre: string;
    sku: string;
    cantidad: number;
    costo: number;
  }[];
  datos?: { lineas: { productoId: number; cantidad: number; costo: number }[] };
};
export default function OrdenesCompra() {
  const { data, error, loading, refresh } = useData(
    () => api<Orden[]>("/ordenes-compra"),
    [],
  );
  const [selected, setSelected] = useState<Orden | null>(null),
    [failure, setFailure] = useState(""),
    [action, setAction] = useState<"recibir" | "cancelar" | null>(null),
    [purchase, setPurchase] = useState<number | null>(null),
    [print, setPrint] = useState(false);
  async function abrir(id: number) {
    setFailure("");
    try {
      setSelected(await api<Orden>(`/ordenes-compra/${id}`));
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  const content = selected && (
    <>
      <h2>{selected.numero}</h2>
      <p>
        {selected.proveedor} · {selected.referencia} · {date(selected.fecha)}
      </p>
      <p>
        Registró: {selected.usuario_nombre} · {selected.estado}
      </p>
      <Table headers={["Artículo", "Cantidad", "Costo unitario"]}>
        {(selected.articulos || selected.datos?.lineas || []).map((l) => (
          <tr key={l.productoId}>
            <td>
              {"nombre" in l ? String(l.nombre) : `Artículo #${l.productoId}`}
            </td>
            <td>{l.cantidad}</td>
            <td>{money(l.costo)}</td>
          </tr>
        ))}
      </Table>
      <p>Total estimado: {money(selected.total)}</p>
      <p>
        Orden interna. El stock se ingresa únicamente al confirmar la recepción.
      </p>
    </>
  );
  return (
    <>
      <PageTitle
        title="Órdenes de compra"
        description="Crea órdenes desde Registrar compra. Recibir una orden registra la compra y actualiza el stock una sola vez."
      />
      <ErrorNotice message={error || failure} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>Órdenes registradas</h2>
          <button onClick={() => void refresh()}>Actualizar órdenes</button>
        </div>
        {loading ? (
          <p role="status">Cargando órdenes…</p>
        ) : (
          <Table
            headers={[
              "Orden",
              "Fecha",
              "Proveedor",
              "Estado",
              "Total",
              "Acciones",
            ]}
          >
            {data.map((o) => (
              <tr key={o.id}>
                <td>{o.numero}</td>
                <td>{date(o.fecha)}</td>
                <td>{o.proveedor}</td>
                <td>{o.estado}</td>
                <td>{money(o.total)}</td>
                <td>
                  <button onClick={() => void abrir(o.id)}>
                    Ver orden<span className="sr-only"> {o.numero}</span>
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      {selected && (
        <Modal title={selected.numero} onClose={() => setSelected(null)}>
          {content}
          <div className="row-actions">
            <button onClick={() => setPrint(true)}>Imprimir orden</button>
            {selected.estado === "PENDIENTE" && (
              <>
                <button
                  className="primary"
                  onClick={() => setAction("recibir")}
                >
                  Confirmar recepción
                </button>
                <button onClick={() => setAction("cancelar")}>
                  Cancelar orden
                </button>
              </>
            )}
            {selected.compra_id && (
              <button onClick={() => setPurchase(selected.compra_id)}>
                Ver compra recibida
              </button>
            )}
          </div>
          <DocumentosCompra
            key={selected.id}
            tipo="ordenes-compra"
            id={selected.id}
          />
        </Modal>
      )}
      {selected && action && (
        <ConfirmarAccion
          titulo={
            action === "recibir"
              ? "Recibir orden de compra"
              : "Cancelar orden de compra"
          }
          descripcion={
            action === "recibir"
              ? "Se registrará la compra con las cantidades y costos de esta orden y se ingresará el stock."
              : "Se cancelará la orden sin ingresar stock."
          }
          onClose={() => setAction(null)}
          onConfirm={async () => {
            const r = await api<{ id: number }>(
              `/ordenes-compra/${selected.id}/${action}`,
              "POST",
              {},
            );
            if (action === "recibir") setPurchase(r.id);
            await abrir(selected.id);
            await refresh();
          }}
        />
      )}
      {purchase && (
        <DetalleCompra id={purchase} onClose={() => setPurchase(null)} />
      )}{" "}
      {print && (
        <ImpresionInterna
          titulo="Orden de compra"
          onClose={() => setPrint(false)}
        >
          {content}
        </ImpresionInterna>
      )}
    </>
  );
}
