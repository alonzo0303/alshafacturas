import { money } from "../../lib/api";
import type {
  ValorMetrica,
  ReportePerfil as Reporte,
} from "../../lib/experiencia";
import { Table, Empty } from "../ui";
function value(m: ValorMetrica) {
  if (m.valor === null) return "Sin medición disponible";
  if (m.unidad === "MONEDA") return money(Number(m.valor));
  const n = new Intl.NumberFormat("es-PE", {
    maximumFractionDigits: m.unidad === "ENTERO" ? 0 : 2,
  }).format(Number(m.valor));
  return (
    n +
    (m.unidad === "MINUTOS"
      ? " min"
      : m.operacion === "INVENTARIO_ROTACION_UNIDADES"
        ? " veces"
        : "")
  );
}
export default function ReportePerfil({
  data,
  onRefresh,
}: {
  data: Reporte;
  onRefresh: () => void;
}) {
  const config = data.configuracion;
  return (
    <>
      <section className="surface">
        <div className="section-toolbar">
          <div>
            <h2>Rendimiento · {config.plantilla.nombre}</h2>
            <small>
              Perfil{" "}
              {config.modo === "GENERAL"
                ? "General"
                : config.modo === "ESPECIFICO"
                  ? "Específico"
                  : "Personalizado"}{" "}
              · Versión {config.plantilla.version}
              {config.heredado
                ? " · Configuración del negocio"
                : " · Configuración de la sucursal"}
            </small>
          </div>
          <button onClick={onRefresh}>Actualizar rendimiento</button>
        </div>
        <p className="hint">{data.atribucion}</p>
        <div className="metric-grid">
          {data.metricas.map((m) => (
            <article className="profile-metric" key={m.clave}>
              <h3>{m.titulo}</h3>
              <strong>{value(m)}</strong>
              {m.detalle && <p className="hint">{m.detalle}</p>}
              {m.meta !== null && (
                <small>
                  Meta: {m.unidad === "MONEDA" ? money(m.meta) : m.meta}
                  {m.unidad === "MINUTOS" ? " min" : ""}
                </small>
              )}
              {m.meta !== null &&
                m.meta > 0 &&
                m.valor !== null &&
                m.valor >= 0 && (
                  <meter
                    min={0}
                    max={m.meta}
                    value={Math.min(m.meta, Number(m.valor))}
                    aria-label={`Avance de ${m.titulo}`}
                  />
                )}
            </article>
          ))}
        </div>
      </section>
      <section className="surface">
        <h2>Por colaborador</h2>
        {data.colaboradores.length ? (
          <Table
            headers={["Colaborador", ...data.metricas.map((m) => m.titulo)]}
          >
            {data.colaboradores.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                {c.metricas.map((m) => (
                  <td key={m.clave}>
                    <span title={m.detalle}>
                      {m.alcance === "LOCAL" ? "Indicador del local" : value(m)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No hay colaboradores ni operaciones para este período.</Empty>
        )}
      </section>
    </>
  );
}
