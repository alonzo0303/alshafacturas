import { useEffect, useRef, useState } from "react";
import { api, type Session } from "../lib/api";
import { useDirty } from "../lib/dirty";
const keys = [
  "rol",
  "rolNombre",
  "permisos",
  "modalidad",
  "tipoAtencion",
  "tipoNombre",
  "nichoEmoji",
  "nichoTema",
  "colorPrimario",
  "diseno",
  "aparienciaVersion",
  "modulosVisibles",
  "ordenModulos",
] as const;
export default function VisualSync({
  session,
  onUpdate,
}: {
  session: Session;
  onUpdate: (s: Session) => void;
}) {
  const dirty = useDirty()?.dirty ?? false;
  const current = useRef(session),
    pending = useRef<Session | null>(null),
    isDirty = useRef(dirty);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    current.current = session;
  }, [session]);
  useEffect(() => {
    isDirty.current = dirty;
    if (!dirty && pending.current) {
      const next = pending.current;
      pending.current = null;
      setWaiting(false);
      onUpdate(next);
    }
  }, [dirty, onUpdate]);
  useEffect(() => {
    if (session.rol === "SUPERADMIN") return;
    let alive = true,
      busy = false;
    async function check() {
      if (busy || !alive) return;
      busy = true;
      try {
        const next = await api<Session>("/auth/visualizacion");
        if (
          !alive ||
          next.id !== current.current.id ||
          next.empresaId !== current.current.empresaId
        )
          return;
        const patch = Object.fromEntries(keys.map((k) => [k, next[k]]));
        const merged = { ...current.current, ...patch } as Session;
        if (
          keys.every(
            (k) =>
              JSON.stringify(next[k]) === JSON.stringify(current.current[k]),
          )
        ) {
          pending.current = null;
          setWaiting(false);
          return;
        }
        if (isDirty.current) {
          pending.current = merged;
          setWaiting(true);
        } else {
          pending.current = null;
          setWaiting(false);
          onUpdate(merged);
        }
      } catch {
        /* Session revocation and membership blocking are handled centrally. */
      } finally {
        busy = false;
      }
    }
    const timer = window.setInterval(() => void check(), 30000);
    const refresh = () => void check();
    window.addEventListener("focus", refresh);
    window.addEventListener("visual-updated", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("visual-updated", refresh);
    };
  }, [session.id, session.rol, onUpdate]);
  return waiting ? (
    <p className="notice" role="status">
      El administrador actualizó la visualización. Guarda o descarta tus cambios
      pendientes para aplicarla. Los permisos del servidor ya están
      actualizados.
    </p>
  ) : null;
}
