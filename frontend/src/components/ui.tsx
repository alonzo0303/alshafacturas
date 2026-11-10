import {
  cloneElement,
  Children,
  useEffect,
  useRef,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="notice error">
      {message}
    </div>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  const numeric = headers.map((h) =>
    /^(Stock|Mínimo|Precio|Cantidad|Cant\.|Saldo|Total|Costo|Importe|Base|IGV)/i.test(
      h,
    ),
  );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h || i}
                className={numeric[i] ? "number" : undefined}
                scope="col"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Children.map(children, (row) => {
            if (!isValidElement(row)) return row;
            const tr = row as ReactElement<{ children: ReactNode }>;
            return cloneElement(tr, {
              children: Children.map(tr.props.children, (cell, i) => {
                if (!isValidElement(cell)) return cell;
                const td = cell as ReactElement<{ className?: string }>;
                return cloneElement(td, {
                  className: [td.props.className, numeric[i] ? "number" : ""]
                    .filter(Boolean)
                    .join(" "),
                });
              }),
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
export function Badge({
  children,
  neutral = false,
  danger = false,
}: {
  children: ReactNode;
  neutral?: boolean;
  danger?: boolean;
}) {
  return (
    <span className={`badge ${danger ? "danger" : neutral ? "neutral" : ""}`}>
      {children}
    </span>
  );
}
export function Form({
  onSave,
  children,
  label = "Guardar",
  onDone,
}: {
  onSave: (data: FormData) => Promise<unknown>;
  children: ReactNode;
  label?: string;
  onDone?: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await onSave(new FormData(form));
      form.reset();
      setSuccess("Guardado correctamente.");
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      <ErrorNotice message={error} />
      {children}
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          {busy ? "Guardando…" : label}
        </button>
        <span role="status">{success}</span>
      </div>
    </form>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="editor-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <div className="section-toolbar">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {children}
    </dialog>
  );
}
