import { useSearchParams } from "react-router-dom";
import ListaCicloCompra from "../components/ListaCicloCompra";
import FlujoCompra from "../components/FlujoCompra";
import CodigoProducto from "../components/CodigoProducto";
import { can, useSession } from "../lib/session";
import { useEffect, useState } from "react";
import { api, date, money } from "../lib/api";
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
    codigo_barras?: string | null;
  }[];
  datos?: { lineas: { productoId: number; cantidad: number; costo: number }[] };
};
export default function OrdenesCompra({ paso = 2 }: { paso?: 2 | 3 }) {
  const session = useSession();
  const [params] = useSearchParams();
  const refresh = () => window.dispatchEvent(new Event("compras-updated"));
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
  const ordenInicial = params.get("orden");
  useEffect(() => {
    let alive = true;
    if (ordenInicial && /^\d+$/.test(ordenInicial))
      api<Orden>(`/ordenes-compra/${Number(ordenInicial)}`)
        .then((data) => {
          if (alive) setSelected(data);
        })
        .catch((e) => {
          if (alive) setFailure((e as Error).message);
        });
    return () => {
      alive = false;
    };
  }, [ordenInicial]);
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
              <CodigoProducto
                id={l.productoId}
                nombre={
                  "nombre" in l ? String(l.nombre) : `Artículo #${l.productoId}`
                }
                codigo={
                  "codigo_barras" in l && typeof l.codigo_barras === "string"
                    ? l.codigo_barras
                    : null
                }
                ordenId={selected.id}
                onSaved={() => void abrir(selected.id)}
              />
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
        title={paso === 2 ? "Órdenes y recepción" : "Compras recibidas"}
        description="Cada pedido conserva su OC y su compra final. El stock aumenta únicamente al confirmar la recepción."
      />
      <FlujoCompra paso={paso} />
      <ErrorNotice message={failure} />
      <ListaCicloCompra
        key={paso}
        paso={paso}
        onOrden={(id) => void abrir(id)}
        onCompra={setPurchase}
      />
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
        <DetalleCompra
          id={purchase}
          onClose={() => setPurchase(null)}
          onVerOrden={(id) => {
            setPurchase(null);
            void abrir(id);
          }}
        />
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
