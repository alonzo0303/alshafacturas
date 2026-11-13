import { useRef } from "react";
import { api } from "../../lib/api";
import { useData } from "../../lib/useData";
import type { PlantillaPerfil } from "../../lib/experiencia";
import { Field, Form, Modal, ErrorNotice } from "../ui";
export type Regla = {
  id: number;
  familia: string;
  version: number;
  empresa_id: number | null;
  local_id: number | null;
  perfil_familia: string | null;
  nombre: string;
  titulo: string;
  mensaje: string;
  disparadores: string[];
  paginas: string[];
  roles: string[];
  condicion: string;
  frecuencia: string;
  prioridad: number;
  accion: string;
  activa: boolean;
  desde: string | null;
  hasta: string | null;
};
const triggers = {
  POST_LOGIN: "Después de iniciar sesión",
  PAGE_OPEN: "Al abrir una página",
  EXIT_INTENT: "Intención de salida en escritorio",
};
const paginas = {
  RESUMEN: "Resumen / Inicio",
  RENDIMIENTO: "Rendimiento",
  SERVICIOS: "Servicios",
  MESAS: "Mesas",
  POS: "Punto de venta / Cobro",
  ACTIVIDADES: "Actividades",
  OTRA: "Otras páginas",
};
export default function ReglaEditor({
  initial,
  empresaId,
  plantillas,
  onClose,
  onDone,
}: {
  initial?: Regla;
  empresaId: number | null;
  plantillas: PlantillaPerfil[];
  onClose: () => void;
  onDone: () => void;
}) {
  const owner = initial ? initial.empresa_id : empresaId;
  const locales = useData(
    () =>
      owner
        ? api<{ id: number; nombre: string }[]>(`/locales?empresaId=${owner}`)
        : Promise.resolve([]),
    [],
  );
  const roles = useData(
    () =>
      owner
        ? api<{ roles: { codigo: string; nombre: string }[] }>(
            `/admin/personal/roles?empresaId=${owner}`,
          )
        : Promise.resolve({
            roles: [
              { codigo: "ADMIN", nombre: "Administrador" },
              { codigo: "VENDEDOR", nombre: "Vendedor" },
              { codigo: "ALMACENERO", nombre: "Almacenero" },
              { codigo: "COMPRAS", nombre: "Compras" },
            ],
          }),
    { roles: [] },
  );
  const idempotencia = useRef(crypto.randomUUID());
  const unique = [
    ...new Map(
      plantillas
        .filter(
          (p) =>
            p.empresa_propietaria_id === null ||
            p.empresa_propietaria_id === owner,
        )
        .map((p) => [p.familia, p]),
    ).values(),
  ];
  return (
    <Modal
      title={
        initial
          ? "Publicar nueva versión de aviso"
          : "Crear aviso personalizado"
      }
      onClose={onClose}
    >
      <ErrorNotice message={locales.error || roles.error} />
      <p>
        {owner
          ? "Este aviso se aplica al negocio seleccionado."
          : "Este aviso es global y podrá llegar a todos los negocios que cumplan sus condiciones."}{" "}
        No cambia permisos ni bloqueos de membresía.
      </p>
      <Form
        label="Publicar aviso"
        onSave={(d) =>
          api("/experiencia/reglas", "POST", {
            idempotencia: idempotencia.current,
            baseId: initial?.id || null,
            empresaId: owner,
            localId: d.get("localId") ? Number(d.get("localId")) : null,
            plantillaId: d.get("plantilla") ? Number(d.get("plantilla")) : null,
            nombre: String(d.get("titulo")).slice(0, 100),
            titulo: d.get("titulo"),
            mensaje: d.get("mensaje"),
            disparadores: d.getAll("trigger"),
            paginas: d.getAll("pagina"),
            roles: d.getAll("rol"),
            condicion: d.get("condicion"),
            frecuencia: d.get("frecuencia"),
            prioridad: Number(d.get("prioridad")),
            accion: d.get("accion"),
            activa: d.get("activa") === "on",
            desde: d.get("desde") || null,
            hasta: d.get("hasta") || null,
          })
        }
        onDone={onDone}
      >
        <Field label="Título del aviso">
          <input
            name="titulo"
            required
            maxLength={120}
            defaultValue={initial?.titulo}
          />
        </Field>
        <Field label="Mensaje del aviso">
          <textarea
            name="mensaje"
            required
            maxLength={1500}
            rows={4}
            defaultValue={initial?.mensaje}
          />
        </Field>
        <p className="hint">
          {
            "Variables: {{negocio}}, {{fechaVencimiento}}, {{diasRestantes}}, {{instruccionesPago}}. Se muestran como texto; no se admite código."
          }
        </p>
        {owner && (
          <Field label="Local destinatario">
            <select
              name="localId"
              defaultValue={initial?.local_id || ""}
              disabled={!!initial}
            >
              <option value="">Todos los locales del negocio</option>
              {locales.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}
        {initial && owner && (
          <input name="localId" type="hidden" value={initial.local_id || ""} />
        )}
        <Field label="Perfil destinatario">
          <select
            name="plantilla"
            defaultValue={
              unique.find((p) => p.familia === initial?.perfil_familia)?.id ||
              ""
            }
          >
            <option value="">Todos los perfiles</option>
            {unique.map((p) => (
              <option value={p.id} key={p.familia}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend>Cuándo mostrar el aviso</legend>
          <div className="permission-list">
            {Object.entries(triggers).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  name="trigger"
                  value={key}
                  defaultChecked={
                    initial
                      ? initial.disparadores.includes(key)
                      : key === "POST_LOGIN"
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Páginas destinatarias</legend>
          <div className="permission-list">
            {Object.entries(paginas).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  name="pagina"
                  value={key}
                  defaultChecked={initial?.paginas.includes(key)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="hint">
            Sin selección, cualquier página. Las páginas limitan apertura y
            salida; el login se evalúa al ingresar.
          </p>
        </fieldset>
        <fieldset>
          <legend>Destinatarios por rol</legend>
          <div className="permission-list">
            {[
              ...roles.data.roles,
              {
                codigo: "PERSONAL",
                nombre: "Todo el personal (excepto administrador)",
              },
            ].map((r) => (
              <label key={r.codigo}>
                <input
                  type="checkbox"
                  name="rol"
                  value={r.codigo}
                  defaultChecked={initial?.roles.includes(r.codigo)}
                />
                {r.nombre}
              </label>
            ))}
          </div>
          <p className="hint">
            Sin roles seleccionados, todos los usuarios del negocio. SuperAdmin
            no recibe estos avisos.
          </p>
        </fieldset>
        <div className="form-grid">
          <Field label="Condición del aviso">
            <select
              name="condicion"
              defaultValue={initial?.condicion || "SIEMPRE"}
            >
              <option value="SIEMPRE">Siempre que corresponda</option>
              <option value="SUSCRIPCION_POR_VENCER">
                Membresía por vencer (D-5 a D-0)
              </option>
            </select>
          </Field>
          <Field label="Frecuencia del aviso">
            <select
              name="frecuencia"
              defaultValue={initial?.frecuencia || "DIA"}
            >
              <option value="DIA">Una vez al día</option>
              <option value="SESION">Una vez por sesión</option>
              <option value="UNA_VEZ">Una vez por versión del aviso</option>
            </select>
          </Field>
          <Field label="Prioridad del aviso">
            <input
              name="prioridad"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={initial?.prioridad ?? 50}
            />
          </Field>
          <Field label="Botón de acción del aviso">
            <select name="accion" defaultValue={initial?.accion || "CERRAR"}>
              <option value="CERRAR">Solo Entendido</option>
              <option value="VER_RENDIMIENTO">Ver rendimiento</option>
              <option value="VER_NOTIFICACIONES">Ver opciones de pago</option>
              <option value="VER_ACTIVIDADES">Ver actividades</option>
            </select>
          </Field>
          <Field label="Aviso disponible desde">
            <input
              name="desde"
              type="date"
              defaultValue={initial?.desde?.slice(0, 10) || ""}
            />
          </Field>
          <Field label="Aviso disponible hasta">
            <input
              name="hasta"
              type="date"
              defaultValue={initial?.hasta?.slice(0, 10) || ""}
            />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            name="activa"
            defaultChecked={initial?.activa ?? true}
          />
          Aviso activo
        </label>
        <p className="hint">
          Se muestra como máximo un aviso informativo por sesión y espera a que
          no haya operaciones o formularios pendientes. Cerrar la pestaña solo
          admite la advertencia nativa cuando hay cambios sin guardar.
        </p>
      </Form>
    </Modal>
  );
}
