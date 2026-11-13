import { useDirty } from "../lib/dirty";
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
  const scroll = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    offset: 0,
    max: 0,
    overflow: false,
    start: true,
    end: true,
  });
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const update = () =>
      setPosition({
        offset: element.scrollLeft,
        max: Math.max(0, element.scrollWidth - element.clientWidth),
        overflow: element.scrollWidth > element.clientWidth + 1,
        start: element.scrollLeft < 1,
        end:
          element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [children]);
  const numeric = headers.map((h) =>
    /^(Stock|Mínimo|Precio|Cantidad|Cant\.|Saldo|Total|Costo|Importe|Base|IGV)/i.test(
      h,
    ),
  );
  return (
    <div className="table-container">
      {position.overflow && (
        <div className="table-controls">
          <small>Arrastra la barra inferior o usa las flechas</small>
          <button
            type="button"
            aria-label="Columnas anteriores"
            disabled={position.start}
            onClick={() => scroll.current?.scrollBy({ left: -240 })}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Más columnas"
            disabled={position.end}
            onClick={() => scroll.current?.scrollBy({ left: 240 })}
          >
            →
          </button>
        </div>
      )}
      <div
        ref={scroll}
        className="table-scroll"
        role="region"
        aria-label={`Tabla: ${headers.join(", ")}`}
        tabIndex={0}
      >
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
      {position.overflow && (
        <div className="table-slider">
          <label>
            <span className="sr-only">
              Desplazar columnas de {headers.join(", ")}
            </span>
            <input
              className="table-range"
              type="range"
              min={0}
              max={position.max}
              step={1}
              value={Math.round(position.offset)}
              aria-valuetext={`${Math.round(position.max ? (position.offset / position.max) * 100 : 0)}% de desplazamiento`}
              onChange={(e) => {
                if (scroll.current)
                  scroll.current.scrollLeft = Number(e.target.value);
              }}
            />
          </label>
        </div>
      )}
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
const formSignature = (form: HTMLFormElement) =>
  JSON.stringify(
    [...new FormData(form).entries()].map(([k, v]) => [
      k,
      typeof v === "string" ? v : `${v.name}:${v.size}:${v.lastModified}`,
    ]),
  );
export function Form({
  onSave,
  children,
  label = "Guardar",
  onDone,
  disabled = false,
}: {
  onSave: (data: FormData) => Promise<unknown>;
  children: ReactNode;
  label?: string;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const draft = useDirty(),
    draftId = useId(),
    formRef = useRef<HTMLFormElement>(null),
    baseline = useRef("");

  const mark = draft?.mark;
  useEffect(() => {
    if (formRef.current) baseline.current = formSignature(formRef.current);
    return () => mark?.(draftId, false);
  }, [mark, draftId]);
  const changed = () =>
    queueMicrotask(() => {
      if (formRef.current)
        mark?.(draftId, formSignature(formRef.current) !== baseline.current);
    });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || busy) return;
    const form = e.currentTarget;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await onSave(new FormData(form));
      form.reset();
      baseline.current = formSignature(form);
      mark?.(draftId, false);
      setSuccess("Guardado correctamente.");
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onInputCapture={changed}
      onChangeCapture={changed}
      data-saving={busy}
      className="form"
    >
      <ErrorNotice message={error} />
      {children}
      <div className="form-actions">
        <button className="primary" disabled={busy || disabled}>
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
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
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
