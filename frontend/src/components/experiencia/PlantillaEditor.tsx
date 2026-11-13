import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { useUnsaved } from "../../lib/dirty";
import type { Definicion, PlantillaPerfil } from "../../lib/experiencia";
import { Field, Form, Modal } from "../ui";
import DefinicionEditor from "./DefinicionEditor";
import { nuevaMetrica } from "../../lib/experiencia";
export default function PlantillaEditor({
  initial,
  empresaId,
  onClose,
  onDone,
}: {
  initial?: PlantillaPerfil;
  empresaId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const version = initial?.tipo === "PERSONALIZADA";
  const [definition, setDefinition] = useState<Definicion>(() =>
    initial
      ? structuredClone(initial.definicion)
      : { metricas: [nuevaMetrica()], flujos: [] },
  );
  const [baseline] = useState(() => JSON.stringify(definition));
  const key = useRef(crypto.randomUUID()),
    code = useRef(
      version
        ? initial!.codigo
        : "P_" +
            crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
    );
  const [global, setGlobal] = useState(
    version ? initial!.empresa_propietaria_id === null : empresaId === null,
  );
  useUnsaved(JSON.stringify(definition) !== baseline);
  return (
    <Modal
      title={
        version
          ? "Publicar nueva versión de plantilla"
          : "Crear plantilla de rendimiento"
      }
      onClose={onClose}
    >
      <p>
        Publicar no cambia ninguna asignación. Después podrás aplicar la versión
        al negocio o sucursal que corresponda.
      </p>
      <Form
        label="Publicar plantilla"
        onSave={(d) =>
          api("/experiencia/plantillas", "POST", {
            idempotencia: key.current,
            baseId: version ? initial!.id : null,
            empresaPropietariaId: version
              ? initial!.empresa_propietaria_id
              : global
                ? null
                : empresaId,
            codigo: code.current,
            nombre: d.get("nombre"),
            rubro: d.get("rubro"),
            definicion: definition,
          })
        }
        onDone={onDone}
      >
        <div className="form-grid">
          <Field label="Nombre de la plantilla de rendimiento">
            <input
              name="nombre"
              required
              maxLength={100}
              defaultValue={initial?.nombre || ""}
            />
          </Field>
          <Field label="Rubro de referencia de la plantilla">
            <input
              name="rubro"
              required
              maxLength={100}
              defaultValue={initial?.rubro || ""}
            />
          </Field>
        </div>
        {!version && empresaId !== null && (
          <label className="check">
            <input
              type="checkbox"
              checked={global}
              onChange={(e) => setGlobal(e.target.checked)}
            />
            Disponible para todos los negocios
          </label>
        )}
        <DefinicionEditor value={definition} onChange={setDefinition} />
      </Form>
    </Modal>
  );
}
