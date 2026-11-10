import { useRef, useState, type FormEvent } from "react";
import { useData } from "../lib/useData";
import {
  api,
  money,
  type Producto,
  type Cliente,
  type Venta,
  type Empresa,
} from "../lib/api";
import { can, useSession } from "../lib/session";
import { Field, ErrorNotice, Empty, PageTitle, Modal } from "../components/ui";
import BarcodeScanner from "../components/BarcodeScanner";
import ProductEditor, { type Plantilla } from "../components/ProductEditor";
import OperationCart, { type CartLine } from "../components/OperationCart";
import PurchaseFields from "../components/PurchaseFields";
import { emptyPurchaseTax, type PurchaseTax } from "../lib/purchase";
import { CatalogoPicker } from "./CatalogoComun";
import Recibo from "./Recibo";
export default function Operacion({ compra = false }: { compra?: boolean }) {
  const { data, loading, error, refresh } = useData<{
    productos: Producto[];
    clientes: Cliente[];
    empresa: Empresa | null;
  }>(
    async () => ({
      productos: await api<Producto[]>("/productos"),
      clientes: compra ? [] : await api<Cliente[]>("/clientes"),
      empresa: await api<Empresa>("/empresas/mi-empresa"),
    }),
    { productos: [], clientes: [], empresa: null },
  );
  const [cart, setCart] = useState<CartLine[]>([]),
    [search, setSearch] = useState(""),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [receipt, setReceipt] = useState<Venta | null>(null),
    [editor, setEditor] = useState<{
      template?: Plantilla;
      barcode?: string;
    } | null>(null),
    [catalog, setCatalog] = useState(false),
    [tax, setTax] = useState<PurchaseTax>(emptyPurchaseTax);
  const session = useSession(),
    key = useRef(crypto.randomUUID()),
    round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const products = data.productos.filter(
    (p) =>
      p.activo &&
      `${p.nombre} ${p.sku} ${p.codigo_barras || ""} ${p.marca}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const totals = cart.reduce(
    (sum, l) => {
      const amount = round((compra ? l.costo : l.producto.precio) * l.cantidad);
      const gravada = compra
        ? tax.gravada
        : l.producto.afectacion_igv === "GRAVADO";
      const included = compra ? tax.incluye : true;
      const base = gravada && included ? round(amount / 1.18) : amount;
      const igv = gravada
        ? included
          ? round(amount - base)
          : round(base * 0.18)
        : 0;
      return {
        base: round(sum.base + base),
        igv: round(sum.igv + igv),
        total: round(sum.total + base + igv),
      };
    },
    { base: 0, igv: 0, total: 0 },
  );
  function add(
    producto: Producto,
    initial?: { cantidad: number; costo: number },
  ) {
    if (busy) return;
    if (!compra && producto.precio <= 0) {
      setActionError("Define el precio de venta del producto antes de vender.");
      return;
    }
    setSuccess("");
    setActionError("");
    setCart((items) => {
      const exists = items.find((l) => l.producto.id === producto.id);
      return exists
        ? items.map((l) =>
            l === exists
              ? { ...l, cantidad: l.cantidad + (initial?.cantidad || 1) }
              : l,
          )
        : [
            ...items,
            {
              producto,
              cantidad: initial?.cantidad || 1,
              costo: initial?.costo || 0,
            },
          ];
    });
  }
  function scan(code: string) {
    setSearch(code);
    const product = data.productos.find(
      (p) =>
        p.activo &&
        (p.codigo_barras === code ||
          p.sku.toUpperCase() === code.toUpperCase()),
    );
    if (product) {
      add(product);
      setSearch("");
    } else {
      setActionError(
        "Código no encontrado en tu negocio. Puedes buscar por nombre" +
          (compra ? " o agregar la mercadería desde aquí." : "."),
      );
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cart.length || busy) return;
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
      const eligible = Boolean(
        data.empresa?.ruc &&
        tax.tipo === "FACTURA" &&
        tax.gravada &&
        /^\d{11}$/.test(tax.ruc),
      );
      const result = await api<Venta>(compra ? "/compras" : "/ventas", "POST", {
        idempotencia: key.current,
        lineas,
        ...(compra
          ? {
              proveedor: values.get("proveedor"),
              referencia: values.get("referencia"),
              proveedorRuc: tax.ruc || null,
              tipoDocumento: tax.tipo,
              gravada: tax.gravada,
              costoIncluyeIgv: tax.incluye,
              creditoFiscal: eligible && tax.credito,
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
      setTax(emptyPurchaseTax);
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
            ? "Registra el costo real de la mercadería recibida. El costo es independiente de tu precio de venta."
            : "Escanea o selecciona mercadería y registra la venta."
        }
      />
      <ErrorNotice message={error || actionError} />
      <p role="status">{success}</p>
      <div className="pos-grid">
        <section className="surface">
          <div className="section-toolbar">
            <h2>Mercadería</h2>
            <button disabled={busy} onClick={() => void refresh()}>
              Actualizar
            </button>
          </div>
          <BarcodeScanner value={search} onChange={setSearch} onScan={scan} />
          {compra && can(session, "PRODUCTOS_EDITAR") && (
            <div className="section-toolbar">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditor({ barcode: search })}
              >
                Agregar mercadería
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCatalog(true)}
              >
                Elegir del catálogo común
              </button>
            </div>
          )}
          {loading ? (
            <p role="status">Cargando catálogo…</p>
          ) : products.length ? (
            <div className="product-list">
              {products.map((p) => (
                <button
                  className="product-option"
                  key={p.id}
                  disabled={
                    busy || (!compra && (p.stock === 0 || p.precio <= 0))
                  }
                  onClick={() => add(p)}
                >
                  <span>
                    <strong>{p.nombre}</strong>
                    <small>
                      {p.marca} · {p.presentacion || p.sku} · {p.stock}{" "}
                      disponibles
                    </small>
                  </span>
                  <span>
                    {compra
                      ? "Añadir"
                      : p.precio > 0
                        ? money(p.precio)
                        : "Precio por definir"}{" "}
                    <span aria-hidden="true">+</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty>
              No hay coincidencias.{" "}
              {compra
                ? "Puedes agregar la mercadería aquí mismo."
                : "Revisa el catálogo y las existencias."}
            </Empty>
          )}
        </section>
        <section className="surface">
          <h2>{compra ? "Detalle de compra" : "Detalle de venta"}</h2>
          <form className="form" onSubmit={submit}>
            <OperationCart
              lines={cart}
              purchase={compra}
              busy={busy}
              onChange={(id, field, value) =>
                setCart((items) =>
                  items.map((l) =>
                    l.producto.id === id ? { ...l, [field]: value } : l,
                  ),
                )
              }
              onRemove={(id) =>
                setCart((items) => items.filter((l) => l.producto.id !== id))
              }
            />
            {compra ? (
              <PurchaseFields
                tax={tax}
                onChange={setTax}
                busy={busy}
                rucNegocio={data.empresa?.ruc || null}
              />
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
                      {data.empresa?.ruc && (
                        <>
                          <option value="BOLETA">
                            Boleta (pendiente de emisión fiscal)
                          </option>
                          <option value="FACTURA">
                            Factura (pendiente de emisión fiscal)
                          </option>
                        </>
                      )}
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
                  emisión electrónica requiere RUC y configuración de SUNAT.
                </p>
              </>
            )}
            {(compra ? tax.gravada : Boolean(data.empresa?.ruc)) && (
              <dl className="totals">
                <div>
                  <dt>Base / importe neto</dt>
                  <dd>{money(totals.base)}</dd>
                </div>
                <div>
                  <dt>IGV registrado</dt>
                  <dd>{money(totals.igv)}</dd>
                </div>
              </dl>
            )}
            <div className="checkout-total">
              <span>Total</span>
              <strong>{money(totals.total)}</strong>
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
      {editor && (
        <Modal
          title={
            editor.template
              ? "Incorporar mercadería del catálogo"
              : "Agregar mercadería a esta compra"
          }
          onClose={() => setEditor(null)}
        >
          <ProductEditor
            template={editor.template}
            barcode={editor.barcode}
            purchase
            onSaved={(p, initial) => {
              add(p, initial);
              setEditor(null);
              setSearch("");
              void refresh();
            }}
          />
        </Modal>
      )}
      {catalog && (
        <Modal
          title="Elegir mercadería común"
          onClose={() => setCatalog(false)}
        >
          <CatalogoPicker
            onChoose={(p) => {
              setCatalog(false);
              setEditor({ template: p });
            }}
          />
        </Modal>
      )}
      {receipt && <Recibo venta={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
