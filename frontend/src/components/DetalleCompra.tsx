import CodigoProducto from "./CodigoProducto";
import { useState } from "react";
import { api, date, money, exportCsv } from "../lib/api";
import { useData } from "../lib/useData";
import { Modal, ErrorNotice } from "./ui";
import DocumentosCompra from "./DocumentosCompra";
import ImpresionInterna from "./ImpresionInterna";
type Datos = {
  id: number;
  proveedor: string;
  referencia: string;
  fecha: string;
  total: number;
  igv: number;
  subtotal: number;
  usuario_nombre?: string;
  recibido_nombre?: string;
  recibido_en?: string;
  documento_recepcion?: string;
  orden_numero?: string;
  orden_id?: number;
  lineas: {
    producto_id: number;
    codigo_barras?: string | null;
    nombre: string;
    sku: string;
    cantidad: number;
    costo: number;
  }[];
  empresa: { razon_social: string; ruc: string | null };
  local: { nombre: string };
};
export default function DetalleCompra({
  id,
  onClose,
  onVerOrden,
}: {
  id: number;
  onClose: () => void;
  onVerOrden?: (id: number) => void;
}) {
  const { data, error, loading, refresh } = useData(
    () => api<Datos>(`/compras/${id}`),
    null,
  );
  const [print, setPrint] = useState(false);
  function contenido() {
    return (
      data && (
        <>
          <h2>
            {data.empresa.razon_social} · {data.local.nombre}
          </h2>
          <p>
            Compra #{data.id} · {date(data.fecha)}
          </p>
          <p>
            Proveedor: {data.proveedor} · Referencia: {data.referencia}
          </p>
          <p>
            Registró: {data.usuario_nombre || "Sin registro de autor anterior"}
          </p>
          <p>
            OC: {data.orden_numero || "Registro histórico"} · Recibió:{" "}
            {data.recibido_nombre || "Sin autor histórico"}{" "}
            {data.recibido_en && date(data.recibido_en)} · Documento:{" "}
            {data.documento_recepcion || "Sin documento de recepción histórico"}
          </p>
          {data.orden_id && onVerOrden && (
            <button
              className="no-print"
              onClick={() => onVerOrden(data.orden_id!)}
            >
              Ver OC vinculada {data.orden_numero}
            </button>
          )}
          <table>
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Cantidad</th>
                <th>Costo unitario</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.lineas.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.nombre}
                    <small>{l.sku}</small>
                    <CodigoProducto
                      id={l.producto_id}
                      nombre={l.nombre}
                      codigo={l.codigo_barras}
                      compraId={id}
                      onSaved={() => void refresh()}
                    />
                  </td>
                  <td>{l.cantidad}</td>
                  <td>{money(l.costo)}</td>
                  <td>{money(l.cantidad * l.costo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Base: {money(data.subtotal)} · IGV: {money(data.igv)} · Total:{" "}
            <strong>{money(data.total)}</strong>
          </p>
          <p>
            Registro interno de compra. No sustituye el comprobante del
            proveedor.
          </p>
        </>
      )
    );
  }
  return (
    <>
      <Modal title={`Detalle de compra #${id}`} onClose={onClose}>
        <ErrorNotice message={error} />
        {loading ? (
          <p role="status">Cargando compra…</p>
        ) : (
          data && (
            <>
              <div className="row-actions">
                <button onClick={() => setPrint(true)}>Imprimir compra</button>
                <button
                  onClick={() =>
                    exportCsv(
                      `compra-${id}.csv`,
                      ["Artículo", "Código", "Cantidad", "Costo unitario"],
                      data.lineas.map((l) => [
                        l.nombre,
                        l.sku,
                        l.cantidad,
                        l.costo,
                      ]),
                    )
                  }
                >
                  Descargar registro de compra
                </button>
              </div>
              {contenido()}
              <DocumentosCompra tipo="compras" id={id} />
            </>
          )
        )}
      </Modal>
      {print && (
        <ImpresionInterna
          titulo="Registro de compra"
          onClose={() => setPrint(false)}
        >
          {contenido()}
        </ImpresionInterna>
      )}
    </>
  );
}
