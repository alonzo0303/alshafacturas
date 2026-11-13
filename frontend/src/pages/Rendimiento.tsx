import ReportePerfil from "../components/experiencia/ReportePerfil";
import { useState } from "react";
import { api, money, localDay } from "../lib/api";
import { useData } from "../lib/useData";
import { PageTitle, Field, ErrorNotice, Table } from "../components/ui";
type Datos = {
  modo: string;
  personalizado: import("../lib/experiencia").ReportePerfil;
  diario: { dia: string; ventas: number; total: number; comidas: number }[];
};
function Resultado({ query }: { query: string }) {
  const { data, error, loading, refresh } = useData(
    () => api<Datos>("/rendimiento" + query),
    null,
  );
  return (
    <>
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Calculando rendimiento…</p>
      ) : (
        data && (
          <>
            <ReportePerfil
              data={data.personalizado}
              onRefresh={() => void refresh()}
            />
            <section className="surface">
              <h2>Ventas por día</h2>
              {data.diario.length ? (
                <>
                  <ul className="daily-bars">
                    {data.diario.map((d) => (
                      <li key={d.dia}>
                        <span>{String(d.dia).slice(0, 10)}</span>
                        <meter
                          aria-label={`Total vendido el ${d.dia}`}
                          min={0}
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
                  <Table headers={["Día", "Ventas", "Total"]}>
                    {data.diario.map((d) => (
                      <tr key={d.dia}>
                        <td>{String(d.dia).slice(0, 10)}</td>
                        <td>{d.ventas}</td>
                        <td>{money(d.total)}</td>
                      </tr>
                    ))}
                  </Table>
                </>
              ) : (
                <p className="empty">
                  No hay ventas confirmadas en este período.
                </p>
              )}
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
          El período usa la hora de Perú. Las duraciones requieren marcas reales
          de inicio y finalización; no se estiman con la duración programada del
          servicio.
        </p>
      </section>
      <Resultado key={request} query={request} />
    </>
  );
}
