import { api } from "../lib/api";
import { useData } from "../lib/useData";
import { ErrorNotice, PageTitle, Table, Empty } from "../components/ui";
export type Aviso = {
  id: number;
  fecha: string;
  vence: string;
  dias_restantes: number;
  resuelto: boolean;
};
const fechaPlan = (s: string) =>
  String(s).slice(0, 10).split("-").reverse().join("/");
export function AvisosSuscripcion({ empresaId }: { empresaId?: number }) {
  const { data, error, loading, refresh } = useData(
    () =>
      api<{ instruccionesPago: string; avisos: Aviso[] }>(
        "/notificaciones-suscripcion" +
          (empresaId ? `?empresaId=${empresaId}` : ""),
      ),
    null,
  );
  return (
    <section className="surface">
      <div className="section-toolbar">
        <h2>Recordatorios de membresía</h2>
        <button onClick={() => void refresh()}>Actualizar recordatorios</button>
      </div>
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Consultando recordatorios…</p>
      ) : (
        data && (
          <>
            <p className="payment-instructions">{data.instruccionesPago}</p>
            {data.avisos.length ? (
              <Table
                headers={["Aviso del día", "Vencimiento", "Mensaje", "Estado"]}
              >
                {data.avisos.map((a) => (
                  <tr key={a.id}>
                    <td>{fechaPlan(a.fecha)}</td>
                    <td>{fechaPlan(a.vence)}</td>
                    <td>
                      {a.dias_restantes === 0
                        ? "Tu membresía vence hoy."
                        : `Tu membresía vence en ${a.dias_restantes} días.`}
                    </td>
                    <td>
                      {a.resuelto
                        ? "Renovación registrada"
                        : "Recordatorio emitido"}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty>
                No hay recordatorios emitidos. Se generan diariamente desde
                cinco días antes del vencimiento.
              </Empty>
            )}
          </>
        )
      )}
    </section>
  );
}
export default function Notificaciones() {
  return (
    <>
      <PageTitle
        title="Notificaciones de membresía"
        description="Recordatorios diarios y opciones para renovar tu servicio."
      />
      <AvisosSuscripcion />
    </>
  );
}
