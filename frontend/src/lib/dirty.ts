import { createContext, useContext, useEffect, useId } from "react";
export type DirtyContextValue = {
  dirty: boolean;
  mark: (key: string, value: boolean) => void;
  confirm: (action: () => void) => void;
  discardAndRun: (action: () => void) => void;
};
export const DirtyContext = createContext<DirtyContextValue | null>(null);
export function useDirty() {
  return useContext(DirtyContext);
}
export function useUnsaved(value: boolean) {
  const ctx = useContext(DirtyContext),
    id = useId();
  const mark = ctx?.mark;
  useEffect(() => {
    mark?.(id, value);
    return () => mark?.(id, false);
  }, [mark, id, value]);
}
