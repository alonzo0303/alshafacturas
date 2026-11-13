import { useState } from "react";
import { Modal, ErrorNotice } from "./ui";
export default function ConfirmarAccion({
  titulo,
  descripcion,
  peligro = false,
  onConfirm,
  onClose,
}: {
  titulo: string;
  descripcion: string;
  peligro?: boolean;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmado, setConfirmado] = useState(!peligro);
  return (
    <Modal
      title={titulo}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>{descripcion}</p>
      <ErrorNotice message={error} />
      {peligro && (
        <label className="check">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            disabled={busy}
          />
          Entiendo que la eliminación de la cuenta es permanente.
        </label>
      )}
      <div className="form-actions">
        <button type="button" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={peligro ? "danger-button" : "primary"}
          disabled={busy || !confirmado}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Guardando…"
            : peligro
              ? "Eliminar definitivamente"
              : "Confirmar acción"}
        </button>
      </div>
    </Modal>
  );
}
