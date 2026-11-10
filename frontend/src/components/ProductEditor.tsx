import { ImageEditor } from "./ProductImage";
import { uploadImage } from "../lib/images";
import { useState, type FormEvent } from "react";
import { api, money, type Producto } from "../lib/api";
import { useData } from "../lib/useData";
import { taxLabels } from "../lib/session";
import { Field, ErrorNotice } from "./ui";
import BarcodeScanner from "./BarcodeScanner";
export type Plantilla = {
  id: number;
  nombre: string;
  rubro: string;
  descripcion?: string;
  activo: boolean;
  imagen_version?: string | null;
};
type TaxConfig = {
  ruc: string | null;
  afectacion_default: string;
  precios_incluyen_igv: boolean;
};
type Props = {
  product?: Producto;
  template?: Plantilla;
  barcode?: string;
  purchase?: boolean;
  onSaved: (
    product: Producto,
    initial?: { cantidad: number; costo: number },
  ) => void;
  onCancel?: () => void;
};
export default function ProductEditor(props: Props) {
  const { data, error, loading } = useData(
    () => api<TaxConfig>("/tributacion/configuracion"),
    null,
  );
  if (loading) return <p role="status">Cargando configuración del producto…</p>;
  if (!data) return <ErrorNotice message={error} />;
  return <ProductForm {...props} config={data} />;
}
function ProductForm({
  product,
  template,
  barcode,
  purchase,
  onSaved,
  onCancel,
  config,
}: Props & { config: TaxConfig }) {
  const [code, setCode] = useState(product?.codigo_barras || barcode || ""),
    [tax, setTax] = useState(
      product?.afectacion_igv || config.afectacion_default,
    ),
    [price, setPrice] = useState(String(product?.precio || "")),
    [includes, setIncludes] = useState(
      product ? true : config.precios_incluyen_igv,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [existing, setExisting] = useState(product);
  const [photo, setPhoto] = useState<File | null | undefined>();
  const final =
    Number(price || 0) * (tax === "GRAVADO" && !includes ? 1.18 : 1);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (preparingPhoto || busy) return;
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const body = {
        sku: d.get("sku") || existing?.sku || null,
        nombre: d.get("nombre"),
        precio: Number(price || 0),
        minimo: Number(d.get("minimo")),
        activo: d.get("activo") === "on",
        marca: d.get("marca") || "Genérico",
        categoria: d.get("categoria") || "General",
        presentacion: d.get("presentacion"),
        codigoBarras: code || null,
        catalogoId: template?.id || product?.catalogo_id || null,
        afectacionIgv: config.ruc ? tax : "SIN_IGV",
        precioIncluyeIgv: includes,
      };
      const endpoint = existing
        ? `/productos/${existing.id}`
        : template
          ? `/catalogo-comun/${template.id}/incorporar`
          : "/productos";
      const saved = await api<Producto>(
        endpoint,
        existing ? "PUT" : "POST",
        body,
      );
      setExisting(saved);
      if (photo) {
        const image = await uploadImage(`/productos/${saved.id}`, photo);
        saved.imagen_version = image.imagen_version;
      } else if (photo === null) {
        await api(`/productos/${saved.id}/imagen`, "DELETE");
        saved.imagen_version = null;
      }
      onSaved(
        saved,
        purchase
          ? {
              cantidad: Number(d.get("cantidadInicial") || 1),
              costo: Number(d.get("costoInicial") || 0),
            }
          : undefined,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="form">
      <ErrorNotice message={error} />
      <fieldset disabled={busy || preparingPhoto}>
        <ImageEditor
          initialUrl={
            product?.imagen_version
              ? `/api/productos/${product.id}/imagen`
              : template?.imagen_version
                ? `/api/catalogo-comun/${template.id}/imagen`
                : undefined
          }
          onChange={setPhoto}
          onBusyChange={setPreparingPhoto}
          disabled={busy}
        />
        <div className="form-grid">
          <Field label="Código / SKU (opcional)">
            <input
              name="sku"
              maxLength={60}
              defaultValue={product?.sku}
              placeholder="Se genera si lo dejas vacío"
            />
          </Field>
          <Field label="Nombre del producto">
            <input
              name="nombre"
              required
              maxLength={200}
              defaultValue={product?.nombre || template?.nombre}
            />
          </Field>
          <Field label="Marca">
            <input
              name="marca"
              maxLength={100}
              defaultValue={product?.marca || "Genérico"}
              required
            />
          </Field>
          <Field label="Rubro / categoría">
            <input
              name="categoria"
              maxLength={100}
              defaultValue={product?.categoria || template?.rubro || "General"}
              required
            />
          </Field>
          <Field label="Presentación o variante (opcional)">
            <input
              name="presentacion"
              maxLength={100}
              defaultValue={product?.presentacion}
              placeholder="Color, tamaño o presentación"
            />
          </Field>
          <Field label="Stock mínimo">
            <input
              name="minimo"
              type="number"
              min="0"
              max="1000000"
              required
              defaultValue={product?.minimo ?? 5}
            />
          </Field>
          <Field label="Precio de venta ingresado (S/)">
            <input
              name="precio"
              type="number"
              min="0"
              max="999999999.99"
              step="0.01"
              required={!purchase}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          {config.ruc && (
            <Field label="Tratamiento de IGV del producto">
              <select value={tax} onChange={(e) => setTax(e.target.value)}>
                {Object.entries(taxLabels)
                  .filter(([key]) => key !== "SIN_IGV")
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
        {config.ruc && tax === "GRAVADO" && (
          <label className="check">
            <input
              type="checkbox"
              checked={includes}
              onChange={(e) => setIncludes(e.target.checked)}
            />
            El importe ingresado ya incluye IGV del 18%
          </label>
        )}
        <p className="compact-note">
          Precio final para vender: <strong>{money(final)}</strong>.{" "}
          {purchase
            ? "Puedes dejarlo en cero y definirlo antes de vender. No se usará como costo de compra."
            : "Cada negocio define su precio de venta."}
        </p>
        <BarcodeScanner
          name="codigoBarras"
          label="Código de barras (opcional)"
          value={code}
          onChange={setCode}
          onScan={setCode}
        />
        <label className="check">
          <input
            name="activo"
            type="checkbox"
            defaultChecked={product?.activo ?? true}
          />
          Disponible para venta
        </label>
        {purchase && (
          <div className="form-grid">
            <Field label="Cantidad para esta compra">
              <input
                name="cantidadInicial"
                type="number"
                min="1"
                max="100000"
                defaultValue={1}
                required
              />
            </Field>
            <Field label="Costo unitario de esta compra (S/)">
              <input
                name="costoInicial"
                type="number"
                min="0.01"
                max="999999999.99"
                step="0.01"
                required
              />
            </Field>
          </div>
        )}
        <div className="form-actions">
          <button className="primary" disabled={busy}>
            {busy
              ? "Guardando…"
              : purchase
                ? "Guardar y añadir a la compra"
                : "Guardar producto"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
