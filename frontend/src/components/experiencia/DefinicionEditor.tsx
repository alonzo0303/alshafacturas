import type { Definicion, Flujo, Metrica } from "../../lib/experiencia";
import {
  operaciones,
  nuevaMetrica,
  nuevoFlujo,
  editorKey,
} from "../../lib/experiencia";
import { Field } from "../ui";
export default function DefinicionEditor({
  value,
  onChange,
}: {
  value: Definicion;
  onChange: (v: Definicion) => void;
}) {
  const metric = (i: number, patch: Partial<Metrica>) =>
    onChange({
      ...value,
      metricas: value.metricas.map((m, n) =>
        n === i ? { ...m, ...patch } : m,
      ),
    });
  const flow = (i: number, patch: Partial<Flujo>) =>
    onChange({
      ...value,
      flujos: value.flujos.map((f, n) => (n === i ? { ...f, ...patch } : f)),
    });
  return (
    <>
      <h3>Métricas</h3>
      <p className="hint">
        Elige un cálculo disponible. Los tiempos usan registros reales; una meta
        no modifica las operaciones ni los permisos.
      </p>
      {value.metricas.map((m, i) => (
        <fieldset className="surface" key={m.clave}>
          <legend>Indicador {i + 1}</legend>
          <div className="form-grid">
            <Field label={`Nombre del indicador ${i + 1}`}>
              <input
                required
                maxLength={100}
                value={m.titulo}
                onChange={(e) => metric(i, { titulo: e.target.value })}
              />
            </Field>
            <Field label={`Cálculo del indicador ${i + 1}`}>
              <select
                value={m.operacion}
                onChange={(e) =>
                  metric(i, {
                    operacion: e.target.value,
                    flujoCodigo: null,
                    clase: null,
                  })
                }
              >
                {Object.entries(operaciones).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            {m.operacion.startsWith("ACTIVIDADES_") && (
              <>
                <Field label={`Flujo del indicador ${i + 1}`}>
                  <select
                    value={m.flujoCodigo || ""}
                    onChange={(e) =>
                      metric(i, { flujoCodigo: e.target.value || null })
                    }
                  >
                    <option value="">Todos los flujos</option>
                    {value.flujos.map((f) => (
                      <option value={f.codigo} key={f.codigo}>
                        {f.nombre || "Flujo sin nombre"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`Clase del indicador ${i + 1}`}>
                  <select
                    value={m.clase || ""}
                    onChange={(e) =>
                      metric(i, {
                        clase: (e.target.value || null) as Metrica["clase"],
                      })
                    }
                  >
                    <option value="">Todas las clases</option>
                    <option value="SERVICIO">Servicios</option>
                    <option value="LOGISTICA">Logística</option>
                    <option value="ATENCION">Atención</option>
                  </select>
                </Field>
              </>
            )}
            <Field label={`Meta del indicador ${i + 1} (opcional)`}>
              <input
                type="number"
                min="0"
                max="999999999.99"
                step="0.01"
                value={m.meta ?? ""}
                onChange={(e) =>
                  metric(i, {
                    meta: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={value.metricas.length <= 1}
            onClick={() =>
              onChange({
                ...value,
                metricas: value.metricas.filter((_, n) => n !== i),
              })
            }
          >
            Quitar indicador {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={value.metricas.length >= 12}
        onClick={() =>
          onChange({ ...value, metricas: [...value.metricas, nuevaMetrica()] })
        }
      >
        Agregar indicador
      </button>
      <h3>Flujos de trabajo</h3>
      <p className="hint">
        Las etapas avanzan en orden. La primera representa espera; el tiempo
        comienza al avanzar a la segunda y termina al llegar a la última. Las
        actividades ya creadas conservan sus etapas originales.
      </p>
      {value.flujos.map((f, i) => (
        <fieldset className="surface" key={f.codigo}>
          <legend>Flujo {i + 1}</legend>
          <div className="form-grid">
            <Field label={`Nombre del flujo ${i + 1}`}>
              <input
                required
                maxLength={100}
                value={f.nombre}
                onChange={(e) => flow(i, { nombre: e.target.value })}
              />
            </Field>
            <Field label={`Clase del flujo ${i + 1}`}>
              <select
                value={f.clase}
                onChange={(e) =>
                  flow(i, { clase: e.target.value as Flujo["clase"] })
                }
              >
                <option value="SERVICIO">Servicio</option>
                <option value="LOGISTICA">Logística</option>
                <option value="ATENCION">Atención</option>
              </select>
            </Field>
          </div>
          {f.etapas.map((s, j) => (
            <div className="section-toolbar" key={s.codigo}>
              <Field label={`Etapa ${j + 1} del flujo ${i + 1}`}>
                <input
                  required
                  maxLength={100}
                  value={s.nombre}
                  onChange={(e) =>
                    flow(i, {
                      etapas: f.etapas.map((t, n) =>
                        n === j ? { ...t, nombre: e.target.value } : t,
                      ),
                    })
                  }
                />
              </Field>
              <button
                type="button"
                disabled={f.etapas.length <= 3}
                onClick={() =>
                  flow(i, { etapas: f.etapas.filter((_, n) => n !== j) })
                }
              >
                Quitar etapa {j + 1} del flujo {i + 1}
              </button>
            </div>
          ))}
          <div className="form-actions">
            <button
              type="button"
              disabled={f.etapas.length >= 8}
              onClick={() =>
                flow(i, {
                  etapas: [
                    ...f.etapas.slice(0, -1),
                    { codigo: "E_" + editorKey().toUpperCase(), nombre: "" },
                    f.etapas.at(-1)!,
                  ],
                })
              }
            >
              Agregar etapa al flujo {i + 1}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  flujos: value.flujos.filter((_, n) => n !== i),
                  metricas: value.metricas.map((m) =>
                    m.flujoCodigo === f.codigo
                      ? { ...m, flujoCodigo: null }
                      : m,
                  ),
                })
              }
            >
              Quitar flujo {i + 1}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={value.flujos.length >= 10}
        onClick={() =>
          onChange({ ...value, flujos: [...value.flujos, nuevoFlujo()] })
        }
      >
        Agregar flujo
      </button>
    </>
  );
}
