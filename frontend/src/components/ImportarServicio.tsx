import type { Plantilla } from "./ProductEditor";
import { api } from "../lib/api";
import { Field, Form } from "./ui";
export default function ImportarServicio({
  template,
  onDone,
}: {
  template: Plantilla;
  onDone: () => void;
}) {
  return (
    <Form
      label="Incorporar servicio"
      onSave={(d) =>
        api(`/catalogo-comun/${template.id}/incorporar`, "POST", {
          nombre: d.get("nombre"),
          precio: Number(d.get("precio")),
          minimo: 0,
          activo: true,
          categoria: template.rubro,
          marca: template.marca,
        })
      }
      onDone={onDone}
    >
      <Field label="Nombre del servicio a incorporar">
        <input
          name="nombre"
          defaultValue={template.nombre}
          required
          maxLength={200}
        />
      </Field>
      <Field label="Precio del servicio a incorporar (S/)">
        <input
          name="precio"
          type="number"
          min="0.01"
          max="999999999.99"
          step="0.01"
          required
        />
      </Field>
      <p>
        Plantilla de {template.rubro}. La duración de referencia es{" "}
        {template.duracion_minutos || 0} minutos. Define tu precio final; la
        plantilla no incluye precio ni stock.
      </p>
    </Form>
  );
}
