import { useData } from "../lib/useData";
import { useRef, useState, type FormEvent } from "react";
import {
  api,
  money,
  type Producto,
  type Cliente,
  type Venta,
} from "../lib/api";
import { Field, ErrorNotice, Empty, PageTitle, Table } from "../components/ui";
import Recibo from "./Recibo";
type Linea = { producto: Producto; cantidad: number; costo: number };
export default function Operacion({ compra = false }: { compra?: boolean }) {
  const { data, loading, error, refresh } = useData(
    async () => ({
      productos: await api<Producto[]>("/productos"),
      clientes: compra ? [] : await api<Cliente[]>("/clientes"),
    }),
    { productos: [], clientes: [] },
  );
  const [cart, setCart] = useState<Linea[]>([]),
    [search, setSearch] = useState(""),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [receipt, setReceipt] = useState<Venta | null>(null);
  const key = useRef(crypto.randomUUID());
  const products = data.productos.filter(
    (p) =>
      p.activo &&
      `${p.nombre} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  const total =
    cart.reduce(
      (sum, l) =>
        sum +
        Math.round((compra ? l.costo : l.producto.precio) * l.cantidad * 100),
      0,
    ) / 100;
  function add(producto: Producto) {
    setSuccess("");
    setCart((items) => {
      const exists = items.find((l) => l.producto.id === producto.id);
      return exists
        ? items.map((l) =>
            l === exists ? { ...l, cantidad: l.cantidad + 1 } : l,
          )
        : [...items, { producto, cantidad: 1, costo: producto.precio }];
    });
  }
  function change(id: number, field: "cantidad" | "costo", value: number) {
    setCart((items) =>
      items.map((l) => (l.producto.id === id ? { ...l, [field]: value } : l)),
    );
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cart.length) return;
    const form = e.currentTarget,
      values = new FormData(form);
    setBusy(true);
    setActionError("");
    setSuccess("");
    try {
      const lineas = cart.map((l) => ({
        productoId: l.producto.id,
        cantidad: l.cantidad,
        ...(compra ? { costo: l.costo } : {}),
      }));
      const result = await api<Venta>(compra ? "/compras" : "/ventas", "POST", {
        idempotencia: key.current,
        lineas,
        ...(compra
          ? {
              proveedor: values.get("proveedor"),
              referencia: values.get("referencia"),
            }
          : {
              clienteId: values.get("clienteId")
                ? Number(values.get("clienteId"))
                : null,
              tipo: values.get("tipo"),
              metodoPago: values.get("metodoPago"),
            }),
      });
      key.current = crypto.randomUUID();
      setCart([]);
      form.reset();
      setSuccess(
        compra
          ? "Compra registrada. El inventario se ha actualizado."
          : `Venta ${result.numero} registrada.`,
      );
      if (!compra) setReceipt(result);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title={compra ? "Registrar compra" : "Punto de venta"}
        description={
          compra
            ? "Registra mercadería recibida y actualiza tus existencias."
            : "Selecciona productos y confirma tu venta. Precios incluyen IGV."
        }
      />
      <ErrorNotice message={error || actionError} />
      <p role="status">{success}</p>
      <div className="pos-grid">
        <section className="surface">
          <div className="section-toolbar">
            <h2>Productos</h2>
            <button disabled={busy} onClick={() => void refresh()}>
              Actualizar
            </button>
          </div>
          <input
            className="full"
            aria-label="Buscar producto"
            type="search"
            placeholder="Buscar por nombre o SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <p role="status">Cargando catálogo…</p>
          ) : products.length ? (
            <div className="product-list">
              {products.map((p) => (
                <button
                  className="product-option"
                  key={p.id}
                  disabled={busy || (!compra && p.stock === 0)}
                  onClick={() => add(p)}
                >
                  <span>
                    <strong>{p.nombre}</strong>
                    <small>
                      {p.sku} · {p.stock} disponibles
                    </small>
                  </span>
                  <span>
                    {money(p.precio)} <span aria-hidden="true">+</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty>
              No hay productos disponibles. Regístralos desde Productos.
            </Empty>
          )}
        </section>
        <section className="surface">
          <h2>{compra ? "Detalle de compra" : "Detalle de venta"}</h2>
          <form className="form" onSubmit={submit}>
            {cart.length ? (
              <Table
                headers={[
                  "Producto",
                  "Cantidad",
                  compra ? "Costo unitario" : "Importe",
                  "",
                ]}
              >
                {cart.map((l) => (
                  <tr key={l.producto.id}>
                    <td>{l.producto.nombre}</td>
                    <td>
                      <input
                        aria-label={`Cantidad de ${l.producto.nombre}`}
                        className="quantity"
                        type="number"
                        required
                        min="1"
                        max="100000"
                        value={l.cantidad || ""}
                        onChange={(e) =>
                          change(
                            l.producto.id,
                            "cantidad",
                            Number(e.target.value),
                          )
                        }
                        disabled={busy}
                      />
                    </td>
                    <td>
                      {compra ? (
                        <input
                          aria-label={`Costo de ${l.producto.nombre}`}
                          className="cost"
                          type="number"
                          required
                          min="0.01"
                          max="999999999.99"
                          step="0.01"
                          value={l.costo || ""}
                          onChange={(e) =>
                            change(
                              l.producto.id,
                              "costo",
                              Number(e.target.value),
                            )
                          }
                          disabled={busy}
                        />
                      ) : (
                        money(l.cantidad * l.producto.precio)
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Quitar ${l.producto.nombre}`}
                        onClick={() =>
                          setCart((items) => items.filter((i) => i !== l))
                        }
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>Añade productos del catálogo para empezar.</Empty>
            )}
            {compra ? (
              <>
                <Field label="Proveedor">
                  <input
                    name="proveedor"
                    maxLength={200}
                    required
                    disabled={busy}
                  />
                </Field>
                <Field label="Referencia del documento de compra">
                  <input
                    name="referencia"
                    maxLength={100}
                    required
                    disabled={busy}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Cliente">
                  <select name="clienteId" disabled={busy}>
                    <option value="">Venta al público</option>
                    {data.clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} · {c.documento}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="form-grid">
                  <Field label="Documento solicitado">
                    <select name="tipo" disabled={busy}>
                      <option value="TICKET">Nota de venta interna</option>
                      <option value="BOLETA">
                        Boleta (pendiente de emisión fiscal)
                      </option>
                      <option value="FACTURA">
                        Factura (pendiente de emisión fiscal)
                      </option>
                    </select>
                  </Field>
                  <Field label="Medio de pago">
                    <select name="metodoPago" disabled={busy}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                    </select>
                  </Field>
                </div>
                <p className="hint">
                  El cobro se registra; no se procesa un pago bancario. La
                  emisión electrónica aún requiere configurar el proveedor
                  fiscal.
                </p>
              </>
            )}
            <div className="checkout-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <button className="primary" disabled={busy || !cart.length}>
              {busy
                ? "Registrando…"
                : compra
                  ? "Confirmar compra"
                  : "Confirmar venta"}
            </button>
          </form>
        </section>
      </div>
      {receipt && <Recibo venta={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
