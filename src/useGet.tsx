import { DebounceSettings } from "lodash";
import { useContext, useEffect, useState } from "react";

import { Context, RestfulReactProviderProps } from "./Context";
import { GetState } from "./Get";
import { processResponse } from "./util/processResponse";

export interface UseGetProps<TData> {
  /**
   * The path at which to request data,
   * typically composed by parent Gets or the RestfulProvider.
   */
  path: string;
  /** Options passed into the fetch call. */
  requestOptions?: RestfulReactProviderProps["requestOptions"];
  /**
   * Don't send the error to the Provider
   */
  localErrorOnly?: boolean;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: (data: unknown) => TData;
  /**
   * Should we fetch data at a later stage?
   */
  lazy?: boolean;
  /**
   * An escape hatch and an alternative to `path` when you'd like
   * to fetch from an entirely different URL.
   *
   */
  base?: string;
  /**
   * How long do we wait between subsequent requests?
   * Uses [lodash's debounce](https://lodash.com/docs/4.17.10#debounce) under the hood.
   */
  debounce?:
    | {
        wait?: number;
        options: DebounceSettings;
      }
    | boolean
    | number;
}

async function fetchData<TData, TError>(
  props: UseGetProps<TData>,
  state: GetState<TData, TError>,
  setState: (newState: GetState<TData, TError>) => void,
  context: RestfulReactProviderProps,
  signal: AbortSignal,
) {
  const { base = context.base, path, resolve = (d: any) => d } = props;
  if (state.error || !state.loading) {
    setState({ ...state, error: null, loading: true });
  }

  const requestOptions =
    (typeof props.requestOptions === "function" ? props.requestOptions() : props.requestOptions) || {};
  requestOptions.headers = new Headers(requestOptions.headers);

  const request = new Request(`${base}${path}`, requestOptions);
  const response = await fetch(request, { signal });
  const { data, responseError } = await processResponse(response);

  if (signal.aborted) {
    return;
  } else if (!response.ok || responseError) {
    const error = {
      message: `Failed to fetch: ${response.status} ${response.statusText}${responseError ? " - " + data : ""}`,
      data,
    };

    setState({ ...state, loading: false, error });

    if (!props.localErrorOnly && context.onError) {
      context.onError(error, () => fetchData(props, state, setState, context, signal));
    }
  } else {
    setState({ ...state, loading: false, data: resolve(data) });
  }
}

export function useGet<TData = unknown, TError = unknown>(props: UseGetProps<TData>) {
  const context = useContext(Context);

  const [state, setState] = useState<GetState<TData, TError>>({
    data: null,
    response: null,
    loading: !props.lazy,
    error: null,
  });

  const abortController = new AbortController();
  const signal = abortController.signal;

  useEffect(
    () => {
      if (!props.lazy) {
        fetchData(props, state, setState, context, signal);
      }
      return () => abortController.abort();
    },
    [props.path, props.base, props.resolve],
  );

  // TODO deal with debounce
  // TODO use `url.resolve` to avoid trailing slash issues

  return { ...state, absolutePath: `${props.base}${props.path}` };
}
