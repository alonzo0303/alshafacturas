import { useState } from "react";
import { api, money, localDay } from "../lib/api";
import { useData } from "../lib/useData";
import { PageTitle, Field, ErrorNotice, Table } from "../components/ui";
type VentaMetric = {
  colaborador_id: number;
  colaborador: string;
  ventas: number;
  anuladas: number;
  total: number;
  unidades: number;
  comidas: number;
};
type CorteMetric = {
  colaborador_id: number;
  colaborador: string;
  cortes: number;
  diferencia: number;
};
type Datos = {
  modo: string;
  ventas: VentaMetric[];
  cortes: CorteMetric[];
  diario: { dia: string; ventas: number; total: number; comidas: number }[];
};
function Resultado({ query }: { query: string }) {
  const { data, error, loading, refresh } = useData(
    () => api<Datos>("/rendimiento" + query),
    null,
  );
  const rows = new Map<
    number,
    VentaMetric & { cortes: number; diferencia: number }
  >();
  for (const v of data?.ventas || []) {
    const old = rows.get(v.colaborador_id) || {
      colaborador_id: v.colaborador_id,
      colaborador: v.colaborador,
      ventas: 0,
      anuladas: 0,
      total: 0,
      unidades: 0,
      comidas: 0,
      cortes: 0,
      diferencia: 0,
    };
    for (const k of [
      "ventas",
      "anuladas",
      "total",
      "unidades",
      "comidas",
    ] as const)
      old[k] += Number(v[k]);
    rows.set(v.colaborador_id, old);
  }
  for (const c of data?.cortes || []) {
    const old = rows.get(c.colaborador_id) || {
      colaborador_id: c.colaborador_id,
      colaborador: c.colaborador,
      ventas: 0,
      anuladas: 0,
      total: 0,
      unidades: 0,
      comidas: 0,
      cortes: 0,
      diferencia: 0,
    };
    old.cortes += Number(c.cortes);
    old.diferencia += Number(c.diferencia);
    rows.set(c.colaborador_id, old);
  }
  const list = [...rows.values()];
  return (
    <>
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Calculando rendimiento…</p>
      ) : (
        data && (
          <>
            <section className="surface">
              <div className="section-toolbar">
                <h2>Rendimiento · {data.modo}</h2>
                <button onClick={() => void refresh()}>
                  Actualizar rendimiento
                </button>
              </div>
              <div className="metric-grid">
                <div>
                  <small>Ventas confirmadas</small>
                  <strong>{list.reduce((s, r) => s + r.ventas, 0)}</strong>
                </div>
                <div>
                  <small>Total vendido</small>
                  <strong>
                    {money(list.reduce((s, r) => s + r.total, 0))}
                  </strong>
                </div>
                <div>
                  <small>Comidas marcadas vendidas</small>
                  <strong>{list.reduce((s, r) => s + r.comidas, 0)}</strong>
                </div>
                <div>
                  <small>Cierres realizados</small>
                  <strong>{list.reduce((s, r) => s + r.cortes, 0)}</strong>
                </div>
              </div>
            </section>
            <section className="surface">
              <h2>Por colaborador</h2>
              <Table
                headers={[
                  "Colaborador",
                  "Ventas",
                  "Anuladas",
                  "Total",
                  "Unidades",
                  "Comidas",
                  "Cierres",
                  "Diferencia de caja",
                ]}
              >
                {list.map((r) => (
                  <tr key={r.colaborador_id}>
                    <td>{r.colaborador || `Usuario #${r.colaborador_id}`}</td>
                    <td>{r.ventas}</td>
                    <td>{r.anuladas}</td>
                    <td>{money(r.total)}</td>
                    <td>{r.unidades}</td>
                    <td>{r.comidas}</td>
                    <td>{r.cortes}</td>
                    <td>{money(r.diferencia)}</td>
                  </tr>
                ))}
              </Table>
            </section>
            <section className="surface">
              <h2>Ventas por día</h2>
              <ul className="daily-bars">
                {data.diario.map((d) => (
                  <li key={d.dia}>
                    <span>{String(d.dia).slice(0, 10)}</span>
                    <meter
                      aria-label={`Total vendido el ${d.dia}`}
                      min="0"
                      max={Math.max(
                        1,
                        ...data.diario.map((i) => Number(i.total)),
                      )}
                      value={Number(d.total)}
                    />
                    <strong>{money(d.total)}</strong>
                  </li>
                ))}
              </ul>
              <Table headers={["Día", "Ventas", "Comidas", "Total"]}>
                {data.diario.map((d) => (
                  <tr key={d.dia}>
                    <td>{String(d.dia).slice(0, 10)}</td>
                    <td>{d.ventas}</td>
                    <td>{d.comidas}</td>
                    <td>{money(d.total)}</td>
                  </tr>
                ))}
              </Table>
            </section>
          </>
        )
      )}
    </>
  );
}
export default function Rendimiento({ query = "" }: { query?: string }) {
  const [range, setRange] = useState(() => {
    const today = localDay(new Date().toISOString());
    return {
      desde: today.slice(0, 7) + "-01",
      hasta: today,
    };
  });
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  params.set("desde", range.desde);
  params.set("hasta", range.hasta);
  const request = "?" + params.toString();
  return (
    <>
      <PageTitle
        title="Rendimiento del personal"
        description="Ventas atribuidas a quien cobra y cierres atribuidos a quien cierra la caja. Los colaboradores consultan sus propias cifras."
      />
      <section className="surface">
        <form
          className="section-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setRange({
              desde: String(d.get("desde")),
              hasta: String(d.get("hasta")),
            });
          }}
        >
          <Field label="Rendimiento desde">
            <input
              name="desde"
              type="date"
              defaultValue={range.desde}
              required
            />
          </Field>
          <Field label="Rendimiento hasta">
            <input
              name="hasta"
              type="date"
              defaultValue={range.hasta}
              required
            />
          </Field>
          <button className="primary">Consultar rendimiento</button>
        </form>
        <p className="hint">
          Las comidas se cuentan por las líneas marcadas como comida al vender;
          no se infieren de su nombre. El periodo usa la hora de Perú.
        </p>
      </section>
      <Resultado key={request} query={request} />
    </>
  );
}
