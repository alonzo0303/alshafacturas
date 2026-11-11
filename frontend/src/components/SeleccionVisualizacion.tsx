import { useState } from "react";
import { api, type Session } from "../lib/api";
import { tiposAtencion } from "../lib/modalidades";
import { ErrorNotice, Field } from "./ui";
type Usuario = Session & { activo: boolean };

export default function SeleccionUsuario({
  usuario,
  empresaId,
  onSaved,
}: {
  usuario: Usuario;
  empresaId: number;
  onSaved: (usuario: Usuario) => void;
}) {
  const [modalidad, setModalidad] = useState(usuario.modalidad);
  const [tipo, setTipo] = useState<Session["tipoAtencion"]>(
    usuario.tipoAtencion,
  );
  const [guardado, setGuardado] = useState(usuario);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const diferente =
    modalidad !== guardado.modalidad || tipo !== guardado.tipoAtencion;
  return (
    <form
      className="surface form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !diferente) return;
        setBusy(true);
        setError("");
        setMensaje("");
        try {
          const actualizado = await api<Usuario>(
            `/admin/visualizaciones/${usuario.id}?empresaId=${empresaId}`,
            "PATCH",
            { modalidad, tipoAtencion: tipo },
          );
          setGuardado(actualizado);
          onSaved(actualizado);
          setMensaje(
            "Visualización guardada. Se aplica al recargar o iniciar sesión.",
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h3>{usuario.nombre}</h3>
        <p>{usuario.correo}</p>
        <small>
          Rol: {usuario.rol} · {usuario.activo ? "Activo" : "Inactivo"}
        </small>
      </div>
      <ErrorNotice message={error} />
      <fieldset disabled={busy}>
        <legend className="sr-only">Visualización de {usuario.nombre}</legend>
        <div className="form-grid">
          <Field label={`Modalidad de ${usuario.nombre}`}>
            <select
              value={modalidad}
              onChange={(e) => {
                const value = e.target.value as Session["modalidad"];
                setModalidad(value);
                setTipo(value === "COMERCIO" ? null : "BARBERIA");
                setMensaje("");
              }}
            >
              <option value="COMERCIO">Comercio</option>
              <option value="ATENCION">Atención y servicios</option>
            </select>
          </Field>
          {modalidad === "ATENCION" && (
            <Field label={`Tipo de atención de ${usuario.nombre}`}>
              <select
                value={tipo || ""}
                required
                onChange={(e) => {
                  setTipo(e.target.value as Session["tipoAtencion"]);
                  setMensaje("");
                }}
              >
                {Object.entries(tiposAtencion).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </fieldset>
      <div className="form-actions">
        <button className="primary" disabled={busy || !diferente}>
          {busy ? "Guardando…" : `Guardar visualización de ${usuario.nombre}`}
        </button>
        <span role="status">{mensaje}</span>
      </div>
    </form>
  );
}
