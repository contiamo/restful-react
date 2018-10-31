import { GetDataError, ResolveFunction } from "../types";

export const resolveData = async <TData, TError>({
  data,
  resolve,
}: {
  data: any;
  resolve?: ResolveFunction<TData>;
}): Promise<{ data: TData | null; error: GetDataError<TError> | null }> => {
  let resolvedData: TData | null = null;
  let resolveError: GetDataError<TError> | null = null;
  try {
    if (resolve) {
      const resolvedDataOrPromise: TData | Promise<TData> = resolve(data);
      resolvedData = (resolvedDataOrPromise as { then?: any }).then
        ? ((await resolvedDataOrPromise) as TData)
        : (resolvedDataOrPromise as TData);
    } else {
      resolvedData = data;
    }
  } catch (err) {
    resolvedData = null;
    resolveError = {
      message: "RESOLVE_ERROR",
      data: JSON.stringify(err),
    };
  }
  return {
    data: resolvedData,
    error: resolveError,
  };
};
