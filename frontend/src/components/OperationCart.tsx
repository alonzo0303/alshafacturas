import { money, type Producto } from "../lib/api";
import { Table, Empty } from "./ui";
export type CartLine = { producto: Producto; cantidad: number; costo: number };
export default function OperationCart({
  lines,
  purchase,
  busy,
  onChange,
  onRemove,
}: {
  lines: CartLine[];
  purchase: boolean;
  busy: boolean;
  onChange: (id: number, field: "cantidad" | "costo", value: number) => void;
  onRemove: (id: number) => void;
}) {
  return lines.length ? (
    <Table
      headers={[
        "Producto",
        "Cantidad",
        purchase ? "Costo unitario" : "Importe",
        "Acciones",
      ]}
    >
      {lines.map((l) => (
        <tr key={l.producto.id}>
          <td>
            {l.producto.nombre}
            <small>
              {l.producto.marca} · {l.producto.presentacion || l.producto.sku}
            </small>
            {purchase && l.producto.ultimo_costo != null && (
              <small>
                Último costo neto: {money(l.producto.ultimo_costo)} (referencia)
              </small>
            )}
          </td>
          <td>
            <input
              aria-label={`Cantidad de ${l.producto.nombre}`}
              className="quantity"
              type="number"
              required
              min="1"
              max="100000"
              value={l.cantidad || ""}
              onChange={(e) =>
                onChange(l.producto.id, "cantidad", Number(e.target.value))
              }
              disabled={busy}
            />
          </td>
          <td>
            {purchase ? (
              <input
                aria-label={`Costo de ${l.producto.nombre}`}
                className="cost"
                type="number"
                required
                min="0.01"
                max="999999999.99"
                step="0.01"
                value={l.costo || ""}
                onChange={(e) =>
                  onChange(l.producto.id, "costo", Number(e.target.value))
                }
                disabled={busy}
              />
            ) : (
              money(l.cantidad * l.producto.precio)
            )}
          </td>
          <td>
            <button
              type="button"
              disabled={busy}
              aria-label={`Quitar ${l.producto.nombre}`}
              onClick={() => onRemove(l.producto.id)}
            >
              Quitar
            </button>
          </td>
        </tr>
      ))}
    </Table>
  ) : (
    <Empty>Añade productos del catálogo para empezar.</Empty>
  );
}
