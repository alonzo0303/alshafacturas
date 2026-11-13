import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type Session } from "../../lib/api";
import { useDirty } from "../../lib/dirty";
import { Modal } from "../ui";
type Trigger = "POST_LOGIN" | "PAGE_OPEN" | "EXIT_INTENT";
type Pending = { trigger: Trigger; pagina: string };
type Notice = {
  entregaId: string;
  titulo: string;
  mensaje: string;
  accion: string;
  prioridad: number;
  version: number;
};
function page(path: string) {
  if (path.endsWith("/rendimiento")) return "RENDIMIENTO";
  if (path.endsWith("/actividades")) return "ACTIVIDADES";
  if (path.endsWith("/mesas")) return "MESAS";
  if (path.endsWith("/servicios")) return "SERVICIOS";
  if (path.endsWith("/pos") || path.endsWith("/cobrar")) return "POS";
  if (path === "/panel" || path === "/atencion") return "RESUMEN";
  return "OTRA";
}
export default function ModalCoordinator({
  session,
  postLogin,
}: {
  session: Session;
  postLogin: boolean;
}) {
  const location = useLocation(),
    navigate = useNavigate(),
    draft = useDirty();
  const [active, setActive] = useState<Notice | null>(null),
    [busy, setBusy] = useState(false);
  const queue = useRef<Pending[]>([]),
    seen = useRef(new Set<string>()),
    started = useRef(false),
    inflight = useRef(false);
  const status = useRef({ dirty: false, pagina: "OTRA", active: false });
  useEffect(() => {
    status.current = {
      dirty: !!draft?.dirty,
      pagina: page(location.pathname),
      active: active !== null,
    };
  }, [draft?.dirty, location.pathname, active]);
  useEffect(() => {
    const key = "PAGE:" + location.key;
    if (!seen.current.has(key)) {
      seen.current.add(key);
      queue.current.push({
        trigger: "PAGE_OPEN",
        pagina: page(location.pathname),
      });
    }
    if (postLogin && !started.current) {
      started.current = true;
      queue.current.unshift({
        trigger: "POST_LOGIN",
        pagina: page(location.pathname),
      });
    }
  }, [location.key, location.pathname, postLogin]);
  useEffect(() => {
    let live = true;
    const exit = (event: MouseEvent) => {
      if (
        event.relatedTarget === null &&
        event.clientY <= 0 &&
        !status.current.dirty &&
        !seen.current.has("EXIT")
      ) {
        seen.current.add("EXIT");
        queue.current.push({
          trigger: "EXIT_INTENT",
          pagina: status.current.pagina,
        });
      }
    };
    const release = (id: string) =>
      api(`/experiencia/avisos/${id}/respuesta`, "POST", {
        estado: "LIBERAR",
      }).catch(() => {});
    const tick = () => {
      if (
        inflight.current ||
        status.current.active ||
        status.current.dirty ||
        document.querySelector('dialog[open],form[data-saving="true"]')
      )
        return;
      const next = queue.current.shift();
      if (!next) return;
      if (next.trigger === "PAGE_OPEN" && next.pagina !== status.current.pagina)
        return;
      inflight.current = true;
      void api<{ aviso: Notice | null }>(
        "/experiencia/avisos/reclamar",
        "POST",
        next,
      )
        .then(({ aviso }) => {
          if (!aviso) return;
          if (
            !live ||
            status.current.dirty ||
            document.querySelector('dialog[open],form[data-saving="true"]') ||
            (next.trigger === "PAGE_OPEN" &&
              next.pagina !== status.current.pagina)
          ) {
            void release(aviso.entregaId);
            return;
          }
          status.current.active = true;
          setActive(aviso);
        })
        .catch(() => {
          /* Un aviso informativo no bloquea la operación; el transporte global gestiona sesiones vencidas. */
        })
        .finally(() => {
          inflight.current = false;
        });
    };
    const timer = window.setInterval(tick, 350);
    document.addEventListener("mouseout", exit);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("mouseout", exit);
    };
  }, []);
  useEffect(() => {
    if (active)
      void api(`/experiencia/avisos/${active.entregaId}/respuesta`, "POST", {
        estado: "MOSTRADO",
      }).catch(() => {});
  }, [active]);
  const close = async (estado: string, action = false) => {
    if (!active || busy) return;
    setBusy(true);
    try {
      await api(`/experiencia/avisos/${active.entregaId}/respuesta`, "POST", {
        estado,
      });
    } catch {
      /* El aviso ya mostrado conserva su límite de frecuencia aunque falle registrar el cierre. */
    } finally {
      const target = active.accion;
      setActive(null);
      setBusy(false);
      if (action) {
        const prefix =
          session.modalidad === "ATENCION" ? "/atencion" : "/panel";
        const routes: Record<string, string> = {
          VER_RENDIMIENTO: "/rendimiento",
          VER_NOTIFICACIONES: "/notificaciones",
          VER_ACTIVIDADES: "/actividades",
        };
        if (routes[target]) void navigate(prefix + routes[target]);
      }
    }
  };
  if (!active) return null;
  const actions: Record<string, string> = {
    VER_RENDIMIENTO: "Ver rendimiento",
    VER_NOTIFICACIONES: "Ver opciones de pago",
    VER_ACTIVIDADES: "Ver actividades",
  };
  return (
    <Modal title={active.titulo} onClose={() => void close("CERRADO")}>
      <p className="payment-instructions">
        <span aria-hidden="true">{session.nichoEmoji || "🛎️"} </span>
        {active.mensaje}
      </p>
      <div className="form-actions">
        <button disabled={busy} onClick={() => void close("ACEPTADO")}>
          Entendido
        </button>
        {active.accion !== "CERRAR" && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => void close("ACCION", true)}
          >
            {actions[active.accion] || "Continuar"}
          </button>
        )}
      </div>
    </Modal>
  );
}
