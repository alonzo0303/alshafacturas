import { useState } from "react";
import { api, type Empresa, type Session } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, Form, PageTitle, ErrorNotice } from "../components/ui";
import Actividades from "./Actividades";
import Cajas from "./Cajas";
import Rendimiento from "./Rendimiento";
import Auditoria from "./Auditoria";
export function ConfiguracionOperativa({ empresaId }: { empresaId: number }) {
  const { data, error, refresh } = useData(
    () =>
      api<{
        preparacion_habilitada: boolean;
        rendimiento_modo: string;
        caja_obligatoria: boolean;
      }>(`/operacion/configuracion?empresaId=${empresaId}`),
    null,
  );
  return (
    <section className="surface">
      <h2>Opciones operativas del negocio</h2>
      <ErrorNotice message={error} />
      {data && (
        <Form
          key={JSON.stringify(data)}
          label="Guardar opciones operativas"
          onSave={(d) =>
            api(`/operacion/configuracion?empresaId=${empresaId}`, "PUT", {
              preparacionHabilitada: d.get("preparacion") === "on",
              cajaObligatoria: d.get("caja") === "on",
              rendimientoModo: d.get("modo"),
            })
          }
          onDone={() => void refresh()}
        >
          <label className="check">
            <input
              name="preparacion"
              type="checkbox"
              defaultChecked={data.preparacion_habilitada}
            />
            Habilitar hojas de preparación antes de cobrar
          </label>
          <label className="check">
            <input
              name="caja"
              type="checkbox"
              defaultChecked={data.caja_obligatoria}
            />
            Exigir caja abierta para vender
          </label>
          <Field label="Rendimiento del negocio">
            <select name="modo" defaultValue={data.rendimiento_modo}>
              <option value="AMBOS">Comercio y servicios</option>
              <option value="COMERCIO">Solo comercio</option>
              <option value="SERVICIOS">Solo servicios</option>
            </select>
          </Field>
          <p className="hint">
            La hoja de preparación es interna; no sustituye una guía de remisión
            electrónica. Las opciones se aplican en las nuevas peticiones;
            recarga la sesión del negocio para actualizar su menú.
          </p>
        </Form>
      )}
    </section>
  );
}
function Locales({
  empresaId,
  session,
  vista,
}: {
  empresaId: number;
  session: Session;
  vista: string;
}) {
  const { data, error } = useData(
    () =>
      api<{ id: number; nombre: string }[]>(`/locales?empresaId=${empresaId}`),
    [],
  );
  const [local, setLocal] = useState("");
  const query = `?empresaId=${empresaId}&localId=${local}`;
  return (
    <>
      <ErrorNotice message={error} />
      <section className="surface">
        <Field label="Local del control operativo">
          <select value={local} onChange={(e) => setLocal(e.target.value)}>
            <option value="">Selecciona un local</option>
            {data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </Field>
      </section>
      {local &&
        (vista === "actividades" ? (
          <Actividades key={query} query={query} session={session} />
        ) : vista === "cajas" ? (
          <Cajas key={query} session={session} query={query} />
        ) : (
          <Rendimiento key={query} query={query} />
        ))}
    </>
  );
}
export default function ControlAdmin({ session }: { session: Session }) {
  const empresas = useData(() => api<Empresa[]>("/empresas"), []);
  const [empresa, setEmpresa] = useState(""),
    [vista, setVista] = useState("config");
  return (
    <>
      <PageTitle
        title="Control operativo"
        description="Configuración, cajas, rendimiento y auditoría de las empresas."
      />
      <ErrorNotice message={empresas.error} />
      <section className="surface">
        <div className="form-grid">
          <Field label="Empresa del control operativo">
            <select
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            >
              <option value="">Selecciona una empresa</option>
              {empresas.data
                .filter((e) => e.ruc !== "00000000000")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    #{e.id} · {e.razonSocial}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Vista del control operativo">
            <select value={vista} onChange={(e) => setVista(e.target.value)}>
              <option value="config">Configuración</option>
              <option value="cajas">Cajas y cierres</option>
              <option value="rendimiento">Rendimiento</option>
              <option value="actividades">Actividades del local</option>
              <option value="auditoria">Auditoría</option>
            </select>
          </Field>
        </div>
      </section>
      {empresa &&
        (vista === "config" ? (
          <ConfiguracionOperativa key={empresa} empresaId={Number(empresa)} />
        ) : vista === "auditoria" ? (
          <Auditoria key={empresa} query={`?empresaId=${empresa}`} />
        ) : (
          <Locales
            key={empresa + vista}
            empresaId={Number(empresa)}
            session={session}
            vista={vista}
          />
        ))}
    </>
  );
}
