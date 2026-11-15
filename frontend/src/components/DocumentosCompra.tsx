import { useState } from "react";
import { api, binary, downloadFile, date } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, Form, ErrorNotice, Table } from "./ui";
type Documento = {
  id: number;
  nombre: string;
  clase: string;
  tipo: string;
  bytes: number;
  fecha: string;
};
export default function DocumentosCompra({
  tipo,
  id,
}: {
  tipo: "compras" | "ordenes-compra";
  id: number;
}) {
  const { data, error, loading, refresh } = useData(
    () => api<Documento[]>(`/${tipo}/${id}/documentos`),
    [],
  );
  const [failure, setFailure] = useState("");
  return (
    <section className="surface">
      <h3>Documentos vinculados</h3>
      <ErrorNotice message={error || failure} />
      <Form
        label="Subir documento"
        onSave={async (d) => {
          const file = d.get("archivo") as File;
          if (!file.size || file.size > 10 * 1024 * 1024)
            throw new Error("Elige un PDF, JPG o PNG de hasta 10 MB.");
          if (
            !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
          )
            throw new Error("Usa PDF, JPG o PNG.");
          await binary(
            `/${tipo}/${id}/documentos?nombre=${encodeURIComponent(file.name)}&clase=${encodeURIComponent(String(d.get("clase")))}`,
            "PUT",
            file,
          );
        }}
        onDone={() => void refresh()}
      >
        <div className="form-grid">
          <Field label="Clase del documento de compra">
            <select name="clase">
              <option value="FACTURA">Factura del proveedor</option>
              <option value="ORDEN_COMPRA">Orden de compra</option>
              <option value="OTRO">Otro documento</option>
            </select>
          </Field>
          <Field label="Archivo de compra">
            <input
              name="archivo"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
            />
          </Field>
        </div>
        <p className="hint">
          Hasta 10 documentos por registro. Se descargan como archivos privados;
          no se ejecutan dentro de AlshaFacturas.
        </p>
      </Form>
      {loading ? (
        <p role="status">Cargando documentos…</p>
      ) : (
        <Table headers={["Documento", "Clase", "Fecha", "Tamaño", "Acciones"]}>
          {data.map((d) => (
            <tr key={d.id}>
              <td>{d.nombre}</td>
              <td>{d.clase}</td>
              <td>{date(d.fecha)}</td>
              <td>{Math.ceil(d.bytes / 1024)} KB</td>
              <td>
                <button
                  onClick={async () => {
                    setFailure("");
                    try {
                      await downloadFile(
                        `/documentos-compra/${d.id}`,
                        d.nombre,
                      );
                    } catch (e) {
                      setFailure((e as Error).message);
                    }
                  }}
                >
                  Descargar<span className="sr-only"> {d.nombre}</span>
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
