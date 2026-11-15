import { useState } from "react";
import { api } from "../../lib/api";
import { useData } from "../../lib/useData";
import type { PerfilConfig, PlantillaPerfil } from "../../lib/experiencia";
import { Field, Form, ErrorNotice } from "../ui";
function Configurar({
  empresaId,
  localId,
  plantillas,
}: {
  empresaId: number;
  localId: string;
  plantillas: PlantillaPerfil[];
}) {
  const query =
    `?empresaId=${empresaId}` + (localId ? `&localId=${localId}` : "");
  const current = useData(
    () => api<PerfilConfig>("/experiencia/configuracion" + query),
    null,
  );
  const [modo, setModo] = useState<PerfilConfig["modo"] | "">(""),
    [error, setError] = useState("");
  const selected = modo || current.data?.modo || "GENERAL";
  return (
    <section className="surface">
      <h2>Perfil de rendimiento</h2>
      <ErrorNotice message={error || current.error} />
      {current.loading ? (
        <p role="status">Consultando perfil…</p>
      ) : (
        current.data && (
          <>
            <p>
              Actualmente:{" "}
              <strong>
                {current.data.plantilla.nombre} · v
                {current.data.plantilla.version}
              </strong>{" "}
              ·{" "}
              {current.data.heredado
                ? "Configuración del negocio"
                : "Configuración de la sucursal"}
            </p>
            <Form
              key={current.data.plantilla.id + "-" + current.data.modo}
              label="Guardar perfil de rendimiento"
              onSave={(d) =>
                api("/experiencia/configuracion" + query, "PUT", {
                  modo: selected,
                  plantillaId:
                    selected === "GENERAL" ? null : Number(d.get("plantilla")),
                })
              }
              onDone={() => void current.refresh()}
            >
              <Field label="Tipo de perfil de rendimiento">
                <select
                  value={selected}
                  onChange={(e) =>
                    setModo(e.target.value as PerfilConfig["modo"])
                  }
                >
                  <option value="GENERAL">General</option>
                  <option value="ESPECIFICO">Específico por rubro</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </Field>
              {selected !== "GENERAL" && (
                <Field label="Versión de plantilla a asignar">
                  <select
                    name="plantilla"
                    required
                    defaultValue={current.data.plantilla.id}
                  >
                    <option value="">Selecciona una plantilla</option>
                    {plantillas
                      .filter((p) =>
                        selected === "ESPECIFICO"
                          ? p.tipo === "BASE" && p.codigo !== "GENERAL"
                          : p.tipo === "PERSONALIZADA",
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} · v{p.version} · {p.rubro}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <p className="hint">
                Se conserva el historial. Elegir perfil no cambia el plan, los
                permisos ni la visualización individual del usuario.
              </p>
            </Form>
            {localId && (
              <button
                className="review-subscriptions"
                onClick={async () => {
                  setError("");
                  try {
                    await api("/experiencia/configuracion" + query, "DELETE");
                    await current.refresh();
                    setModo("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Usar perfil del negocio
              </button>
            )}
          </>
        )
      )}
    </section>
  );
}
export default function PerfilAsignacion({
  empresaId,
  plantillas,
}: {
  empresaId: number;
  plantillas: PlantillaPerfil[];
}) {
  const locales = useData(
    () =>
      api<{ id: number; nombre: string }[]>(`/locales?empresaId=${empresaId}`),
    [],
  );
  const [local, setLocal] = useState("");
  return (
    <>
      <ErrorNotice message={locales.error} />
      <section className="surface">
        <Field label="Ámbito del perfil">
          <select value={local} onChange={(e) => setLocal(e.target.value)}>
            <option value="">Todo el negocio (perfil heredable)</option>
            {locales.data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </Field>
      </section>
      <Configurar
        key={local}
        empresaId={empresaId}
        localId={local}
        plantillas={plantillas}
      />
    </>
  );
}
