import CobranzaAdmin from "../components/CobranzaAdmin";
import { AvisosSuscripcion } from "./Notificaciones";
import { useRef, useState } from "react";
import { api, money, localDay, type Empresa } from "../lib/api";
import { useData } from "../lib/useData";
import {
  Field,
  Form,
  ErrorNotice,
  Empty,
  PageTitle,
  Table,
  Badge,
} from "../components/ui";
export type Pago = {
  id: number;
  plan: string;
  importe: number;
  desde: string;
  hasta: string;
  referencia: string;
};
export type PlanState = {
  estadoSuscripcion?: "ACTIVO" | "PROGRAMADO" | "VENCIDO" | "SIN_PLAN";
  pagoReferencia?: Pago | null;
  pagoProximo?: Pago | null;
  fechaActual?: string;
  zonaHoraria?: string;
  instruccionesPago?: string;
  bloqueado?: boolean;
  propietarioId: number;
  empleadosActivos: number;
  cuposOcupados: number;
  cuposReservados: number;
  vigente: boolean;
  plan: string;
  limiteEmpleados: number;
  pagoActual: Pago | null;
  historial: Pago[];
  planes: {
    codigo: string;
    nombre: string;
    empleados: number;
    precio: number;
  }[];
};
function dateOnly(value: string) {
  return String(value).slice(0, 10).split("-").reverse().join("/");
}
export function PlanInfo({ plan }: { plan: PlanState }) {
  const pago = plan.pagoActual || plan.pagoReferencia;
  const estado =
    plan.estadoSuscripcion || (plan.vigente ? "ACTIVO" : "SIN_PLAN");
  const labels = {
    ACTIVO: "Activo",
    PROGRAMADO: "Programado",
    VENCIDO: "Vencido",
    SIN_PLAN: "Sin plan registrado",
  };
  return (
    <>
      <div className="plan-summary">
        <div>
          <small>Plan asignado</small>
          <strong>{pago ? plan.plan : "Sin pago vigente"}</strong>
        </div>
        <div>
          <small>Estado de membresía</small>
          <strong>{labels[estado]}</strong>
        </div>
        <div>
          <small>Cupos ocupados / límite</small>
          <strong>
            {plan.cuposOcupados ?? plan.empleadosActivos} /{" "}
            {plan.limiteEmpleados < 0 ? "Ilimitados" : plan.limiteEmpleados}
          </strong>
        </div>
        {pago && (
          <>
            <div>
              <small>Importe registrado</small>
              <strong>{money(pago.importe)}</strong>
            </div>
            <div>
              <small>Vigencia registrada</small>
              <strong>
                {dateOnly(pago.desde)} al {dateOnly(pago.hasta)}
              </strong>
            </div>
            <div>
              <small>Vencimiento a las 23:59 · Perú</small>
              <strong>{dateOnly(pago.hasta)}</strong>
            </div>
          </>
        )}
      </div>
      <p className="hint">
        El administrador principal no ocupa un cupo de empleado. Activos:{" "}
        {plan.empleadosActivos}. Reservados durante 15 días:{" "}
        {plan.cuposReservados || 0}. Los cupos no son un conteo de planes.
      </p>
      {estado === "PROGRAMADO" && (
        <p className="notice">
          El pago está registrado, pero su vigencia aún no empieza. No se cuenta
          como plan activo. Fecha de consulta:{" "}
          {plan.fechaActual ? dateOnly(plan.fechaActual) : "hoy"}, hora de Perú.
        </p>
      )}
      {estado === "VENCIDO" && (
        <p className="notice">
          La membresía está vencida. El servicio se restablece al confirmar un
          pago vigente.
          {plan.pagoProximo
            ? ` Hay una renovación programada desde ${dateOnly(plan.pagoProximo.desde)}.`
            : ""}
        </p>
      )}
      {estado === "SIN_PLAN" && (
        <p className="notice">
          Alta inicial sin contrato de pago. El administrador principal puede
          configurar el negocio; el personal requiere un plan vigente.
        </p>
      )}
    </>
  );
}
function Historial({ plan }: { plan: PlanState }) {
  return plan.historial.length ? (
    <Table headers={["Plan", "Importe", "Desde", "Hasta", "Referencia"]}>
      {plan.historial.map((p) => (
        <tr key={p.id}>
          <td>{p.plan}</td>
          <td>{money(p.importe)}</td>
          <td>{dateOnly(p.desde)}</td>
          <td>{dateOnly(p.hasta)}</td>
          <td>{p.referencia}</td>
        </tr>
      ))}
    </Table>
  ) : (
    <Empty>No se han registrado pagos.</Empty>
  );
}
export function MiPlan() {
  const { data, error, loading, refresh } = useData(
    () => api<PlanState>("/plan"),
    null,
  );
  return (
    <>
      <PageTitle
        title="Mi plan y pagos"
        description="Revisa la vigencia y los cupos habilitados para tu personal."
      />
      <ErrorNotice message={error} />
      {loading ? (
        <p role="status">Cargando plan…</p>
      ) : (
        data && (
          <>
            <section className="surface">
              <PlanInfo plan={data} />
              <button onClick={() => void refresh()}>Actualizar</button>
            </section>
            <section className="surface">
              <h2>Planes disponibles</h2>
              <Table
                headers={[
                  "Plan",
                  "Personal incluido",
                  "Importe por período registrado",
                ]}
              >
                {data.planes.map((p) => (
                  <tr key={p.codigo}>
                    <td>{p.codigo}</td>
                    <td>{p.nombre}</td>
                    <td>{money(p.precio)}</td>
                  </tr>
                ))}
              </Table>
            </section>
            <section className="surface">
              <h2>Historial de pagos registrados</h2>
              <Historial plan={data} />
            </section>
          </>
        )
      )}
    </>
  );
}
export function PagosAdmin() {
  const companies = useData(() => api<Empresa[]>("/empresas"), []),
    [empresa, setEmpresa] = useState(""),
    [state, setState] = useState<PlanState | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [codigo, setCodigo] = useState("INICIO"),
    generation = useRef(0);
  async function choose(value: string) {
    setEmpresa(value);
    setState(null);
    setError("");
    const current = ++generation.current;
    if (!value) return;
    setLoading(true);
    try {
      const result = await api<PlanState>(`/empresas/${value}/plan`);
      if (current === generation.current) setState(result);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  const [today] = useState(() => localDay(new Date().toISOString()));
  const selected = state?.planes.find((p) => p.codigo === codigo);
  return (
    <>
      <PageTitle
        title="Planes y pagos de empresas"
        description="Confirma pagos recibidos, define su vigencia y controla los cupos. No se realizan cargos automáticos."
      />
      <ErrorNotice message={companies.error || error} />
      <CobranzaAdmin key={state?.historial[0]?.id || "inicial"} />
      <section className="surface">
        <Field label="Negocio para gestionar el plan">
          <select value={empresa} onChange={(e) => void choose(e.target.value)}>
            <option value="">Selecciona un negocio</option>
            {companies.data
              .filter((e) => e.ruc !== "00000000000")
              .map((e) => (
                <option value={e.id} key={e.id}>
                  #{e.id} · {e.razonSocial} · {e.ruc || "Sin RUC"}
                </option>
              ))}
          </select>
        </Field>
      </section>
      {loading ? (
        <p role="status">Consultando pagos…</p>
      ) : (
        state && (
          <>
            <section className="surface">
              <PlanInfo plan={state} />
              <button onClick={() => void choose(empresa)}>
                Actualizar plan
              </button>
            </section>
            <section className="surface">
              <h2>Registrar un pago recibido</h2>
              <p className="compact-note">
                Registra únicamente pagos que hayas recibido y verificado. Cada
                registro habilita el plan durante las fechas indicadas.
              </p>
              <p className="hint">
                Seleccionar el plan no registra un pago. Completa referencia,
                confirmación y toda la vigencia acordada. El acceso termina a
                las 23:59 de la fecha final, hora de Perú.
              </p>
              <Form
                key={empresa}
                label="Confirmar pago recibido"
                onSave={async (d) => {
                  const current = generation.current;
                  const updated = await api<PlanState>(
                    `/empresas/${empresa}/pagos`,
                    "POST",
                    {
                      plan: codigo,
                      importe: selected?.precio,
                      desde: d.get("desde"),
                      hasta: d.get("hasta"),
                      referencia: d.get("referencia"),
                      confirmado: d.get("confirmado") === "on",
                    },
                  );
                  if (
                    String(updated.propietarioId) &&
                    generation.current === current
                  )
                    setState(updated);
                }}
              >
                <div className="form-grid">
                  <Field label="Plan contratado">
                    <select
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                    >
                      {state.planes.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {money(p.precio)} · {p.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Importe recibido (S/)">
                    <input readOnly value={selected?.precio ?? ""} />
                  </Field>
                  <Field label="Vigencia desde">
                    <input
                      name="desde"
                      type="date"
                      required
                      defaultValue={state.fechaActual?.slice(0, 10) || today}
                    />
                  </Field>
                  <Field label="Vigencia hasta">
                    <input name="hasta" type="date" required />
                  </Field>
                  <Field label="Referencia del pago">
                    <input
                      name="referencia"
                      maxLength={120}
                      required
                      placeholder="Referencia verificada o recibo interno"
                    />
                  </Field>
                </div>
                <label className="check">
                  <input type="checkbox" name="confirmado" required />
                  Confirmo que el pago fue recibido y verificado
                </label>
                <Badge neutral>Importe y cupos se validan en el servidor</Badge>
              </Form>
            </section>
            <AvisosSuscripcion key={empresa} empresaId={Number(empresa)} />
            <section className="surface">
              <h2>Historial del negocio</h2>
              <Historial plan={state} />
            </section>
          </>
        )
      )}
    </>
  );
}
