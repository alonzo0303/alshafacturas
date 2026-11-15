import { useEffect, useState } from "react";
import { api, type Session } from "../lib/api";
import type { Caja } from "../lib/cajas";
import { Modal, ErrorNotice } from "./ui";
import DetalleCaja from "./DetalleCaja";
export default function CajaPendiente({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const [pendientes, setPendientes] = useState<Caja[]>([]),
    [detalle, setDetalle] = useState<Caja | null>(null),
    [error, setError] = useState("");
  const refresh = () =>
    api<Caja[]>("/cajas-pendientes")
      .then(setPendientes)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30000);
    window.addEventListener("caja-updated", refresh);
    window.addEventListener("cash-pending", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("caja-updated", refresh);
      window.removeEventListener("cash-pending", refresh);
    };
  }, [session.localId]);
  if (!pendientes.length) return null;
  if (detalle)
    return (
      <DetalleCaja
        caja={detalle}
        query=""
        onClose={() => setDetalle(null)}
        onChanged={() => {
          setDetalle(null);
          void refresh();
          window.dispatchEvent(new Event("caja-updated"));
        }}
      />
    );
  return (
    <Modal
      title="Caja anterior pendiente de cierre"
      dismissible={false}
      onClose={() => {}}
    >
      <p>
        Tienes una caja de una jornada anterior. Debes resolver su cierre antes
        de registrar nuevas operaciones.
      </p>
      <ErrorNotice message={error} />
      {pendientes.map((c) => (
        <button
          key={c.id}
          onClick={async () => {
            try {
              if (c.local_id !== session.localId) {
                await api("/locales/seleccionar", "POST", {
                  localId: c.local_id,
                });
                window.location.reload();
                return;
              }
              setDetalle(await api<Caja>(`/cajas/${c.id}`));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Revisar y cerrar caja #{c.id}
        </button>
      ))}
      <button onClick={onLogout}>Cerrar sesión</button>
    </Modal>
  );
}
