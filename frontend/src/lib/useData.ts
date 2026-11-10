import { useEffect, useRef, useState } from "react";
export function useData<T>(load: () => Promise<T>, initial: T) {
  // Each mounted page owns one loader. Reloads are explicit to avoid requests on every render.
  const loader = useRef(load);
  const [data, setData] = useState(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = async () => {
    const current = ++generation.current;
    setError("");
    setLoading(true);
    try {
      const value = await loader.current();
      if (current === generation.current) setData(value);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    const token = generation;
    const current = ++token.current;
    loader
      .current()
      .then((value) => {
        if (current === generation.current) setData(value);
      })
      .catch((e) => {
        if (current === generation.current) setError(e.message);
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    return () => {
      ++token.current;
    };
  }, []);
  return { data, error, loading, refresh };
}
