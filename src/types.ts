// Shared types across exported components and utils
//
/**
 * A function that resolves returned data from
 * a fetch call.
 */
export type ResolveFunction<TData> = (data: any) => TData | Promise<TData>;

/**
 * A function that resolves returned data from
 * a fetch call and the previous resolved data
 */
export type PollResolveFunction<TData> = (data: any, prevData: TData | null) => TData;

export interface GetDataError<TError> {
  message: string;
  data?: TError;
  status?: number;
}
