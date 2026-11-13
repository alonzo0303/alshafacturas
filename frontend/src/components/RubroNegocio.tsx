import { useState } from "react";
import { api } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, ErrorNotice } from "./ui";
import SearchChoice from "./SearchChoice";
export default function RubroNegocio({
  initial = "",
  local = false,
}: {
  initial?: string | null;
  local?: boolean;
}) {
  const { data, error, loading } = useData(
    () => api<string[]>("/rubros-negocio"),
    [],
  );
  const [value, setValue] = useState(initial || "");
  return (
    <div>
      <ErrorNotice message={error} />
      <input type="hidden" name="rubroNegocio" value={value} />
      <Field
        label={
          local ? "Rubro / giro de la sucursal" : "Rubro / giro de negocio"
        }
      >
        <SearchChoice
          value={value}
          onChange={setValue}
          options={data}
          emptyLabel={
            local ? "Heredar rubro del negocio" : "Sin rubro principal"
          }
        />
      </Field>
      {loading ? (
        <p role="status">Cargando rubros…</p>
      ) : (
        <p className="hint">
          Seleccionar un rubro habilita su catálogo común. Los productos y
          servicios propios se conservan.
          {local
            ? " La sucursal puede usar un rubro distinto."
            : " Sin rubro principal se conserva la asignación avanzada de rubros."}
        </p>
      )}
    </div>
  );
}
