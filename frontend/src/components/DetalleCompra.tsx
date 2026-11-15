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
  lineas: { nombre: string; sku: string; cantidad: number; costo: number }[];
  empresa: { razon_social: string; ruc: string | null };
  local: { nombre: string };
};
export default function DetalleCompra({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const { data, error, loading } = useData(
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
