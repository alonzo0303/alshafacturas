import { taxLabels } from "../lib/session";
import { useEffect, useRef, useState } from "react";
import { money, date, type Venta } from "../lib/api";
export default function Recibo({
  venta: v,
  onClose,
}: {
  venta: Venta;
  onClose: () => void;
}) {
  const [format, setFormat] = useState("A4");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => {
    const style = document.createElement("style");
    const height = Math.max(
      40,
      Math.ceil(
        ((ref.current?.querySelector("#receipt")?.getBoundingClientRect()
          .height || 400) *
          25.4) /
          96,
      ) + 8,
    );
    style.textContent =
      format === "A4"
        ? "@media print { @page { size:A4; margin:12mm; } }"
        : `@media print { @page { size:${format}mm ${height}mm; margin:2mm; } #receipt { width:${Number(format) - 4}mm !important; max-width:${Number(format) - 4}mm !important; } }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [format]);
  return (
    <dialog
      ref={ref}
      className="receipt-dialog"
      onCancel={onClose}
      aria-labelledby="receipt-title"
    >
      <div className="receipt-actions">
        <label>
          Formato de impresión
          <select
            aria-label="Formato de impresión"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="A4">Hoja A4</option>
            <option value="80">Ticket térmico 80 mm</option>
            <option value="58">Ticket térmico 58 mm</option>
          </select>
        </label>
        <button onClick={onClose}>Cerrar</button>
        <button className="primary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
      </div>
      {format !== "A4" && (
        <p className="print-help">
          Selecciona papel de {format} mm en el controlador de la impresora,
          escala 100% y desactiva encabezados y pies. Si el controlador admite
          rollo continuo, selecciona esa opción. Este formato conserva la nota
          interna; no la convierte en una boleta electrónica.
        </p>
      )}
      <article
        id="receipt"
        className={format === "A4" ? "" : "thermal-receipt"}
        style={
          format === "A4" ? undefined : { width: `${Number(format) - 4}mm` }
        }
      >
        <p className="eyebrow">AlshaFacturas</p>
        <h1 id="receipt-title">Nota de venta interna</h1>
        <h2>{v.razon_social}</h2>
        <p>
          {v.ruc ? `RUC ${v.ruc}` : "Gestión interna · Sin RUC"}
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
              <th className="number">Cant.</th>
              <th className="number">Precio</th>
              <th className="number">Total</th>
            </tr>
          </thead>
          <tbody>
            {v.lineas?.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.nombre}
                  {v.ruc && l.afectacion_igv && (
                    <small>{taxLabels[l.afectacion_igv]}</small>
                  )}
                </td>
                <td className="number">{l.cantidad}</td>
                <td className="number">{money(l.precio)}</td>
                <td className="number">{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="totals">
          {v.ruc && (
            <>
              <div>
                <dt>Importe sin IGV</dt>
                <dd>{money(v.subtotal)}</dd>
              </div>
              <div>
                <dt>IGV 18%</dt>
                <dd>{money(v.igv)}</dd>
              </div>
            </>
          )}
          <div className="total">
            <dt>Total</dt>
            <dd>{money(v.total)}</dd>
          </div>
        </dl>
        <p>
          {v.ruc
            ? "Moneda: soles (PEN). Precios finales. El IGV se desglosa solo en operaciones gravadas."
            : "Moneda: soles (PEN). Importes de gestión interna sin desglose fiscal."}
        </p>
      </article>
    </dialog>
  );
}
