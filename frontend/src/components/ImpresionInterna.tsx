import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
export default function ImpresionInterna({
  titulo,
  children,
  onClose,
}: {
  titulo: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [format, setFormat] = useState("A4");
  useEffect(() => {
    ref.current?.showModal();
    document.body.dataset.impresionInterna = "true";
    return () => {
      delete document.body.dataset.impresionInterna;
    };
  }, []);
  useEffect(() => {
    const style = document.createElement("style");
    const h = Math.max(
      45,
      Math.ceil(
        ((ref.current?.querySelector("#receipt")?.getBoundingClientRect()
          .height || 400) *
          25.4) /
          96,
      ) + 8,
    );
    style.textContent =
      format === "A4"
        ? "@media print{@page{size:A4;margin:12mm}}"
        : `@media print{@page{size:${format}mm ${h}mm;margin:2mm}#receipt{width:${Number(format) - 4}mm!important;max-width:${Number(format) - 4}mm!important}}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [format]);
  return createPortal(
    <dialog
      ref={ref}
      className="receipt-dialog internal-print"
      onCancel={onClose}
      aria-labelledby="internal-print-title"
    >
      <div className="receipt-actions">
        <label>
          Formato de documento interno
          <select
            aria-label="Formato de documento interno"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="A4">A4</option>
            <option value="80">Ticket de 80 mm</option>
            <option value="58">Ticket de 58 mm</option>
          </select>
        </label>
        <button onClick={onClose}>Cerrar impresión</button>
        <button className="primary" onClick={() => window.print()}>
          Imprimir documento interno
        </button>
      </div>
      <article
        id="receipt"
        className={format === "A4" ? "" : "thermal-receipt"}
        style={
          format === "A4" ? undefined : { width: `${Number(format) - 4}mm` }
        }
      >
        <h1 id="internal-print-title">{titulo}</h1>
        {children}
      </article>
    </dialog>,
    document.getElementById("contenido") || document.body,
  );
}
