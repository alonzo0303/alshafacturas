import { useEffect, useRef, useState } from "react";
import { api, type Session } from "./api";
import { useDirty } from "./dirty";
type Estado = {
  venceHoy: boolean;
  vence: string | null;
  fechaActual: string;
  instruccionesPago: string;
  cajas: {
    id: number;
    local_id: number;
    local_nombre: string;
    fondo: number;
  }[];
};
type Aviso = { tipo: "ENTRADA" | "SALIDA" | "INTENTO"; estado: Estado };
export type SesionAvisosProps = {
  session: Session;
  onLogout: () => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
};
export function useAvisosSesion({
  session,
  onLogout,
  disabled,
  onBusyChange,
}: SesionAvisosProps) {
  const draft = useDirty();
  const [aviso, setAviso] = useState<Aviso | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const data = useRef<Estado | null>(null),
    pending = useRef<Aviso | null>(null),
    seen = useRef(new Set<string>()),
    active = useRef(false),
    dirty = useRef(false);
  useEffect(() => {
    dirty.current = !!draft?.dirty;
  }, [draft?.dirty]);
  useEffect(() => {
    if (session.rol === "SUPERADMIN") {
      onBusyChange(false);
      return;
    }
    let live = true,
      inflight = false,
      lastIntent = 0;
    const queue = (next: Aviso) => {
      pending.current = next;
      onBusyChange(true);
    };
    async function refresh() {
      if (inflight) return;
      inflight = true;
      try {
        const state = await api<Estado>("/sesion/recordatorios");
        if (!live) return;
        data.current = state;
        if (state.venceHoy && !seen.current.has(state.fechaActual)) {
          seen.current.add(state.fechaActual);
          if (!active.current && !pending.current)
            queue({ tipo: "ENTRADA", estado: state });
        }
      } catch {
        /* Session and subscription blocks are handled by the API transport. */
      } finally {
        inflight = false;
        if (live && !active.current && !pending.current) onBusyChange(false);
      }
    }
    onBusyChange(true);
    void refresh();
    const show = window.setInterval(() => {
      if (
        !pending.current ||
        active.current ||
        document.querySelector('dialog[open],form[data-saving="true"]')
      )
        return;
      const next = pending.current;
      pending.current = null;
      active.current = true;
      setAviso(next);
    }, 150);
    const timer = window.setInterval(() => void refresh(), 60000);
    const focus = () => void refresh();
    const leave = (e: BeforeUnloadEvent) => {
      if (data.current?.venceHoy || data.current?.cajas.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const intent = (e: MouseEvent) => {
      const state = data.current;
      if (
        e.relatedTarget !== null ||
        e.clientY > 0 ||
        active.current ||
        pending.current ||
        dirty.current ||
        document.querySelector("dialog[open]") ||
        Date.now() - lastIntent < 10000 ||
        !state ||
        (!state.venceHoy && !state.cajas.length)
      )
        return;
      lastIntent = Date.now();
      queue({ tipo: "INTENTO", estado: state });
    };
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) {
        seen.current.clear();
        void refresh();
      }
    };
    window.addEventListener("pageshow", restored);
    window.addEventListener("focus", focus);
    window.addEventListener("caja-updated", focus);
    window.addEventListener("beforeunload", leave);
    document.addEventListener("mouseout", intent);
    return () => {
      live = false;
      clearInterval(show);
      clearInterval(timer);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("focus", focus);
      window.removeEventListener("caja-updated", focus);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("mouseout", intent);
    };
  }, [session.id, session.rol, onBusyChange]);
  const close = () => {
    active.current = false;
    setAviso(null);
    onBusyChange(false);
  };
  const logout = () => (draft ? draft.confirm(onLogout) : onLogout());
  async function salir() {
    if (busy || disabled) return;
    if (session.rol === "SUPERADMIN") {
      logout();
      return;
    }
    setBusy(true);
    setError("");
    onBusyChange(true);
    try {
      const state = await api<Estado>("/sesion/recordatorios");
      data.current = state;
      if (state.venceHoy || state.cajas.length) {
        pending.current = null;
        active.current = true;
        setAviso({ tipo: "SALIDA", estado: state });
      } else {
        onBusyChange(false);
        logout();
      }
    } catch (e) {
      setError((e as Error).message);
      onBusyChange(false);
    } finally {
      setBusy(false);
    }
  }
  return { aviso, busy, error, close, salir };
}
