import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../lib/useData";
import { useUnsaved } from "../lib/dirty";
import { moduleLabels, type VisualConfig } from "../lib/visual";
import { ErrorNotice, Field } from "./ui";
function Editor({ initial, path }: { initial: VisualConfig; path: string }) {
  const [value, setValue] = useState(initial),
    [saved, setSaved] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const types = useData(
    () => api<{ codigo: string; nombre: string }[]>("/tipos-atencion"),
    [],
  );
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  useUnsaved(dirty);
  function move(index: number, delta: number) {
    setValue((v) => {
      const order = [...v.ordenModulos];
      [order[index], order[index + delta]] = [
        order[index + delta],
        order[index],
      ];
      return { ...v, ordenModulos: order };
    });
  }
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const next = await api<VisualConfig>(path, "PUT", value);
          setSaved(next);
          setValue(next);
          setMessage("Configuración guardada para todo el equipo.");
          window.dispatchEvent(new Event("visual-updated"));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorNotice message={error || types.error} />
      <p>
        El administrador y el personal comparten apariencia y orden. Cada
        persona conserva únicamente los módulos y datos autorizados por su rol.
        Los cambios se aplican al equipo sin borrar formularios pendientes.
      </p>
      <fieldset disabled={busy}>
        <legend>Apariencia del negocio</legend>
        <div className="form-grid">
          <Field label="Modalidad del negocio">
            <select
              value={value.modalidad}
              onChange={(e) => {
                const mode = e.target.value as VisualConfig["modalidad"];
                setValue({
                  ...value,
                  modalidad: mode,
                  tipoAtencion:
                    mode === "ATENCION"
                      ? (types.data[0]?.codigo ?? null)
                      : null,
                });
              }}
            >
              <option value="COMERCIO">Comercio</option>
              <option value="ATENCION">Atención y servicios</option>
            </select>
          </Field>
          {value.modalidad === "ATENCION" && (
            <Field label="Tipo de atención del negocio">
              <select
                required
                value={value.tipoAtencion ?? ""}
                onChange={(e) =>
                  setValue({ ...value, tipoAtencion: e.target.value })
                }
              >
                <option value="">Selecciona un tipo</option>
                {types.data.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Distribución">
            <select
              value={value.diseno}
              onChange={(e) =>
                setValue({
                  ...value,
                  diseno: e.target.value as VisualConfig["diseno"],
                })
              }
            >
              <option value="AMPLIO">Amplia</option>
              <option value="COMPACTO">Compacta</option>
            </select>
          </Field>
          <Field label="Color principal">
            <input
              aria-label="Color principal"
              type="color"
              value={value.colorPrimario ?? "#452179"}
              onChange={(e) =>
                setValue({ ...value, colorPrimario: e.target.value })
              }
            />
            <button
              type="button"
              onClick={() => setValue({ ...value, colorPrimario: null })}
            >
              Usar color del rubro
            </button>
          </Field>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Módulos visibles y orden del menú</legend>
        <p className="hint">
          Ocultar un módulo también bloquea sus acciones en el servidor. La
          gestión de personal, roles y configuración permanece disponible para
          el administrador.
        </p>
        <ol className="visual-modules">
          {value.ordenModulos.map((m, i) => (
            <li key={m}>
              <label>
                <input
                  type="checkbox"
                  checked={value.modulosVisibles.includes(m)}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      modulosVisibles: e.target.checked
                        ? [...value.modulosVisibles, m]
                        : value.modulosVisibles.filter((x) => x !== m),
                    })
                  }
                />
                {moduleLabels[m]}
              </label>
              <span>
                <button
                  type="button"
                  disabled={!i}
                  aria-label={`Subir ${moduleLabels[m]}`}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === value.ordenModulos.length - 1}
                  aria-label={`Bajar ${moduleLabels[m]}`}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </fieldset>
      <p className="hint">
        Vista del administrador: módulos habilitados y gestión del negocio.
        Vista del personal: el mismo diseño, con los módulos permitidos y sus
        operaciones propias o asignadas.
      </p>
      <button className="primary" disabled={busy || !dirty}>
        {busy ? "Guardando…" : "Guardar apariencia del negocio"}
      </button>
      <span role="status">{message}</span>
    </form>
  );
}
export default function VisualNegocio({ empresaId }: { empresaId?: number }) {
  const path =
    "/visualizacion-negocio" + (empresaId ? `?empresaId=${empresaId}` : "");
  const data = useData(() => api<VisualConfig>(path), null);
  return (
    <section className="surface">
      <h2>Visualización del negocio y su personal</h2>
      <ErrorNotice message={data.error} />
      {data.loading ? (
        <p role="status">Cargando apariencia…</p>
      ) : (
        data.data && <Editor key={path} initial={data.data} path={path} />
      )}
    </section>
  );
}
