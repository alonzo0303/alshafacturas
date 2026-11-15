import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlocker } from "react-router-dom";
import { Modal } from "../ui";
import { DirtyContext } from "../../lib/dirty";
export default function DirtyProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Set<string>());
  const [count, setCount] = useState(0),
    [intent, setIntent] = useState<(() => void) | null>(null);
  const mark = useCallback((key: string, value: boolean) => {
    const before = entries.current.size;
    if (value) entries.current.add(key);
    else entries.current.delete(key);
    if (before !== entries.current.size) setCount(entries.current.size);
  }, []);
  const dirty = count > 0;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!entries.current.size) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const confirm = (action: () => void) => {
    if (!dirty) action();
    else setIntent(() => action);
  };
  const blocked = blocker.state === "blocked";
  return (
    <DirtyContext.Provider
      value={{
        dirty,
        mark,
        confirm,
        discardAndRun: (action) => {
          entries.current.clear();
          setCount(0);
          action();
        },
      }}
    >
      {children}
      {(blocked || intent) && (
        <Modal
          title="Hay cambios sin guardar"
          onClose={() => {
            if (blocked) blocker.reset();
            setIntent(null);
          }}
        >
          <p>
            Si sales, perderás los cambios pendientes de esta página. Para
            guardarlos, vuelve al formulario.
          </p>
          <div className="form-actions">
            <button
              onClick={() => {
                if (blocked) blocker.reset();
                setIntent(null);
              }}
            >
              Seguir editando
            </button>
            <button
              className="danger-button"
              onClick={() => {
                const action = intent;
                setIntent(null);
                if (blocked) blocker.proceed();
                else action?.();
              }}
            >
              Salir sin guardar
            </button>
          </div>
        </Modal>
      )}
    </DirtyContext.Provider>
  );
}
