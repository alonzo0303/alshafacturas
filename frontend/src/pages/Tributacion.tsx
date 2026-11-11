import { useState } from "react";
import { api, money, localDay } from "../lib/api";
import { useData } from "../lib/useData";
import { taxLabels } from "../lib/session";
import { Field, Form, ErrorNotice, PageTitle } from "../components/ui";
type TaxConfig = {
  ruc: string | null;
  afectacion_default: string;
  precios_incluyen_igv: boolean;
};
export function ConfigTributaria() {
  const { data, error, loading, refresh } = useData(
    () => api<TaxConfig>("/tributacion/configuracion"),
    null,
  );
  return (
    <section className="surface">
      <h2>Precios e IGV</h2>
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Cargando configuración…</p>
      ) : (
        data && (
          <>
            <p className="compact-note">
              El RUC no determina por sí solo si una operación está gravada,
              exonerada o inafecta. Selecciona el tratamiento que corresponda al
              negocio y a cada producto.
            </p>
            <Form
              key={`${data.afectacion_default}-${data.precios_incluyen_igv}`}
              onSave={(d) =>
                api("/tributacion/configuracion", "PUT", {
                  afectacion: d.get("afectacion"),
                  preciosIncluyenIgv: d.get("incluye") === "on",
                })
              }
              onDone={() => void refresh()}
            >
              <Field label="Tratamiento predeterminado para nuevos productos">
                <select
                  name="afectacion"
                  defaultValue={data.afectacion_default}
                >
                  {Object.entries(taxLabels)
                    .filter(([code]) =>
                      data.ruc ? code !== "SIN_IGV" : code === "SIN_IGV",
                    )
                    .map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                </select>
              </Field>
              {data.ruc && (
                <label className="check">
                  <input
                    name="incluye"
                    type="checkbox"
                    defaultChecked={data.precios_incluyen_igv}
                  />
                  Al registrar nuevos precios, el importe ingresado ya incluye
                  IGV
                </label>
              )}
              <p className="hint">
                Esta preferencia no cambia precios ni impuestos de ventas
                anteriores. Cada producto puede tener su tratamiento específico.
              </p>
            </Form>
          </>
        )
      )}
    </section>
  );
}
type TaxSummary = {
  desde: string;
  hasta: string;
  igv_ventas_registrado: number;
  igv_ventas_con_cdr: number;
  igv_compras_registrado: number;
  credito_fiscal_potencial: number;
};
export default function Tributacion() {
  const [today] = useState(() => localDay(new Date().toISOString())),
    [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [data, setData] = useState<TaxSummary | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(
        await api<TaxSummary>(
          `/tributacion/resumen?desde=${encodeURIComponent(from)}&hasta=${encodeURIComponent(to)}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="IGV de ventas y compras"
        description="Distingue el desglose del precio del posible crédito fiscal de una compra."
      />
      <ErrorNotice message={error} />
      <section className="surface">
        <form
          className="section-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <Field label="Desde">
            <input
              type="date"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button className="primary" disabled={busy}>
            {busy ? "Consultando…" : "Consultar período"}
          </button>
        </form>
      </section>
      {data && (
        <section className="tax-summary" aria-label="Resumen de IGV">
          {[
            ["IGV registrado en ventas", data.igv_ventas_registrado],
            ["IGV de ventas con CDR de producción", data.igv_ventas_con_cdr],
            ["IGV registrado en compras", data.igv_compras_registrado],
            ["Crédito fiscal potencial marcado", data.credito_fiscal_potencial],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p>{label}</p>
              <strong>{money(Number(value))}</strong>
            </div>
          ))}
        </section>
      )}
      <section className="surface">
        <h2>Desglosar el IGV del precio</h2>
        <p>
          Si el precio final gravado es S/118, su base es S/100 y su IGV S/18.
          Si ingresas un precio base de S/100 sin IGV, el precio final será
          S/118. Los productos exonerados o inafectos se identifican por
          separado.
        </p>
      </section>
      <section className="surface">
        <h2>Crédito fiscal de compras</h2>
        <p>
          El IGV de una compra puede ser crédito fiscal si cumple los requisitos
          aplicables. Registrar una factura o marcar una compra no acredita por
          sí solo ese derecho.
        </p>
        <p className="notice">
          Este resumen es referencial: no valida automáticamente comprobantes de
          proveedores, no incorpora saldos de períodos anteriores ni presenta
          declaraciones. Revisa el derecho al crédito con tu contador y los
          registros correspondientes.
        </p>
        <a
          href="https://orientacion.sunat.gob.pe/3111-06-credito-fiscal"
          target="_blank"
          rel="noreferrer"
        >
          Requisitos de crédito fiscal en SUNAT
        </a>
      </section>
    </>
  );
}
