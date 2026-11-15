import { useState } from "react";
import { api, money } from "../lib/api";
import { useData } from "../lib/useData";
import { ErrorNotice, Field, Form, Modal, Table } from "./ui";
type Acceso = {
  id: number;
  nombre: string;
  habilitada: boolean;
  fondo_asignado: number | null;
  personalizado: boolean;
};
export default function CajaPersonal({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const data = useData(() => api<Acceso[]>("/cajas/personal"), []),
    [selected, setSelected] = useState<Acceso | null>(null);
  return (
    <section className="surface">
      <div className="section-toolbar">
        <h2>Caja del personal</h2>
        <button onClick={() => void data.refresh()}>
          Actualizar accesos de caja
        </button>
      </div>
      <p>
        Habilita Caja por persona en este local y asigna un fondo inicial si lo
        necesitas. El personal consulta y cierra sus propias cajas. El acceso
        debe estar habilitado también en los módulos del negocio.
      </p>
      <ErrorNotice message={data.error} />
      {data.loading ? (
        <p role="status">Cargando accesos…</p>
      ) : (
        <Table
          headers={[
            "Personal",
            "Acceso a Caja",
            "Fondo para próximas aperturas",
            "Acciones",
          ]}
        >
          {data.data.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td>
                {u.habilitada ? "Habilitado" : "Deshabilitado"}
                <small>
                  {u.personalizado
                    ? "Configuración por persona"
                    : "Según su rol"}
                </small>
              </td>
              <td>
                {u.fondo_asignado === null
                  ? "A elegir al abrir"
                  : money(u.fondo_asignado)}
              </td>
              <td>
                <button onClick={() => setSelected(u)}>
                  Configurar caja<span className="sr-only"> de {u.nombre}</span>
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {selected && (
        <Modal
          title={`Caja de ${selected.nombre}`}
          onClose={() => setSelected(null)}
        >
          <Form
            label="Guardar acceso de caja"
            onSave={(d) =>
              api(`/cajas/personal/${selected.id}`, "PUT", {
                habilitada: d.get("habilitada") === "on",
                fondoAsignado:
                  d.get("fondo") === "" ? null : Number(d.get("fondo")),
                abrirAhora: d.get("abrirAhora") === "on",
              })
            }
            onDone={() => {
              setSelected(null);
              void data.refresh();
              onChanged?.();
              window.dispatchEvent(new Event("caja-updated"));
              window.dispatchEvent(new Event("visual-updated"));
            }}
          >
            <label className="check">
              <input
                type="checkbox"
                name="habilitada"
                defaultChecked={selected.habilitada}
              />
              Habilitar Caja para esta persona
            </label>
            <Field label="Fondo asignado para caja (S/, opcional)">
              <input
                name="fondo"
                type="number"
                min="0"
                max="999999999.99"
                step="0.01"
                defaultValue={selected.fondo_asignado ?? ""}
              />
            </Field>
            <p className="hint">
              Vacío: la persona indica el fondo al abrir. Con un importe:
              utilizará exactamente el fondo fijado. Cambiarlo no modifica una
              caja ya abierta.
            </p>
            <label className="check">
              <input type="checkbox" name="abrirAhora" />
              Entregar el fondo y abrir su caja ahora
            </label>
            <p className="hint">
              Confirma esta opción después de entregar el efectivo. Se
              registrará tu nombre como quien abrió la caja; la persona
              seleccionada será responsable. Si ya tiene una abierta, debe
              cerrarse antes.
            </p>
          </Form>
        </Modal>
      )}
    </section>
  );
}
