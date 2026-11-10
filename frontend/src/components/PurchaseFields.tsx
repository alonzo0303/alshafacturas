import { Field } from "./ui";
import { type PurchaseTax } from "../lib/purchase";
export default function PurchaseFields({
  tax,
  onChange,
  busy,
  rucNegocio,
}: {
  tax: PurchaseTax;
  onChange: (value: PurchaseTax) => void;
  busy: boolean;
  rucNegocio: string | null;
}) {
  const eligible = Boolean(
    rucNegocio &&
    tax.tipo === "FACTURA" &&
    tax.gravada &&
    /^\d{11}$/.test(tax.ruc),
  );
  return (
    <>
      <div className="form-grid">
        <Field label="Proveedor">
          <input name="proveedor" maxLength={200} required disabled={busy} />
        </Field>
        <Field label="Referencia del documento de compra">
          <input name="referencia" maxLength={100} required disabled={busy} />
        </Field>
        <Field label="Tipo de documento de compra">
          <select
            value={tax.tipo}
            disabled={busy}
            onChange={(e) => onChange({ ...tax, tipo: e.target.value })}
          >
            <option value="INTERNO">Registro interno</option>
            <option value="FACTURA">Factura</option>
            <option value="BOLETA">Boleta</option>
          </select>
        </Field>
        <Field label="RUC del proveedor">
          <input
            inputMode="numeric"
            pattern="[0-9]{11}"
            maxLength={11}
            required={tax.tipo === "FACTURA"}
            value={tax.ruc}
            disabled={busy}
            onChange={(e) => onChange({ ...tax, ruc: e.target.value })}
          />
        </Field>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={tax.gravada}
          disabled={busy}
          onChange={(e) => onChange({ ...tax, gravada: e.target.checked })}
        />
        La compra está gravada con IGV 18%
      </label>
      {tax.gravada && (
        <label className="check">
          <input
            type="checkbox"
            checked={tax.incluye}
            disabled={busy}
            onChange={(e) => onChange({ ...tax, incluye: e.target.checked })}
          />
          El costo unitario ingresado ya incluye IGV
        </label>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={eligible && tax.credito}
          disabled={busy || !eligible}
          onChange={(e) => onChange({ ...tax, credito: e.target.checked })}
        />
        Compra para evaluar como crédito fiscal
      </label>
      <p className="hint">
        El crédito fiscal potencial requiere factura, RUC del proveedor y del
        negocio, y compra gravada. Su derecho debe validarse con los requisitos
        de SUNAT; marcarlo no presenta una declaración.
      </p>
    </>
  );
}
