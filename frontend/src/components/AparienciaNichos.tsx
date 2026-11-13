import { useState } from "react";
import { api } from "../lib/api";
import { Field, Form, Modal } from "./ui";
type Tipo = { codigo: string; nombre: string; emoji?: string; tema?: string };
export default function AparienciaNichos({
  tipos,
  onUpdated,
}: {
  tipos: Tipo[];
  onUpdated: () => void;
}) {
  const [selected, setSelected] = useState<Tipo | null>(null);
  return (
    <>
      <div className="row-actions">
        {tipos.map((t) => (
          <button type="button" key={t.codigo} onClick={() => setSelected(t)}>
            Editar apariencia: {t.nombre}
          </button>
        ))}
      </div>
      {selected && (
        <Modal
          title={`Apariencia de ${selected.nombre}`}
          onClose={() => setSelected(null)}
        >
          <Form
            label="Guardar apariencia del nicho"
            onSave={(d) =>
              api(
                `/tipos-atencion/${selected.codigo}`,
                "PUT",
                Object.fromEntries(d),
              )
            }
            onDone={() => {
              setSelected(null);
              onUpdated();
            }}
          >
            <Field label="Nombre del nicho">
              <input
                name="nombre"
                maxLength={100}
                defaultValue={selected.nombre}
                required
              />
            </Field>
            <Field label="Emoji del nicho a editar">
              <input
                name="emoji"
                maxLength={16}
                defaultValue={selected.emoji || "🛎️"}
              />
            </Field>
            <Field label="Tema del nicho a editar">
              <select name="tema" defaultValue={selected.tema || "OTRO"}>
                <option value="BARBERIA">Barbería</option>
                <option value="SPA">Spa</option>
                <option value="RESTAURANTE">Restaurante</option>
                <option value="COMERCIO">Comercio</option>
                <option value="OTRO">Atención general</option>
              </select>
            </Field>
            <p>
              Los usuarios verán los cambios al recargar su sesión. Los temas
              conservan la identidad de Alsha Group.
            </p>
          </Form>
        </Modal>
      )}
    </>
  );
}
