import { useCallback, useRef } from "react";

function createAbortController() {
  try {
    return new AbortController();
  } catch {
    return undefined;
  }
}

export function useAbort() {
  const instance = useRef(createAbortController());

  const abort = useCallback(() => {
    if (instance && instance.current) {
      instance.current.abort();
      instance.current = createAbortController();
    }
  }, [instance]);

  return {
    abort,
    getAbortSignal() {
      return instance?.current?.signal;
    },
  };
}
