import { useUnsaved, useDirty } from "../lib/dirty";
import { useState } from "react";
import { api, money, type Venta } from "../lib/api";
import { useData } from "../lib/useData";
import { useSession, can } from "../lib/session";
import type { Pedido, PedidoLinea, ArticuloPedido } from "../lib/pedidos";
import { Modal, Field, ErrorNotice, Table } from "./ui";
import ConfirmarAccion from "./ConfirmarAccion";
import ImprimirPedido from "./ImprimirPedido";
import Recibo from "../pages/Recibo";
export default function EditorPedido({
  pedido: initial,
  onClose,
  onChanged,
}: {
  pedido: Pedido;
  onClose: () => void;
  onChanged: () => void;
}) {
  const session = useSession(),
    menu = useData(() => api<ArticuloPedido[]>("/pedidos/catalogo"), []);
  const [pedido, setPedido] = useState(initial),
    [lineas, setLineas] = useState<PedidoLinea[]>(initial.lineas),
    [observacion, setObservacion] = useState(initial.observacion || ""),
    [dirty, setDirty] = useState(false),
    [item, setItem] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [print, setPrint] = useState(false),
    [receipt, setReceipt] = useState<Venta | null>(null),
    [cancel, setCancel] = useState(false),
    [medio, setMedio] = useState("EFECTIVO");
  useUnsaved(dirty);
  const drafts = useDirty();
  const close = () => {
    if (dirty) drafts?.confirm(onClose);
    else onClose();
  };
  const editable = ["ABIERTO", "PREPARADO"].includes(pedido.estado);
  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    await run(async () => {
      const p = await api<Pedido>(`/pedidos/${pedido.id}`);
      setPedido(p);
      setLineas(p.lineas);
      setObservacion(p.observacion);
      setDirty(false);
    });
  }
  return (
    <>
      <Modal
        title={`Pedido #${pedido.id}${pedido.mesa ? " · " + pedido.mesa : ""}`}
        onClose={close}
      >
        <ErrorNotice message={error || menu.error} />
        <p>
          Estado: <strong>{pedido.estado}</strong> · Responsable:{" "}
          {pedido.usuario_nombre}
        </p>
        <button disabled={busy} onClick={() => void reload()}>
          Actualizar pedido
        </button>
        {editable && (
          <>
            <div className="section-toolbar">
              <Field label="Agregar artículo al pedido">
                <select
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Selecciona un artículo o servicio</option>
                  {menu.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {money(p.precio)}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                disabled={!item || busy}
                onClick={() => {
                  const p = menu.data.find((p) => String(p.id) === item)!;
                  setLineas((prev) =>
                    prev.some((l) => l.producto_id === p.id)
                      ? prev.map((l) =>
                          l.producto_id === p.id
                            ? { ...l, cantidad: l.cantidad + 1 }
                            : l,
                        )
                      : [
                          ...prev,
                          {
                            producto_id: p.id,
                            nombre: p.nombre,
                            sku: p.sku,
                            cantidad: 1,
                            precio: p.precio,
                          },
                        ],
                  );
                  setDirty(true);
                }}
              >
                Agregar al pedido
              </button>
            </div>
          </>
        )}
        <Table headers={["Artículo", "Cantidad", "Importe", "Acciones"]}>
          {lineas.map((l) => (
            <tr key={l.producto_id}>
              <td>{l.nombre}</td>
              <td>
                <input
                  aria-label={`Cantidad de ${l.nombre} en pedido`}
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  value={l.cantidad}
                  disabled={!editable || busy}
                  onChange={(e) => {
                    setLineas((prev) =>
                      prev.map((x) =>
                        x.producto_id === l.producto_id
                          ? { ...x, cantidad: Number(e.target.value) }
                          : x,
                      ),
                    );
                    setDirty(true);
                  }}
                />
              </td>
              <td>{money(l.cantidad * l.precio)}</td>
              <td>
                {editable && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setLineas((prev) =>
                        prev.filter((x) => x.producto_id !== l.producto_id),
                      );
                      setDirty(true);
                    }}
                  >
                    Quitar<span className="sr-only"> {l.nombre}</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Field label="Observaciones del pedido">
          <textarea
            maxLength={500}
            value={observacion}
            disabled={!editable || busy}
            onChange={(e) => {
              setObservacion(e.target.value);
              setDirty(true);
            }}
          />
        </Field>
        <p>
          Total de referencia:{" "}
          <strong>
            {money(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0))}
          </strong>
        </p>
        {dirty && (
          <p className="notice">
            Hay cambios sin guardar. Guarda y revisa el total antes de imprimir
            o cobrar.
          </p>
        )}
        {pedido.clase === "MESA" &&
          pedido.estado !== "CANCELADO" &&
          (pedido.servido_en ? (
            <p>
              Primera entrega:{" "}
              {new Date(pedido.servido_en).toLocaleString("es-PE", {
                timeZone: "America/Lima",
              })}{" "}
              · {pedido.servido_por_nombre}
            </p>
          ) : (
            <button
              disabled={busy || dirty || !pedido.lineas.length}
              onClick={() =>
                void run(async () =>
                  setPedido(
                    await api<Pedido>(`/pedidos/${pedido.id}/servir`, "POST", {
                      version: pedido.version,
                    }),
                  ),
                )
              }
            >
              Marcar primera entrega a mesa
            </button>
          ))}
        <div className="row-actions">
          {editable && (
            <button
              className="primary"
              disabled={
                busy ||
                !dirty ||
                !lineas.length ||
                lineas.some(
                  (l) => !Number.isInteger(l.cantidad) || l.cantidad < 1,
                )
              }
              onClick={() =>
                void run(async () => {
                  const p = await api<Pedido>(`/pedidos/${pedido.id}`, "PUT", {
                    version: pedido.version,
                    observacion,
                    lineas: lineas.map((l) => ({
                      productoId: l.producto_id,
                      cantidad: l.cantidad,
                    })),
                  });
                  setPedido(p);
                  setLineas(p.lineas);
                  setDirty(false);
                })
              }
            >
              Guardar pedido
            </button>
          )}
          <button
            disabled={busy || dirty || !pedido.lineas.length}
            onClick={() => setPrint(true)}
          >
            Imprimir pedido
          </button>
          {editable && (
            <>
              <button
                disabled={busy || dirty || !pedido.lineas.length}
                onClick={() =>
                  void run(async () =>
                    setPedido(
                      await api<Pedido>(
                        `/pedidos/${pedido.id}/estado`,
                        "PATCH",
                        { version: pedido.version, estado: "PREPARADO" },
                      ),
                    ),
                  )
                }
              >
                Marcar preparado
              </button>
              <button disabled={busy} onClick={() => setCancel(true)}>
                Cancelar pedido
              </button>
            </>
          )}
        </div>
        {editable && can(session, "VENTAS_GESTIONAR") && (
          <section className="surface">
            <h3>Cobrar pedido</h3>
            <p>
              Se registrará una nota de venta interna. El precio y el stock se
              verificarán nuevamente.
            </p>
            <Field label="Medio de pago del pedido">
              <select
                disabled={busy}
                value={medio}
                onChange={(e) => setMedio(e.target.value)}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </Field>
            <button
              className="primary"
              disabled={busy || dirty || !pedido.lineas.length}
              onClick={() =>
                void run(async () => {
                  setReceipt(
                    await api<Venta>(`/pedidos/${pedido.id}/cobrar`, "POST", {
                      version: pedido.version,
                      tipo: "TICKET",
                      metodoPago: medio,
                    }),
                  );
                  const p = await api<Pedido>(`/pedidos/${pedido.id}`);
                  setPedido(p);
                })
              }
            >
              Confirmar cobro del pedido
            </button>
          </section>
        )}
      </Modal>
      {print && (
        <ImprimirPedido pedido={pedido} onClose={() => setPrint(false)} />
      )}
      {receipt && <Recibo venta={receipt} onClose={() => setReceipt(null)} />}
      {cancel && (
        <ConfirmarAccion
          titulo="Cancelar pedido"
          descripcion="Se cancelará el pedido sin registrar venta ni modificar stock."
          onClose={() => setCancel(false)}
          onConfirm={() =>
            run(async () => {
              setPedido(
                await api<Pedido>(`/pedidos/${pedido.id}/estado`, "PATCH", {
                  version: pedido.version,
                  estado: "CANCELADO",
                }),
              );
            })
          }
        />
      )}
    </>
  );
}
