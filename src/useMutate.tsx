import merge from "lodash/merge";
import { useContext, useEffect, useState } from "react";
import { Context } from "./Context";
import { MutateMethod, MutateState, MutateRequestOptions } from "./Mutate";
import { Omit, UseGetProps } from "./useGet";
import { constructUrl } from "./util/constructUrl";
import { processResponse } from "./util/processResponse";
import { useAbort } from "./useAbort";
import { useDeepCompareCallback, useDeepCompareEffect } from "./util/useDeepCompareEffect";

export interface UseMutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams>
  extends Omit<UseGetProps<TData, TError, TQueryParams, TPathParams>, "lazy" | "debounce" | "mock"> {
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
  /**
   * Developer mode
   * Override the state with some mocks values and avoid to fetch
   */
  mock?: {
    mutate?: MutateMethod<TData, TRequestBody, TQueryParams, TPathParams>;
    loading?: boolean;
  };
  /**
   * A function to encode body of DELETE requests when appending it
   * to an existing path
   */
  pathInlineBodyEncode?: typeof encodeURIComponent;
}

export interface UseMutateReturn<TData, TError, TRequestBody, TQueryParams, TPathParams>
  extends MutateState<TData, TError> {
  /**
   * Cancel the current fetch
   */
  cancel: () => void;
  /**
   * Call the mutate endpoint
   */
  mutate: MutateMethod<TData, TRequestBody, TQueryParams, TPathParams>;
}

export function useMutate<
  TData = any,
  TError = any,
  TQueryParams = { [key: string]: any },
  TRequestBody = any,
  TPathParams = unknown
>(
  props: UseMutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams>,
): UseMutateReturn<TData, TError, TRequestBody, TQueryParams, TPathParams>;

export function useMutate<
  TData = any,
  TError = any,
  TQueryParams = { [key: string]: any },
  TRequestBody = any,
  TPathParams = unknown
>(
  verb: UseMutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams>["verb"],
  path: UseMutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams>["path"],
  props?: Omit<UseMutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams>, "path" | "verb">,
): UseMutateReturn<TData, TError, TRequestBody, TQueryParams, TPathParams>;

export function useMutate<
  TData = any,
  TError = any,
  TQueryParams = { [key: string]: any },
  TRequestBody = any,
  TPathParams = unknown
>(): UseMutateReturn<TData, TError, TRequestBody, TQueryParams, TPathParams> {
  const props: UseMutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams> =
    typeof arguments[0] === "object" ? arguments[0] : { ...arguments[2], path: arguments[1], verb: arguments[0] };

  const context = useContext(Context);
  const { verb, base = context.base, path, queryParams = EMPTY_OBJECT, resolve = context.resolve, pathParams = EMPTY_OBJECT } = props;
  const isDelete = verb === "DELETE";

  const [state, setState] = useState<MutateState<TData, TError>>({
    error: null,
    loading: false,
  });

  const { abort, getAbortSignal } = useAbort();

  // Cancel the fetch on unmount
  useEffect(() => () => abort(), [abort]);

  const { pathInlineBodyEncode, queryParamStringifyOptions, requestOptions, localErrorOnly, onMutate } = props;

  const effectDependencies = [
    path,
    pathParams,
    queryParams,
    verb,
    isDelete,
    base,
    context,
    queryParamStringifyOptions,
    requestOptions,
    onMutate,
    abort,
    pathInlineBodyEncode,
    localErrorOnly,
    resolve,
  ];
  const mutate = useDeepCompareCallback<MutateMethod<TData, TRequestBody, TQueryParams, TPathParams>>(
    async (body: TRequestBody, mutateRequestOptions?: MutateRequestOptions<TQueryParams, TPathParams>) => {
      const signal = getAbortSignal();

      setState(prevState => {
        if (prevState.error || !prevState.loading) {
          return { ...prevState, loading: true, error: null };
        }
        return prevState;
      });

      const pathStr =
        typeof path === "function" ? path(mutateRequestOptions?.pathParams || (pathParams as TPathParams)) : path;

      const pathParts = [pathStr];

      const options: RequestInit = {
        method: verb,
      };

      // don't set content-type when body is of type FormData
      if (!(body instanceof FormData)) {
        options.headers = { "content-type": typeof body === "object" ? "application/json" : "text/plain" };
      }

      if (body instanceof FormData) {
        options.body = body;
      } else if (typeof body === "object") {
        options.body = JSON.stringify(body);
      } else if (isDelete && body !== undefined) {
        const possiblyEncodedBody = pathInlineBodyEncode ? pathInlineBodyEncode(String(body)) : String(body);

        pathParts.push(possiblyEncodedBody);
      } else {
        options.body = (body as unknown) as string;
      }

      const url = constructUrl(
        base,
        pathParts.join("/"),
        { ...context.queryParams, ...queryParams, ...mutateRequestOptions?.queryParams },
        {
          queryParamOptions: { ...context.queryParamStringifyOptions, ...queryParamStringifyOptions },
        },
      );

      const propsRequestOptions =
        (typeof requestOptions === "function" ? await requestOptions(url, verb, body) : requestOptions) || {};

      const contextRequestOptions =
        (typeof context.requestOptions === "function"
          ? await context.requestOptions(url, verb, body)
          : context.requestOptions) || {};

      const request = new Request(
        url,
        merge({}, contextRequestOptions, options, propsRequestOptions, mutateRequestOptions, { signal }),
      );
      if (context.onRequest) context.onRequest(request);

      let response: Response;
      try {
        response = await fetch(request);
        if (context.onResponse) context.onResponse(response.clone());
      } catch (e) {
        const error = {
          message: `Failed to fetch: ${e.message}`,
          data: "",
        };

        setState({
          error,
          loading: false,
        });

        if (!localErrorOnly && context.onError) {
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
        if (signal && signal.aborted) {
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

      if (signal && signal.aborted) {
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

        if (!localErrorOnly && context.onError) {
          context.onError(error, () => mutate(body), response);
        }

        throw error;
      }

      setState(prevState => ({ ...prevState, loading: false }));

      if (onMutate) {
        onMutate(body, data);
      }

      return data;
    },
    effectDependencies,
  );
  useDeepCompareEffect(() => {
    if (state.loading) {
      abort();
    }
  }, effectDependencies);

  return {
    ...state,
    mutate,
    ...props.mock,
    cancel: () => {
      setState(prevState => ({
        ...prevState,
        loading: false,
      }));
      abort();
    },
  };
}

// Declaring this in order to have a thing with stable identity
const EMPTY_OBJECT = {};
