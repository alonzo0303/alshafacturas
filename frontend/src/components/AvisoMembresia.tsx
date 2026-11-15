import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Aviso } from "../pages/Notificaciones";
export default function AvisoMembresia({ href }: { href: string }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  useEffect(() => {
    let mounted = true,
      generation = 0;
    const load = () => {
      const token = ++generation;
      void api<{ fechaActual: string; avisos: Aviso[] }>(
        "/notificaciones-suscripcion",
      )
        .then((data) => {
          if (mounted && token === generation)
            setAviso(
              data.avisos.find(
                (a) => !a.resuelto && a.fecha === data.fechaActual,
              ) || null,
            );
        })
        .catch(() => {
          /* El transporte global gestiona el vencimiento y la página conserva sus errores de operación. */
        });
    };
    load();
    const timer = window.setInterval(load, 15 * 60 * 1000);
    window.addEventListener("focus", load);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);
  if (!aviso) return null;
  return (
    <div className="notice" role="status">
      <strong>
        {aviso.dias_restantes === 0
          ? "Tu membresía vence hoy."
          : `Tu membresía vence en ${aviso.dias_restantes} días.`}
      </strong>{" "}
      <Link to={href}>Ver recordatorios y opciones de pago</Link>
    </div>
  );
}
