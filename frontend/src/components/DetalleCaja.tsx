import { useRef, useState } from "react";
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
    [contado, setContado] = useState(""),
    [comentario, setComentario] = useState("");
  const movimientoClave = useRef(crypto.randomUUID());
  const esperadoCentimos = Math.round(
    Number(
      actual.saldo_esperado ??
        Number(actual.fondo) +
          Number(
            actual.medios?.find((m) => m.metodo_pago === "EFECTIVO")?.total ??
              0,
          ),
    ) * 100,
  );
  const descuadre =
    contado !== "" && Math.round(Number(contado) * 100) !== esperadoCentimos;
  const invalido =
    contado === "" ||
    !Number.isFinite(Number(contado)) ||
    Number(contado) < 0 ||
    Number(contado) > 999999999999.99 ||
    Math.abs(Number(contado) * 100 - Math.round(Number(contado) * 100)) >
      0.00001 ||
    (descuadre && !comentario.trim());
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
        <>
          <Form
            key={`cierre-${actual.movimientos?.length ?? 0}`}
            label="Confirmar cierre de caja"
            disabled={invalido}
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
              inicial más ventas e ingresos en efectivo, menos egresos
              registrados.
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
                onInput={(e) => setComentario(e.currentTarget.value)}
                required={descuadre}
                rows={3}
                placeholder="Explica el motivo de la diferencia o agrega una observación"
              />
            </Field>
            <p className="hint" role="status">
              {descuadre
                ? `Diferencia: ${money((Math.round(Number(contado) * 100) - esperadoCentimos) / 100)}. Justifica el faltante o sobrante para habilitar el cierre.`
                : "La justificación es obligatoria ante cualquier diferencia."}
            </p>
          </Form>
          <h3>Registrar movimiento de efectivo</h3>
          <Form
            label="Registrar movimiento"
            onSave={async (d) => {
              const result = await api<Caja>(
                `/cajas/${actual.id}/movimientos${query}`,
                "POST",
                {
                  tipo: d.get("tipo"),
                  importe: Number(d.get("importe")),
                  motivo: d.get("motivo"),
                  idempotencia: movimientoClave.current,
                },
              );
              setActual(result);
              movimientoClave.current = crypto.randomUUID();
              setContado("");
              setComentario("");
            }}
            onDone={onChanged}
          >
            <Field label="Tipo de movimiento">
              <select name="tipo">
                <option value="EGRESO">Egreso / retiro</option>
                <option value="INGRESO">Ingreso de efectivo</option>
              </select>
            </Field>
            <Field label="Importe del movimiento (S/)">
              <input
                name="importe"
                type="number"
                min="0.01"
                max="999999999999.99"
                step="0.01"
                required
              />
            </Field>
            <Field label="Motivo / Justificación del movimiento">
              <textarea name="motivo" maxLength={1000} required rows={3} />
            </Field>
          </Form>
        </>
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
      {!!actual.movimientos?.length && (
        <>
          <h3>Movimientos de efectivo</h3>
          <Table
            headers={["Tipo", "Importe", "Motivo", "Registró / Fecha y hora"]}
          >
            {actual.movimientos.map((m) => (
              <tr key={m.id}>
                <td>{m.tipo}</td>
                <td>{money(m.importe)}</td>
                <td className="cash-close-comment">{m.motivo}</td>
                <td>
                  {m.usuario_nombre}
                  <small>{date(m.fecha)}</small>
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Modal>
  );
}
