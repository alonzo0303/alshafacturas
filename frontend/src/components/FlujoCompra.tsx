import { Link } from "react-router-dom";
import { can, useSession } from "../lib/session";
export default function FlujoCompra({ paso }: { paso: 1 | 2 | 3 }) {
  const s = useSession(),
    prefix = s.modalidad === "ATENCION" ? "/atencion" : "/panel";
  const steps = [
    {
      n: 1,
      titulo: "Registrar compra",
      detalle: "Pedido al proveedor · OC automática",
      url: `${prefix}/compra`,
    },
    {
      n: 2,
      titulo: "Órdenes y recepción",
      detalle: "Verificar mercadería · Aprobar ingreso",
      url:
        s.modalidad === "ATENCION"
          ? "/atencion/ordenes-compra"
          : "/panel/ordenes-compra",
    },
    {
      n: 3,
      titulo: "Compras recibidas",
      detalle: "Compra final · Stock disponible",
      url: `${prefix}/compras`,
    },
  ];
  return (
    <section
      aria-label="Pasos del proceso de compra"
      className="purchase-steps"
    >
      <ol>
        {steps.map((step) => (
          <li key={step.n} aria-current={paso === step.n ? "step" : undefined}>
            {step.n === 1 && !can(s, "COMPRAS_GESTIONAR") ? (
              <span className="purchase-step-disabled">
                <strong>
                  {step.n}. {step.titulo}
                </strong>
                <small>{step.detalle}</small>
              </span>
            ) : (
              <Link to={step.url}>
                <strong>
                  {step.n}. {step.titulo}
                </strong>
                <small>{step.detalle}</small>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
