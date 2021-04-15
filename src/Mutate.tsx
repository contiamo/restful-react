import * as React from "react";
import RestfulReactProvider, { InjectedProps, RestfulReactConsumer, RestfulReactProviderProps } from "./Context";
import { GetState, ResolveFunction } from "./Get";
import { composePath, composeUrl } from "./util/composeUrl";
import { processResponse } from "./util/processResponse";
import { constructUrl } from "./util/constructUrl";
import { IStringifyOptions } from "qs";

/**
 * An enumeration of states that a fetchable
 * view could possibly have.
 */
export interface States<TData, TError> {
  /** Is our view currently loading? */
  loading: boolean;
  /** Do we have an error in the view? */
  error?: GetState<TData, TError>["error"];
}

export interface MutateRequestOptions<TQueryParams, TPathParams> extends RequestInit {
  /**
   * Query parameters
   */
  queryParams?: TQueryParams;
  /**
   * Path parameters
   */
  pathParams?: TPathParams;
}

export type MutateMethod<TData, TRequestBody, TQueryParams, TPathParams> = (
  data: TRequestBody,
  mutateRequestOptions?: MutateRequestOptions<TQueryParams, TPathParams>,
) => Promise<TData>;

/**
 * Meta information returned to the fetchable
 * view.
 */
export interface Meta {
  /** The absolute path of this request. */
  absolutePath: string;
}

/**
 * Props for the <Mutate /> component.
 */
export interface MutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams> {
  /**
   * The path at which to request data,
   * typically composed by parents or the RestfulProvider.
   */
  path?: string;
  /**
   * @private This is an internal implementation detail in restful-react, not meant to be used externally.
   * This helps restful-react correctly override `path`s when a new `base` property is provided.
   */
  __internal_hasExplicitBase?: boolean;
  /**
   * What HTTP verb are we using?
   */
  verb: "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * Query parameters
   */
  queryParams?: TQueryParams;
  /**
   * Query parameter stringify options
   */
  queryParamStringifyOptions?: IStringifyOptions;
  /**
   * An escape hatch and an alternative to `path` when you'd like
   * to fetch from an entirely different URL.
   *
   */
  base?: string;
  /**
   * The accumulated path from each level of parent GETs
   *  taking the absolute and relative nature of each path into consideration
   */
  parentPath?: string;
  /** Options passed into the fetch call. */
  requestOptions?: RestfulReactProviderProps["requestOptions"];
  /**
   * Don't send the error to the Provider
   */
  localErrorOnly?: boolean;
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (
    mutate: MutateMethod<TData, TRequestBody, TQueryParams, TPathParams>,
    states: States<TData, TError>,
    meta: Meta,
  ) => React.ReactNode;
  /**
   * Callback called after the mutation is done.
   *
   * @param body - Body given to mutate
   * @param data - Response data
   */
  onMutate?: (body: TRequestBody, data: TData) => void;
  /**
   * A function to encode body of DELETE requests when appending it
   * to an existing path
   */
  pathInlineBodyEncode?: typeof encodeURIComponent;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<TData>;
}

/**
 * State for the <Mutate /> component. These
 * are implementation details and should be
 * hidden from any consumers.
 */
export interface MutateState<TData, TError> {
  error: GetState<TData, TError>["error"];
  loading: boolean;
}

/**
 * The <Mutate /> component without Context. This
 * is a named class because it is useful in
 * debugging.
 */
class ContextlessMutate<TData, TError, TQueryParams, TRequestBody, TPathParams> extends React.Component<
  MutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams> & InjectedProps,
  MutateState<TData, TError>
> {
  public readonly state: Readonly<MutateState<TData, TError>> = {
    loading: false,
    error: null,
  };

  public static defaultProps = {
    base: "",
    parentPath: "",
    path: "",
    queryParams: {},
  };

  /**
   * Abort controller to cancel the current fetch query
   */
  private abortController = new AbortController();
  private signal = this.abortController.signal;

  public componentWillUnmount() {
    this.abortController.abort();
  }

  public mutate = async (
    body: TRequestBody,
    mutateRequestOptions?: MutateRequestOptions<TQueryParams, TPathParams>,
  ) => {
    const {
      __internal_hasExplicitBase,
      base,
      parentPath,
      path,
      verb,
      requestOptions: providerRequestOptions,
      onError,
      onRequest,
      onResponse,
      pathInlineBodyEncode,
      resolve,
    } = this.props;
    this.setState(() => ({ error: null, loading: true }));

    const makeRequestPath = () => {
      const pathWithPossibleBody =
        verb === "DELETE" && typeof body === "string"
          ? composePath(path, pathInlineBodyEncode ? pathInlineBodyEncode(body) : body)
          : path;

      const concatPath = __internal_hasExplicitBase
        ? pathWithPossibleBody || ""
        : composePath(parentPath, pathWithPossibleBody);

      return constructUrl(base!, concatPath, this.props.queryParams, {
        stripTrailingSlash: true,
        queryParamOptions: this.props.queryParamStringifyOptions,
      });
    };

    const request = new Request(makeRequestPath(), {
      method: verb,
      body: body instanceof FormData ? body : typeof body === "object" ? JSON.stringify(body) : body,
      ...(typeof providerRequestOptions === "function"
        ? await providerRequestOptions<TRequestBody>(makeRequestPath(), verb, body)
        : providerRequestOptions),
      ...mutateRequestOptions,
      headers: {
        ...(typeof providerRequestOptions === "function"
          ? (await providerRequestOptions<TRequestBody>(makeRequestPath(), verb, body)).headers
          : (providerRequestOptions || {}).headers),
        ...(mutateRequestOptions ? mutateRequestOptions.headers : {}),
      },
    } as RequestInit); // Type assertion for version of TypeScript that can't yet discriminate.

    // only set default content-type if body is not of type FormData and there is no content-type already defined on mutateRequestOptions.headers
    if (!(body instanceof FormData) && !request.headers.has("content-type")) {
      request.headers.set("content-type", typeof body === "object" ? "application/json" : "text/plain");
    }

    if (onRequest) onRequest(request);

    let response: Response;
    try {
      response = await fetch(request, { signal: this.signal });
      if (onResponse) onResponse(response.clone());
    } catch (e) {
      const error = {
        message: `Failed to fetch: ${e.message}`,
        data: "",
      };

      this.setState({
        error,
        loading: false,
      });

      if (!this.props.localErrorOnly && onError) {
        onError(error, () => this.mutate(body, mutateRequestOptions));
      }

      throw error;
    }

    const { data: rawData, responseError } = await processResponse(response);

    let data: TData | any; // `any` -> data in error case
    try {
      data = resolve ? resolve(rawData) : rawData;
    } catch (e) {
      if (this.signal.aborted) {
        return;
      }
      const error = {
        data: e.message,
        message: `Failed to resolve: ${e.message}`,
      };

      this.setState({
        error,
        loading: false,
      });
      throw e;
    }

    // avoid state updates when component has been unmounted
    if (this.signal.aborted) {
      return;
    }
    if (!response.ok || responseError) {
      const error = {
        data,
        message: `Failed to fetch: ${response.status} ${response.statusText}`,
        status: response.status,
      };

      this.setState({
        error,
        loading: false,
      });

      if (!this.props.localErrorOnly && onError) {
        onError(error, () => this.mutate(body, mutateRequestOptions), response);
      }

      throw error;
    }

    this.setState({ loading: false });

    if (this.props.onMutate) {
      this.props.onMutate(body, data);
    }

    return data;
  };

  public render() {
    const { children, path, base, parentPath } = this.props;
    const { error, loading } = this.state;

    return children(this.mutate, { loading, error }, { absolutePath: composeUrl(base!, parentPath!, path!) });
  }
}

/**
 * The <Mutate /> component _with_ context.
 * Context is used to compose path props,
 * and to maintain the base property against
 * which all requests will be made.
 *
 * We compose Consumers immediately with providers
 * in order to provide new `parentPath` props that contain
 * a segment of the path, creating composable URLs.
 */
function Mutate<
  TData = any,
  TError = any,
  TQueryParams = { [key: string]: any },
  TRequestBody = any,
  TPathParams = unknown
>(props: MutateProps<TData, TError, TQueryParams, TRequestBody, TPathParams>) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulReactProvider {...contextProps} parentPath={composePath(contextProps.parentPath, props.path!)}>
          <ContextlessMutate<TData, TError, TQueryParams, TRequestBody, TPathParams>
            {...contextProps}
            {...props}
            queryParams={{ ...contextProps.queryParams, ...props.queryParams } as TQueryParams}
            queryParamStringifyOptions={{
              ...contextProps.queryParamStringifyOptions,
              ...props.queryParamStringifyOptions,
            }}
            __internal_hasExplicitBase={Boolean(props.base)}
          />
        </RestfulReactProvider>
      )}
    </RestfulReactConsumer>
  );
}

export default Mutate;
