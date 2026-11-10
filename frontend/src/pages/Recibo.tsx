import { useEffect, useRef } from "react";
import { money, date, type Venta } from "../lib/api";
export default function Recibo({
  venta: v,
  onClose,
}: {
  venta: Venta;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="receipt-dialog"
      onCancel={onClose}
      aria-labelledby="receipt-title"
    >
      <div className="receipt-actions">
        <button onClick={onClose}>Cerrar</button>
        <button className="primary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
      </div>
      <article id="receipt">
        <p className="eyebrow">AlshaFacturas</p>
        <h1 id="receipt-title">Nota de venta interna</h1>
        <h2>{v.razon_social}</h2>
        <p>
          RUC {v.ruc}
          <br />
          {v.direccion}
        </p>
        <div className="receipt-meta">
          <p>
            <strong>{v.numero}</strong>
            <br />
            {date(v.fecha)}
          </p>
          <p>
            Cliente: {v.cliente || "Venta al público"}
            <br />
            {v.cliente_documento}
            <br />
            Pago: {v.metodo_pago}
          </p>
        </div>
        <p className="notice">
          Documento interno sin validez tributaria.{" "}
          {v.tipo !== "TICKET" &&
            `Solicitud de ${v.tipo.toLowerCase()} pendiente de configuración y emisión electrónica.`}
        </p>
        {v.estado === "ANULADA" && (
          <p className="notice error">VENTA ANULADA</p>
        )}
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {v.lineas?.map((l) => (
              <tr key={l.id}>
                <td>{l.nombre}</td>
                <td className="number">{l.cantidad}</td>
                <td className="number">{money(l.precio)}</td>
                <td className="number">{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="totals">
          <div>
            <dt>Base imponible</dt>
            <dd>{money(v.subtotal)}</dd>
          </div>
          <div>
            <dt>IGV 18%</dt>
            <dd>{money(v.igv)}</dd>
          </div>
          <div className="total">
            <dt>Total</dt>
            <dd>{money(v.total)}</dd>
          </div>
        </dl>
        <p>Moneda: soles (PEN). Precios incluyen IGV.</p>
      </article>
    </dialog>
  );
}
