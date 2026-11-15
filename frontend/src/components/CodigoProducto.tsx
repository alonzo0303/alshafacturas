import { useState } from "react";
import { api } from "../lib/api";
import { can, useSession } from "../lib/session";
import { Modal, ErrorNotice } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
export default function CodigoProducto({
  id,
  nombre,
  codigo,
  ordenId,
  compraId,
  onSaved,
  disabled = false,
}: {
  id: number;
  nombre: string;
  codigo?: string | null;
  ordenId?: number;
  compraId?: number;
  onSaved?: (codigo: string) => void;
  disabled?: boolean;
}) {
  const session = useSession();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const allowed =
    can(session, "PRODUCTOS_EDITAR") ||
    can(session, "COMPRAS_GESTIONAR") ||
    can(session, "COMPRAS_RECIBIR");
  return (
    <>
      <small>Código de barras: {codigo || "Sin registrar"}</small>
      {allowed && (
        <button
          className="no-print"
          type="button"
          disabled={disabled}
          onClick={() => {
            setValue(codigo || "");
            setError("");
            setOpen(true);
          }}
        >
          Editar código de barras<span className="sr-only"> de {nombre}</span>
        </button>
      )}
      {open && (
        <Modal
          title={`Código de barras de ${nombre}`}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>
            Se actualiza el código del producto en este local. No cambia el
            pedido ni el stock.
          </p>
          <ErrorNotice message={error} />
          <BarcodeScanner
            value={value}
            onChange={setValue}
            onScan={setValue}
            label="Código de barras del producto"
            actionLabel="Usar código leído"
          />
          <p className="hint">
            Hasta 80 caracteres. Conserva los ceros iniciales. Escanear rellena
            el campo; confirma para guardar.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy || !value.trim() || value.trim().length > 80}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api<{ codigo_barras: string }>(
                  `/productos/${id}/codigo-barras`,
                  "PATCH",
                  {
                    codigoBarras: value.trim(),
                    anterior: codigo ?? null,
                    ordenId,
                    compraId,
                  },
                );
                onSaved?.(r.codigo_barras);
                setOpen(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Guardando…" : "Guardar código de barras"}
          </button>
        </Modal>
      )}
    </>
  );
}
