import { can, useSession } from "../lib/session";
import { useState } from "react";
import { api, date, money } from "../lib/api";
import { useData } from "../lib/useData";
import {
  PageTitle,
  ErrorNotice,
  Table,
  Modal,
  Form,
  Field,
} from "../components/ui";
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
  recibido_nombre?: string;
  recibido_en?: string;
  documento_recepcion?: string;
  articulos?: {
    productoId: number;
    nombre: string;
    sku: string;
    cantidad: number;
    costo: number;
  }[];
  datos?: { lineas: { productoId: number; cantidad: number; costo: number }[] };
};
export default function OrdenesCompra({
  pendientesOnly = false,
}: {
  pendientesOnly?: boolean;
}) {
  const session = useSession();
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
        Registró: {selected.usuario_nombre} · {date(selected.fecha)} ·{" "}
        {selected.estado === "PENDIENTE"
          ? "Pendiente de recepción"
          : selected.estado}
      </p>
      {selected.recibido_nombre && (
        <p>
          Recibió: {selected.recibido_nombre} ·{" "}
          {selected.recibido_en && date(selected.recibido_en)} · Documento:{" "}
          {selected.documento_recepcion}
        </p>
      )}
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
      {!pendientesOnly && (
        <PageTitle
          title="Órdenes de compra"
          description="Registra el pedido y su referencia. Verifica físicamente la mercadería antes de confirmar la recepción."
        />
      )}
      <ErrorNotice message={error || failure} />
      <section className="surface">
        <div className="section-toolbar">
          <h2>
            {pendientesOnly ? "Pendientes de recepción" : "Órdenes registradas"}
          </h2>
          <button onClick={() => void refresh()}>Actualizar órdenes</button>
        </div>
        {loading ? (
          <p role="status">Cargando órdenes…</p>
        ) : (
          <Table
            headers={[
              "Orden",
              "Registró / Fecha y hora (Perú)",
              "Proveedor / Referencia",
              "Estado",
              "Total",
              "Acciones",
            ]}
          >
            {data
              .filter((o) => !pendientesOnly || o.estado === "PENDIENTE")
              .map((o) => (
                <tr key={o.id}>
                  <td>{o.numero}</td>
                  <td>
                    {o.usuario_nombre || "Sin autor histórico"}
                    <small>{date(o.fecha)}</small>
                  </td>
                  <td>
                    {o.proveedor}
                    <small>{o.referencia}</small>
                  </td>
                  <td>
                    {o.estado === "PENDIENTE"
                      ? "Pendiente de recepción"
                      : o.estado === "RECIBIDA"
                        ? "Recibido / Completado"
                        : o.estado}
                  </td>
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
                {can(session, "COMPRAS_RECIBIR") && (
                  <button
                    className="primary"
                    onClick={() => setAction("recibir")}
                  >
                    Confirmar recepción
                  </button>
                )}
                {can(session, "COMPRAS_GESTIONAR") && (
                  <button onClick={() => setAction("cancelar")}>
                    Cancelar orden
                  </button>
                )}
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
      {selected && action === "recibir" && (
        <Modal
          title="Verificar recepción de mercadería"
          onClose={() => setAction(null)}
        >
          {content}
          <Form
            label="Aprobar ingreso al inventario"
            onSave={(d) =>
              api(`/ordenes-compra/${selected.id}/recibir`, "POST", {
                documento: d.get("documento"),
                conforme: d.get("conforme") === "on",
              })
            }
            onDone={() => {
              setAction(null);
              void abrir(selected.id);
              void refresh();
              window.dispatchEvent(new Event("compras-updated"));
            }}
          >
            <Field label="Guía de remisión o factura del proveedor">
              <input name="documento" required maxLength={120} />
            </Field>
            <label className="check">
              <input name="conforme" type="checkbox" required />
              Confirmo que verifiqué los productos y cantidades físicas contra
              esta OC y todo está conforme
            </label>
          </Form>
        </Modal>
      )}
      {selected && action === "cancelar" && (
        <ConfirmarAccion
          titulo="Cancelar orden de compra"
          descripcion="Se cancelará sin ingresar stock."
          onClose={() => setAction(null)}
          onConfirm={async () => {
            await api(`/ordenes-compra/${selected.id}/cancelar`, "POST", {});
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
