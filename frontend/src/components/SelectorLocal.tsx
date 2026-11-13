import { useEffect, useState } from "react";
import { api, type Session } from "../lib/api";
import { useData } from "../lib/useData";
import { useDirty } from "../lib/dirty";
import { Field, ErrorNotice } from "./ui";
export default function SelectorLocal({ session }: { session: Session }) {
  const drafts = useDirty();
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
            onChange={(e) => {
              const localId = Number(e.target.value);
              const change = async () => {
                setBusy(true);
                setMessage("");
                try {
                  await api("/locales/seleccionar", "POST", { localId });
                  const leave = () =>
                    window.location.assign(
                      session.modalidad === "ATENCION" ? "/atencion" : "/panel",
                    );
                  if (drafts) drafts.discardAndRun(leave);
                  else leave();
                } catch (error) {
                  setMessage((error as Error).message);
                  setBusy(false);
                }
              };
              if (drafts) drafts.confirm(() => void change());
              else void change();
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
