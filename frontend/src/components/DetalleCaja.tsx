import { useState } from "react";
import { api, date, money } from "../lib/api";
import type { Caja } from "../lib/cajas";
import { Field, Form, Modal, Table } from "./ui";
export default function DetalleCaja({
  caja,
  query,
  onClose,
  onChanged,
}: {
  caja: Caja;
  query: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [actual, setActual] = useState(caja),
    [contado, setContado] = useState("");
  const esperadoCentimos =
    Math.round(Number(actual.fondo) * 100) +
    Math.round(
      Number(
        actual.medios?.find((m) => m.metodo_pago === "EFECTIVO")?.total ?? 0,
      ) * 100,
    );
  const faltante =
    contado !== "" && Math.round(Number(contado) * 100) < esperadoCentimos;
  return (
    <Modal title={`Caja #${actual.id}`} onClose={onClose}>
      <p>
        Responsable: <strong>{actual.usuario_nombre}</strong> · Fondo:{" "}
        {money(actual.fondo)}
      </p>
      <p>Abrió: {actual.abierto_nombre || actual.usuario_nombre}</p>
      <Table headers={["Medio de pago", "Ventas", "Total"]}>
        {actual.medios?.map((m) => (
          <tr key={m.metodo_pago}>
            <td>{m.metodo_pago}</td>
            <td>{m.ventas}</td>
            <td>{money(m.total)}</td>
          </tr>
        ))}
      </Table>
      {actual.estado === "ABIERTA" ? (
        <Form
          label="Confirmar cierre de caja"
          onSave={(d) =>
            api(`/cajas/${actual.id}/cerrar${query}`, "POST", {
              efectivoContado: Number(d.get("efectivo")),
              comentario: d.get("comentario"),
            })
          }
          onDone={() => {
            onChanged();
            onClose();
          }}
        >
          <p>
            El efectivo esperado es {money(esperadoCentimos / 100)}: fondo
            inicial más ventas en efectivo confirmadas. No se incluyen retiros
            ni gastos de caja en esta versión.
          </p>
          <Field label="Efectivo contado al cierre (S/)">
            <input
              name="efectivo"
              type="number"
              min="0"
              max="999999999999.99"
              step="0.01"
              required
              onInput={(e) => setContado(e.currentTarget.value)}
            />
          </Field>
          <Field label="Comentario del cierre">
            <textarea
              name="comentario"
              maxLength={1000}
              required={faltante}
              rows={3}
              placeholder="Explica el motivo de la diferencia o agrega una observación"
            />
          </Field>
          <p className="hint" role={faltante ? "status" : undefined}>
            {faltante
              ? `Faltan ${money((esperadoCentimos - Math.round(Number(contado) * 100)) / 100)}. El comentario es obligatorio.`
              : "El comentario es obligatorio si el efectivo contado es menor al esperado; en otro caso es opcional."}
          </p>
        </Form>
      ) : (
        <>
          <p>
            Cerró: {actual.cerrado_nombre} ·{" "}
            {actual.cerrada && date(actual.cerrada)}
          </p>
          <p>Efectivo esperado: {money(actual.efectivo_esperado || 0)}</p>
          <p>Efectivo contado: {money(actual.efectivo_contado || 0)}</p>
          <p>
            Diferencia: <strong>{money(actual.diferencia || 0)}</strong>
          </p>
          {actual.comentario_cierre ? (
            <>
              <h3>Comentario del cierre</h3>
              <p className="cash-close-comment">{actual.comentario_cierre}</p>
              {actual.comentado_nombre && (
                <p className="hint">
                  Registrado por {actual.comentado_nombre}
                  {actual.comentado_en && ` · ${date(actual.comentado_en)}`}
                </p>
              )}
            </>
          ) : (
            <Form
              label="Guardar comentario del cierre"
              onSave={async (d) =>
                setActual(
                  await api<Caja>(
                    `/cajas/${actual.id}/comentario${query}`,
                    "PATCH",
                    { comentario: d.get("comentario") },
                  ),
                )
              }
              onDone={onChanged}
            >
              <p>
                Este cierre no tiene comentario registrado. Puedes añadirlo una
                sola vez; los importes y el arqueo se conservan.
              </p>
              <Field label="Comentario del cierre">
                <textarea
                  name="comentario"
                  rows={3}
                  maxLength={1000}
                  required
                />
              </Field>
            </Form>
          )}
        </>
      )}
    </Modal>
  );
}
