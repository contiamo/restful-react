import merge from "lodash/merge";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Context } from "./Context";
import { MutateMethod, MutateState } from "./Mutate";
import { Omit, resolvePath, UseGetProps } from "./useGet";
import { processResponse } from "./util/processResponse";

export interface UseMutateProps<TData, TQueryParams, TRequestBody>
  extends Omit<UseGetProps<TData, TQueryParams>, "lazy" | "debounce"> {
  /**
   * What HTTP verb are we using?
   */
  verb: "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * Callback called after the mutation is done.
   *
   * @param body - Body given to mutate
   * @param data - Response data
   */
  onMutate?: (body: TRequestBody, data: TData) => void;
}

export interface UseMutateReturn<TData, TError, TRequestBody> extends MutateState<TData, TError> {
  /**
   * Cancel the current fetch
   */
  cancel: () => void;
  /**
   * Call the mutate endpoint
   */
  mutate: MutateMethod<TData, TRequestBody>;
}

export function useMutate<TData = any, TError = any, TQueryParams = { [key: string]: any }, TRequestBody = any>(
  props: UseMutateProps<TData, TQueryParams, TRequestBody>,
): UseMutateReturn<TData, TError, TRequestBody>;

export function useMutate<TData = any, TError = any, TQueryParams = { [key: string]: any }, TRequestBody = any>(
  verb: UseMutateProps<TData, TQueryParams, TRequestBody>["verb"],
  path: string,
  props?: Omit<UseMutateProps<TData, TQueryParams, TRequestBody>, "path" | "verb">,
): UseMutateReturn<TData, TError, TRequestBody>;

export function useMutate<
  TData = any,
  TError = any,
  TQueryParams = { [key: string]: any },
  TRequestBody = any
>(): UseMutateReturn<TData, TError, TRequestBody> {
  const props: UseMutateProps<TData, TQueryParams, TRequestBody> =
    typeof arguments[0] === "object" ? arguments[0] : { ...arguments[2], path: arguments[1], verb: arguments[0] };

  const context = useContext(Context);
  const { verb, base = context.base, path, queryParams = {}, resolve } = props;
  const isDelete = verb === "DELETE";

  const [state, setState] = useState<MutateState<TData, TError>>({
    error: null,
    loading: false,
  });

  const abortController = useRef(new AbortController());

  // Cancel the fetch on unmount
  useEffect(() => () => abortController.current.abort(), []);

  const mutate = useCallback<MutateMethod<TData, TRequestBody>>(
    async (body: TRequestBody, mutateRequestOptions?: RequestInit) => {
      if (state.error || !state.loading) {
        setState(prevState => ({ ...prevState, loading: true, error: null }));
      }

      if (state.loading) {
        // Abort previous requests
        abortController.current.abort();
        abortController.current = new AbortController();
      }
      const signal = abortController.current.signal;

      const propsRequestOptions =
        (typeof props.requestOptions === "function" ? await props.requestOptions() : props.requestOptions) || {};

      const contextRequestOptions =
        (typeof context.requestOptions === "function" ? await context.requestOptions() : context.requestOptions) || {};

      const options: RequestInit = {
        method: verb,
        headers: {
          "content-type": typeof body === "object" ? "application/json" : "text/plain",
        },
      };

      if (!isDelete) {
        options.body = typeof body === "object" ? JSON.stringify(body) : ((body as unknown) as string);
      }

      const request = new Request(
        resolvePath(base, isDelete ? `${path}/${body}` : path, { ...context.queryParams, ...queryParams }),
        merge({}, contextRequestOptions, options, propsRequestOptions, mutateRequestOptions, { signal }),
      );

      let response: Response;
      try {
        response = await fetch(request);
      } catch (e) {
        const error = {
          message: `Failed to fetch: ${e.message}`,
          data: "",
        };

        setState({
          error,
          loading: false,
        });

        if (!props.localErrorOnly && context.onError) {
          context.onError(error, () => mutate(body, mutateRequestOptions));
        }

        throw error;
      }

      const { data: rawData, responseError } = await processResponse(response);

      let data: TData | any; // `any` -> data in error case
      try {
        data = resolve ? resolve(rawData) : rawData;
      } catch (e) {
        // avoid state updates when component has been unmounted
        // and when fetch/processResponse threw an error
        if (signal.aborted) {
          return;
        }

        const error = {
          data: e.message,
          message: `Failed to resolve: ${e.message}`,
        };

        setState(prevState => ({
          ...prevState,
          error,
          loading: false,
        }));
        throw e;
      }

      if (signal.aborted) {
        return;
      }

      if (!response.ok || responseError) {
        const error = {
          data,
          message: `Failed to fetch: ${response.status} ${response.statusText}`,
          status: response.status,
        };

        setState(prevState => ({
          ...prevState,
          error,
          loading: false,
        }));

        if (!props.localErrorOnly && context.onError) {
          context.onError(error, () => mutate(body), response);
        }

        throw error;
      }

      setState(prevState => ({ ...prevState, loading: false }));

      if (props.onMutate) {
        props.onMutate(body, data);
      }

      return data;
    },
    [context.base, context.requestOptions, context.resolve, state.error, state.loading, path],
  );

  return {
    ...state,
    mutate,
    cancel: () => {
      setState(prevState => ({
        ...prevState,
        loading: false,
      }));
      abortController.current.abort();
      abortController.current = new AbortController();
    },
  };
}
