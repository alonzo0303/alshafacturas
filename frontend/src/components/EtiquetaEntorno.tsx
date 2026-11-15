import { api } from "../lib/api";
import { useData } from "../lib/useData";
export default function EtiquetaEntorno() {
  const { data, error } = useData(
    () => api<{ entorno: string }>("/entorno"),
    null,
  );
  if (error) return <small>Entorno sin verificar</small>;
  if (!data) return null;
  return (
    <small className="environment-label">
      {data.entorno === "PRUEBAS"
        ? "PRUEBAS · Datos ficticios"
        : data.entorno === "PRODUCCION"
          ? "Producción"
          : "Desarrollo"}
    </small>
  );
}
