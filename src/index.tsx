import * as React from "react";
import RestfulProvider, { RestfulReactConsumer } from "./Context";

/**
 * A function that resolves returned data from
 * a fetch call.
 */
export type ResolveFunction<T> = (data: any) => T;

/**
 * HTTP Verbs: POST/GET/PUT/PATCH/DELETE.
 */
export type RequestMethod = "post" | "get" | "put" | "delete" | "patch";

/**
 * A collection of actions that map to
 * HTTP verbs that can be performed.
 */
export interface Verbs<T> {
  /** GET a resource */
  get: (path?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  /** DELETE a resource */
  destroy: (id?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  /** POST a resource */
  post: (data?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  /** PUT a resource */
  put: (data?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  /** PATCH a resource */
  patch: (data?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
}

/**
 * An enumeration of states that a fetchable
 * view could possibly have.
 */
export interface States {
  /** Is our view currently loading? */
  loading: boolean;
  /** Do we have an error in the view? */
  error?: string;
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
export interface GetComponentProps<T> {
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
  children: (data: T | null, states: States, actions: Verbs<T>, meta: Meta) => React.ReactNode;
  /** Options passed into the fetch call. */
  requestOptions?: Partial<RequestInit>;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<T>;
  /**
   * Should we wait until we have data before rendering?
   */
  wait?: boolean;
  /**
   * Should we fetch data at a later stage?
   */
  lazy?: boolean;
  /**
   * An escape hatch and an alternative to `path` when you'd like
   * to fetch from an entirely different URL..
   */
  host?: string;
}

/**
 * State for the <Get /> component. These
 * are implementation details and should be
 * hidden from any consumers.
 */
export interface GetComponentState<T> {
  data: T | null;
  response: Response | null;
  error: string;
  loading: boolean;
}

/**
 * The <Get /> component without Context. This
 * is a named class because it is useful in
 * debugging.
 */
class ContextlessGet<T> extends React.Component<GetComponentProps<T>, Readonly<GetComponentState<T>>> {
  private shouldFetchImmediately = () => !this.props.wait && !this.props.lazy;

  readonly state: Readonly<GetComponentState<T>> = {
    data: null, // Means we don't _yet_ have data.
    response: null,
    error: "",
    loading: this.shouldFetchImmediately(),
  };

  componentDidMount() {
    this.shouldFetchImmediately() && this.fetch("get")();
  }

  componentDidUpdate(prevProps: GetComponentProps<T>) {
    // If the path or host prop changes, refetch!
    const { path, host } = this.props;
    if (prevProps.path !== path || prevProps.host !== host) {
      this.shouldFetchImmediately() && this.fetch("get")();
    }
  }

  fetch = (method?: RequestMethod) => {
    const { host, path, requestOptions: options } = this.props;
    switch (method) {
      case "post":
      case "put":
      case "patch":
      case "delete":
        return async (data?: string, requestOptions?: Partial<RequestInit>) => {
          const isJSON = () => {
            try {
              return data ? Boolean(JSON.parse(data)) : false;
            } catch (e) {
              return false;
            }
          };

          await this.setState(() => ({ loading: true }));
          const response = await fetch(`${host}${path}`, {
            ...options,
            ...requestOptions,
            headers: new Headers({
              ...(isJSON() && { "content-type": "application/json" }),
              ...(options || {}).headers,
              ...(requestOptions || {}).headers,
            }),
            method,
            body: data,
          });

          if (!response.ok) {
            await this.setState(() => ({ loading: false }));
            throw response;
          }

          await this.setState(() => ({ loading: false }));
          const responseData: Promise<T> =
            response.headers.get("content-type") === "application/json" ? response.json() : response.text();
          return responseData;
        };
      default:
        return async (requestPath?: string, requestOptions?: Partial<RequestInit>) => {
          const { resolve } = this.props;
          const foolProofResolve = resolve || (data => data);
          try {
            await this.setState({ loading: true });
            const response = await fetch(`${host}${requestPath || path || ""}`, { ...options, ...requestOptions });

            if (!response.ok) {
              throw `Failed to fetch: ${response.status}${response.statusText}`;
            }

            const data: T =
              response.headers.get("content-type") === "application/json"
                ? await response.json()
                : await response.text();

            await this.setState({ data: foolProofResolve(data), loading: false });
            return data;
          } catch (error) {
            await this.setState(() => ({ error, loading: false }));
            return null;
          }
        };
    }
  };

  actions = {
    get: this.fetch(),
    post: this.fetch("post"),
    put: this.fetch("put"),
    patch: this.fetch("patch"),
    destroy: this.fetch("delete"),
  };

  render() {
    const { children, wait, path, host } = this.props;
    const { data, error, loading, response } = this.state;

    if (wait && data === null) {
      return <></>; // Show nothing until we have data.
    }

    return children(data, { loading, error }, this.actions, { response, absolutePath: `${host}${path}` });
  }
}

/**
 * The <Get /> component _with_ context.
 * Context is used to compose path props,
 * and to maintain the host property against
 * which all requests will be made.
 *
 * We compose Consumers immediately with providers
 * in order to provide new `host` props that contain
 * a segment of the path, creating composable URLs.
 */
function Get<T>(props: GetComponentProps<T>) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulProvider {...contextProps} host={`${contextProps.host}${props.path}`}>
          <ContextlessGet
            {...contextProps}
            {...props}
            requestOptions={{ ...contextProps.requestOptions, ...props.requestOptions }}
          />
        </RestfulProvider>
      )}
    </RestfulReactConsumer>
  );
}

export { RestfulProvider };
export { default as Poll } from "./Poll";
export default Get;
