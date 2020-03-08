import { useCallback, useState } from "react";

export function useAbort() {
  let abortController;

  try {
    abortController = new AbortController();
  } catch {
    abortController = null;
  }

  const [instance, setInstance] = useState(abortController);

  const abort = useCallback(() => {
    if (instance) {
      instance.abort();
      setInstance(new AbortController());
    }
  }, [instance]);

  return {
    abort,
    signal: instance?.signal,
  };
}
