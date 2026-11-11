import { api, type Session } from "../lib/api";
import { Field, Form, Modal } from "./ui";
export default function EditarCredenciales({
  usuario,
  empresaId,
  onClose,
  onDone,
}: {
  usuario: Session;
  empresaId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal title={`Acceso de ${usuario.nombre}`} onClose={onClose}>
      <p>
        Se conserva la cuenta, su rol y sus datos. Cambiar el correo o
        contraseña cerrará sus sesiones anteriores.
      </p>
      <Form
        label="Guardar acceso"
        onSave={(d) =>
          api(
            `/admin/visualizaciones/${usuario.id}/credenciales?empresaId=${empresaId}`,
            "PATCH",
            { correo: d.get("correo"), password: d.get("password") || null },
          )
        }
        onDone={onDone}
      >
        <Field label="Nuevo correo">
          <input
            name="correo"
            type="email"
            defaultValue={usuario.correo}
            maxLength={150}
            required
          />
        </Field>
        <Field label="Nueva contraseña (opcional)">
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
        </Field>
        <p className="hint">
          Deja la contraseña vacía para conservarla. La contraseña actual nunca
          se muestra.
        </p>
      </Form>
    </Modal>
  );
}
