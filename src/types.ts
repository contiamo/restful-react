// Shared types across exported components and utils
//
/**
 * A function that resolves returned data from
 * a fetch call.
 */
export type ResolveFunction<T> = ((data: any) => T) | ((data: any) => Promise<T>);

export interface GetDataError<TError> {
  message: string;
  data: TError | string;
}
