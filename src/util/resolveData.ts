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
    resolvedData = await (resolve?.(data) ?? data);
  } catch (err) {
    resolvedData = null;
    resolveError = {
      message: "RESOLVE_ERROR",
      data: (JSON.stringify(err) as unknown) as TError,
    };
  }
  return {
    data: resolvedData,
    error: resolveError,
  };
};
