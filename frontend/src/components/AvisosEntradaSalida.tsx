import { useNavigate } from "react-router-dom";
import { money } from "../lib/api";
import { useDirty } from "../lib/dirty";
import { can } from "../lib/session";
import {
  useAvisosSesion,
  type SesionAvisosProps,
} from "../lib/useAvisosSesion";
import { ErrorNotice, Modal } from "./ui";
export default function AvisosEntradaSalida(props: SesionAvisosProps) {
  const { session, disabled } = props;
  const draft = useDirty(),
    navigate = useNavigate();
  const { aviso, busy, error, close, salir } = useAvisosSesion(props);
  const logout = () =>
    draft ? draft.confirm(props.onLogout) : props.onLogout();
  const cajaPath =
    session.modalidad === "ATENCION" ? "/atencion/cajas" : "/panel/cajas";
  return (
    <>
      <button disabled={disabled || busy} onClick={() => void salir()}>
        {disabled ? "Cerrando…" : busy ? "Comprobando…" : "Cerrar sesión"}
      </button>
      <ErrorNotice message={error} />
      {aviso && (
        <Modal
          title={
            aviso.estado.venceHoy
              ? "Tu membresía vence hoy"
              : "Recuerda cerrar tu caja"
          }
          onClose={close}
        >
          {aviso.estado.venceHoy && (
            <>
              <p>
                Tu membresía vence hoy,{" "}
                {aviso.estado.vence?.split("-").reverse().join("/")}, a las
                23:59 (hora de Perú). Regulariza el pago para continuar: después
                del vencimiento se bloqueará el acceso del jefe y de todo el
                personal.
              </p>
              <p>{aviso.estado.instruccionesPago}</p>
            </>
          )}
          {!!aviso.estado.cajas.length && (
            <>
              <p>
                Tienes cajas abiertas. Revisa el efectivo y realiza tu cierre
                antes de terminar tu turno.
              </p>
              <ul>
                {aviso.estado.cajas.map((c) => (
                  <li key={c.id}>
                    Caja #{c.id} · {c.local_nombre} · Fondo inicial{" "}
                    {money(c.fondo)}
                  </li>
                ))}
              </ul>
              <p className="hint">
                Salir de la sesión no cierra la caja ni registra un arqueo. Si
                está en otro local, selecciona ese local o solicita el cierre al
                administrador.
              </p>
            </>
          )}
          <div className="form-actions">
            {aviso.estado.cajas.some((c) => c.local_id === session.localId) &&
              can(session, "CAJA_GESTIONAR") && (
                <button
                  className="primary"
                  onClick={() => {
                    close();
                    draft?.confirm(() => navigate(cajaPath));
                  }}
                >
                  Revisar y cerrar mi caja
                </button>
              )}
            <button onClick={close}>
              {aviso.tipo === "ENTRADA" ? "Entendido" : "Seguir trabajando"}
            </button>
            {aviso.tipo === "SALIDA" && (
              <button
                onClick={() => {
                  close();
                  logout();
                }}
              >
                {aviso.estado.cajas.length
                  ? "Salir sin cerrar la caja"
                  : "Continuar y cerrar sesión"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
