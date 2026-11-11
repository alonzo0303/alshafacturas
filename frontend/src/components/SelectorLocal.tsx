import { useEffect, useState } from "react";
import { api, type Session } from "../lib/api";
import { useData } from "../lib/useData";
import { Field, ErrorNotice } from "./ui";
export default function SelectorLocal({ session }: { session: Session }) {
  const { data, error, refresh } = useData(
    () => api<{ id: number; nombre: string }[]>("/locales"),
    [],
  );
  useEffect(() => {
    const update = () => void refresh();
    window.addEventListener("locales-updated", update);
    return () => window.removeEventListener("locales-updated", update);
  }, [refresh]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div>
      <ErrorNotice message={error || message} />
      {data.length > 1 ? (
        <Field label="Local de trabajo">
          <select
            disabled={busy}
            value={session.localId || ""}
            onChange={async (e) => {
              setBusy(true);
              try {
                await api("/locales/seleccionar", "POST", {
                  localId: Number(e.target.value),
                });
                window.location.assign(
                  session.modalidad === "ATENCION" ? "/atencion" : "/panel",
                );
              } catch (e) {
                setMessage((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <small>{session.localNombre}</small>
      )}
    </div>
  );
}
