import { DebounceSettings } from "lodash";
import debounce from "lodash/debounce";
import isEqual from "lodash/isEqual";
import * as qs from "qs";
import * as React from "react";

import RestfulReactProvider, { InjectedProps, RestfulReactConsumer, RestfulReactProviderProps } from "./Context";
import { composePath, composeUrl } from "./util/composeUrl";
import { processResponse } from "./util/processResponse";
import { resolveData } from "./util/resolveData";

/**
 * A function that resolves returned data from
 * a fetch call.
 */
export type ResolveFunction<TData> = (data: any) => TData;

export interface GetDataError<TError> {
  message: string;
  data: TError | string;
  status?: number;
}

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

export type GetMethod<TData> = () => Promise<TData | null>;

/**
 * An interface of actions that can be performed
 * within Get
 */
export interface Actions<TData> {
  /** Refetches the same path */
  refetch: GetMethod<TData>;
}

/**
 * Meta information returned to the fetchable
 * view.
 */
export interface Meta {
  /** The entire response object passed back from the request. */
  response: Response | null;
  /** The absolute path of this request. */
  absolutePath: string;
}

/**
 * Props for the <Get /> component.
 */
export interface GetProps<TData, TError, TQueryParams> {
  /**
   * The path at which to request data,
   * typically composed by parent Gets or the RestfulProvider.
   */
  path: string;
  /**
   * @private This is an internal implementation detail in restful-react, not meant to be used externally.
   * This helps restful-react correctly override `path`s when a new `base` property is provided.
   */
  __internal_hasExplicitBase?: boolean;
  /**
   * A function that recieves the returned, resolved
   * data.
   *
   * @param data - data returned from the request.
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (data: TData | null, states: States<TData, TError>, actions: Actions<TData>, meta: Meta) => React.ReactNode;
  /** Options passed into the fetch call. */
  requestOptions?: RestfulReactProviderProps["requestOptions"];
  /**
   * Query parameters
   */
  queryParams?: TQueryParams;
  /**
   * Don't send the error to the Provider
   */
  localErrorOnly?: boolean;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<TData>;
  /**
   * Should we wait until we have data before rendering?
   * This is useful in cases where data is available too quickly
   * to display a spinner or some type of loading state.
   */
  wait?: boolean;
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
   * The accumulated path from each level of parent GETs
   *  taking the absolute and relative nature of each path into consideration
   */
  parentPath?: string;
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

/**
 * State for the <Get /> component. These
 * are implementation details and should be
 * hidden from any consumers.
 */
export interface GetState<TData, TError> {
  data: TData | null;
  response: Response | null;
  error: GetDataError<TError> | null;
  loading: boolean;
}

/**
 * The <Get /> component without Context. This
 * is a named class because it is useful in
 * debugging.
 */
class ContextlessGet<TData, TError, TQueryParams> extends React.Component<
  GetProps<TData, TError, TQueryParams> & InjectedProps,
  Readonly<GetState<TData, TError>>
> {
  constructor(props: GetProps<TData, TError, TQueryParams> & InjectedProps) {
    super(props);

    if (typeof props.debounce === "object") {
      this.fetch = debounce(this.fetch, props.debounce.wait, props.debounce.options);
    } else if (typeof props.debounce === "number") {
      this.fetch = debounce(this.fetch, props.debounce);
    } else if (props.debounce) {
      this.fetch = debounce(this.fetch);
    }
  }

  /**
   * Abort controller to cancel the current fetch query
   */
  private abortController = new AbortController();
  private signal = this.abortController.signal;

  public readonly state: Readonly<GetState<TData, TError>> = {
    data: null, // Means we don't _yet_ have data.
    response: null,
    loading: !this.props.lazy,
    error: null,
  };

  public static defaultProps = {
    base: "",
    parentPath: "",
    resolve: (unresolvedData: any) => unresolvedData,
  };

  public componentDidMount() {
    if (!this.props.lazy) {
      this.fetch();
    }
  }

  public componentDidUpdate(prevProps: GetProps<TData, TError, TQueryParams>) {
    const { base, parentPath, path, resolve, queryParams } = prevProps;
    if (
      base !== this.props.base ||
      parentPath !== this.props.parentPath ||
      path !== this.props.path ||
      !isEqual(queryParams, this.props.queryParams) ||
      // both `resolve` props need to _exist_ first, and then be equivalent.
      (resolve && this.props.resolve && resolve.toString() !== this.props.resolve.toString())
    ) {
      if (!this.props.lazy) {
        this.fetch();
      }
    }
  }

  public componentWillUnmount() {
    this.abortController.abort();
  }

  public getRequestOptions = (
    extraOptions?: Partial<RequestInit>,
    extraHeaders?: boolean | { [key: string]: string },
  ) => {
    const { requestOptions } = this.props;

    if (typeof requestOptions === "function") {
      return {
        ...extraOptions,
        ...requestOptions(),
        headers: new Headers({
          ...(typeof extraHeaders !== "boolean" ? extraHeaders : {}),
          ...(extraOptions || {}).headers,
          ...(requestOptions() || {}).headers,
        }),
      };
    }

    return {
      ...extraOptions,
      ...requestOptions,
      headers: new Headers({
        ...(typeof extraHeaders !== "boolean" ? extraHeaders : {}),
        ...(extraOptions || {}).headers,
        ...(requestOptions || {}).headers,
      }),
    };
  };

  public fetch = async (requestPath?: string, thisRequestOptions?: RequestInit) => {
    const { base, __internal_hasExplicitBase, parentPath, path, resolve } = this.props;
    if (this.state.error || !this.state.loading) {
      this.setState(() => ({ error: null, loading: true }));
    }

    const makeRequestPath = () => {
      let url: string;
      if (__internal_hasExplicitBase) {
        url = composeUrl(base!, "", path || "");
      } else {
        url = composeUrl(base!, parentPath!, requestPath || path || "");
      }
      if (this.props.queryParams) {
        url += `?${qs.stringify(this.props.queryParams)}`;
      }
      return url;
    };

    const request = new Request(makeRequestPath(), this.getRequestOptions(thisRequestOptions));
    try {
      const response = await fetch(request, { signal: this.signal });
      const { data, responseError } = await processResponse(response);

      // avoid state updates when component has been unmounted
      if (this.signal.aborted) {
        return;
      }

      if (!response.ok || responseError) {
        const error = {
          message: `Failed to fetch: ${response.status} ${response.statusText}${responseError ? " - " + data : ""}`,
          data,
          status: response.status,
        };

        this.setState({
          loading: false,
          error,
        });

        if (!this.props.localErrorOnly && this.props.onError) {
          this.props.onError(error, () => this.fetch(requestPath, thisRequestOptions), response);
        }

        return null;
      }

      const resolved = await resolveData<TData, TError>({ data, resolve });

      this.setState({ loading: false, data: resolved.data, error: resolved.error });
      return data;
    } catch (e) {
      this.setState({
        loading: false,
        error: {
          message: `Failed to fetch: ${e.message}`,
          data: e,
        },
      });
    }
  };

  public render() {
    const { children, wait, path, base, parentPath } = this.props;
    const { data, error, loading, response } = this.state;

    if (wait && data === null && !error) {
      return <></>; // Show nothing until we have data.
    }

    return children(
      data,
      { loading, error },
      { refetch: this.fetch },
      { response, absolutePath: composeUrl(base!, parentPath!, path) },
    );
  }
}

/**
 * The <Get /> component _with_ context.
 * Context is used to compose path props,
 * and to maintain the base property against
 * which all requests will be made.
 *
 * We compose Consumers immediately with providers
 * in order to provide new `parentPath` props that contain
 * a segment of the path, creating composable URLs.
 */
function Get<TData = any, TError = any, TQueryParams = { [key: string]: any }>(
  props: GetProps<TData, TError, TQueryParams>,
) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulReactProvider {...contextProps} parentPath={composePath(contextProps.parentPath, props.path)}>
          <ContextlessGet {...contextProps} {...props} __internal_hasExplicitBase={Boolean(props.base)} />
        </RestfulReactProvider>
      )}
    </RestfulReactConsumer>
  );
}

export default Get;
