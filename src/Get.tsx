import { DebounceSettings } from "lodash";
import debounce from "lodash/debounce";
import * as React from "react";
import url from "url";
import RestfulReactProvider, { InjectedProps, RestfulReactConsumer, RestfulReactProviderProps } from "./Context";
import makeCancelable, { CancelablePromise } from "./util/makeCancelable";
import { processResponse } from "./util/processResponse";

/**
 * A function that resolves returned data from
 * a fetch call.
 */
export type ResolveFunction<T> = (data: any) => T;

export interface GetDataError<TError> {
  message: string;
  data: TError | string;
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
export interface GetProps<TData, TError> {
  /**
   * The path at which to request data,
   * typically composed by parent Gets or the RestfulProvider.
   */
  path: string;
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
class ContextlessGet<TData, TError> extends React.Component<
  GetProps<TData, TError> & InjectedProps,
  Readonly<GetState<TData, TError>>
> {
  constructor(props: GetProps<TData, TError> & InjectedProps) {
    super(props);

    if (typeof props.debounce === "object") {
      this.fetch = debounce(this.fetch, props.debounce.wait, props.debounce.options);
    } else if (typeof props.debounce === "number") {
      this.fetch = debounce(this.fetch, props.debounce);
    } else if (props.debounce) {
      this.fetch = debounce(this.fetch);
    }
  }

  private pendingRequests: Array<CancelablePromise<any>> = [];

  public readonly state: Readonly<GetState<TData, TError>> = {
    data: null, // Means we don't _yet_ have data.
    response: null,
    loading: !this.props.lazy,
    error: null,
  };

  public static defaultProps = {
    base: "",
    resolve: (unresolvedData: any) => unresolvedData,
  };

  public componentDidMount() {
    if (!this.props.lazy) {
      this.fetch();
    }
  }

  public componentDidUpdate(prevProps: GetProps<TData, TError>) {
    const { base, path, resolve } = prevProps;
    if (base !== this.props.base || path !== this.props.path || resolve !== this.props.resolve) {
      if (!this.props.lazy) {
        this.fetch();
      }
    }
  }

  public componentWillUnmount() {
    this.pendingRequests.forEach((request: CancelablePromise<any>) => {
      request.cancel();
    });
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

  private takeRequest(request: CancelablePromise<any>) {
    this.pendingRequests.push(request);
  }

  private dropRequest(request: CancelablePromise<any>) {
    const index = this.pendingRequests.indexOf(request);
    if (index >= 0) {
      this.pendingRequests.splice(index, 1);
    }
  }

  /**
   * Unwrap a Cancelable Promise
   */
  private processRequest = async (request: CancelablePromise<any>) => {
    try {
      return {
        isCancelled: request.isCancelled,
        response: await request.promise,
      };
    } catch (e) {
      if (!e.isCancelled) {
        throw new Error(e);
      }
      return {
        isCancelled: () => true,
        response: null,
      };
    }
  };

  public fetch = async (requestPath?: string, thisRequestOptions?: RequestInit) => {
    const { base, path, resolve } = this.props;
    if (this.state.error || !this.state.loading) {
      this.setState(() => ({ error: null, loading: true }));
    }

    const request = new Request(
      url.resolve(base!, requestPath || path || ""),
      this.getRequestOptions(thisRequestOptions),
    );
    const pendingRequest = makeCancelable(fetch(request));
    this.takeRequest(pendingRequest);

    const { response, isCancelled } = await this.processRequest(pendingRequest);

    if (isCancelled()) {
      return;
    }
    const { data, responseError } = await processResponse(response);

    if (!response.ok || responseError) {
      const error = {
        message: `Failed to fetch: ${response.status} ${response.statusText}${responseError ? " - " + data : ""}`,
        data,
      };

      if (isCancelled()) {
        return;
      }
      this.setState({
        loading: false,
        error,
      });

      if (!this.props.localErrorOnly && this.props.onError) {
        this.props.onError(error, () => this.fetch(requestPath, thisRequestOptions));
      }

      this.dropRequest(pendingRequest);
      return null;
    }

    if (isCancelled()) {
      return;
    }
    this.dropRequest(pendingRequest);
    this.setState({ loading: false, data: resolve!(data) });
    return data;
  };

  public render() {
    const { children, wait, path, base } = this.props;
    const { data, error, loading, response } = this.state;

    if (wait && data === null && !error) {
      return <></>; // Show nothing until we have data.
    }

    return children(
      data,
      { loading, error },
      { refetch: this.fetch },
      { response, absolutePath: url.resolve(base!, path) },
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
 * in order to provide new `base` props that contain
 * a segment of the path, creating composable URLs.
 */
function Get<TData = any, TError = any>(props: GetProps<TData, TError>) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulReactProvider {...contextProps} base={url.resolve(contextProps.base, props.path)}>
          <ContextlessGet {...contextProps} {...props} />
        </RestfulReactProvider>
      )}
    </RestfulReactConsumer>
  );
}

export default Get;
