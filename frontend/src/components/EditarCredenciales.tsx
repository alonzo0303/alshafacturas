import { api, type Session } from "../lib/api";
import { Field, Form, Modal } from "./ui";
export default function EditarCredenciales({
  usuario,
  empresaId,
  onClose,
  onDone,
}: {
  usuario: Pick<Session, "id" | "nombre" | "correo"> & { activo?: boolean };
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
      {usuario.activo === false && (
        <p className="notice">
          Esta cuenta está desactivada. Cambiar la contraseña no la reactiva:
          utiliza Personal y accesos para habilitarla y comprobar su cupo.
        </p>
      )}
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
            autoComplete="off"
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
