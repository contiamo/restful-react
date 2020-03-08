import { useCallback, useState } from "react";

export function useAbort() {
  const [abortController, setAbortController] = useState(AbortController ? new AbortController() : null);

  const abort = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(new AbortController());
    }
  }, [abortController]);

  return {
    abort,
    signal: abortController?.signal,
  };
}
