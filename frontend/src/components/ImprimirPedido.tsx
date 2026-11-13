import { date, money } from "../lib/api";
import type { Pedido } from "../lib/pedidos";
import ImpresionInterna from "./ImpresionInterna";
export default function ImprimirPedido({
  pedido: p,
  onClose,
}: {
  pedido: Pedido;
  onClose: () => void;
}) {
  return (
    <ImpresionInterna
      titulo={
        p.clase === "MESA"
          ? "Pedido de mesa"
          : "Hoja de preparación de artículos"
      }
      onClose={onClose}
    >
      <h2>{p.empresa?.razon_social}</h2>
      <p>
        {p.local?.nombre} · {p.local?.direccion}
      </p>
      <p>
        Pedido #{p.id} · {date(p.fecha)}
        {p.mesa ? ` · ${p.mesa}` : ""}
      </p>
      <p>
        Preparó: {p.usuario_nombre} · Estado: {p.estado}
      </p>
      <table>
        <thead>
          <tr>
            <th>Artículo / código</th>
            <th>Cantidad</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {p.lineas.map((l) => (
            <tr key={l.producto_id}>
              <td>
                {l.nombre}
                <small>{l.sku}</small>
              </td>
              <td>{l.cantidad}</td>
              <td>{money(l.cantidad * l.precio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Total de referencia:{" "}
        <strong>
          {money(p.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0))}
        </strong>
      </p>
      {p.observacion && <p>Observaciones: {p.observacion}</p>}
      <p>
        <strong>
          Documento interno · No acredita pago ni sustituye una guía de remisión
          electrónica.
        </strong>
      </p>
      <p>
        No reserva ni descuenta existencias. El stock se verifica al cobrar.
      </p>
    </ImpresionInterna>
  );
}
