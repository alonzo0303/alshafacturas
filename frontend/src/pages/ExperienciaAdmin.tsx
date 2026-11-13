import { useState } from "react";
import { api, type Empresa } from "../lib/api";
import { useData } from "../lib/useData";
import type { PlantillaPerfil } from "../lib/experiencia";
import { PageTitle, Field, Table, ErrorNotice, Empty } from "../components/ui";
import PerfilAsignacion from "../components/experiencia/PerfilAsignacion";
import PlantillaEditor from "../components/experiencia/PlantillaEditor";
import ReglaEditor, { type Regla } from "../components/experiencia/ReglaEditor";
function Gestion({ empresaId }: { empresaId: number | null }) {
  const query = empresaId ? `?empresaId=${empresaId}` : "";
  const plantillas = useData(
    () => api<PlantillaPerfil[]>("/experiencia/plantillas" + query),
    [],
  );
  const avisos = useData(() => api<Regla[]>("/experiencia/reglas" + query), []);
  const [tab, setTab] = useState("asignacion"),
    [template, setTemplate] = useState<PlantillaPerfil | null | undefined>(),
    [rule, setRule] = useState<Regla | null | undefined>(),
    [mensaje, setMensaje] = useState("");
  return (
    <>
      <ErrorNotice message={plantillas.error || avisos.error} />
      <p role="status">{mensaje}</p>
      <section className="surface">
        <Field label="Configuración de experiencia">
          <select value={tab} onChange={(e) => setTab(e.target.value)}>
            <option value="asignacion">Asignar perfil al negocio/local</option>
            <option value="plantillas">Plantillas de rendimiento</option>
            <option value="avisos">Avisos y modales</option>
          </select>
        </Field>
      </section>
      {tab === "asignacion" ? (
        empresaId ? (
          <PerfilAsignacion
            empresaId={empresaId}
            plantillas={plantillas.data}
          />
        ) : (
          <Empty>
            Selecciona un negocio para asignarle su perfil. Puedes crear
            plantillas y avisos globales desde las otras opciones.
          </Empty>
        )
      ) : tab === "plantillas" ? (
        <section className="surface">
          <div className="section-toolbar">
            <h2>Plantillas publicadas</h2>
            <button className="primary" onClick={() => setTemplate(null)}>
              Crear plantilla personalizada
            </button>
          </div>
          <p className="hint">
            Cada versión conserva su definición. Personalizar una plantilla base
            crea una familia propia; publicar no la asigna automáticamente.
          </p>
          {plantillas.loading ? (
            <p role="status">Cargando plantillas…</p>
          ) : (
            <Table
              headers={[
                "Plantilla",
                "Rubro",
                "Versión",
                "Disponibilidad",
                "Acciones",
              ]}
            >
              {plantillas.data.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.rubro}</td>
                  <td>{p.version}</td>
                  <td>
                    {p.empresa_propietaria_id ? "Solo este negocio" : "Global"}
                  </td>
                  <td>
                    <button onClick={() => setTemplate(p)}>
                      {p.tipo === "BASE" ? "Personalizar" : "Nueva versión"}
                      <span className="sr-only">
                        {" "}
                        de {p.nombre} versión {p.version}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      ) : (
        <section className="surface">
          <div className="section-toolbar">
            <h2>Avisos configurados</h2>
            <button className="primary" onClick={() => setRule(null)}>
              Crear aviso personalizado
            </button>
          </div>
          {avisos.loading ? (
            <p role="status">Cargando avisos…</p>
          ) : (
            <Table
              headers={[
                "Aviso",
                "Ámbito",
                "Frecuencia",
                "Estado",
                "Versión",
                "Acciones",
              ]}
            >
              {avisos.data.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.titulo}
                    <small>
                      {a.disparadores
                        .map(
                          (t) =>
                            ({
                              POST_LOGIN: "Login",
                              PAGE_OPEN: "Página",
                              EXIT_INTENT: "Salida",
                            })[t] || t,
                        )
                        .join(" · ")}
                    </small>
                  </td>
                  <td>
                    {a.empresa_id ? "Negocio seleccionado" : "Global"}
                    {a.local_id ? " · Local específico" : ""}
                  </td>
                  <td>
                    {
                      {
                        DIA: "Diario",
                        SESION: "Por sesión",
                        UNA_VEZ: "Por versión",
                      }[a.frecuencia]
                    }
                  </td>
                  <td>{a.activa ? "Activo" : "Pausado"}</td>
                  <td>{a.version}</td>
                  <td>
                    <button onClick={() => setRule(a)}>
                      Editar aviso<span className="sr-only"> {a.titulo}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      )}
      {template !== undefined && (
        <PlantillaEditor
          initial={template || undefined}
          empresaId={empresaId}
          onClose={() => setTemplate(undefined)}
          onDone={() => {
            setTemplate(undefined);
            setMensaje(
              "Plantilla publicada. Asígnala explícitamente al negocio o sucursal.",
            );
            void plantillas.refresh();
          }}
        />
      )}
      {rule !== undefined && (
        <ReglaEditor
          initial={rule || undefined}
          empresaId={empresaId}
          plantillas={plantillas.data}
          onClose={() => setRule(undefined)}
          onDone={() => {
            setRule(undefined);
            setMensaje(
              "Aviso publicado. Las entregas anteriores se conservan.",
            );
            void avisos.refresh();
          }}
        />
      )}
    </>
  );
}
export default function ExperienciaAdmin() {
  const empresas = useData(() => api<Empresa[]>("/empresas"), []);
  const [empresa, setEmpresa] = useState("");
  return (
    <>
      <PageTitle
        title="Perfiles y avisos"
        description="Rendimiento por rubro, flujos de trabajo y modales con frecuencia controlada."
      />
      <ErrorNotice message={empresas.error} />
      <section className="surface">
        <Field label="Negocio de perfiles y avisos">
          <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">Configuración global</option>
            {empresas.data
              .filter((e) => e.ruc !== "00000000000")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} · {e.razonSocial}
                </option>
              ))}
          </select>
        </Field>
      </section>
      <Gestion key={empresa} empresaId={empresa ? Number(empresa) : null} />
    </>
  );
}
