import * as React from "react";
import RestfulReactProvider, { RestfulReactConsumer, RestfulReactProviderProps } from "./Context";
import { GetComponentState } from "./Get";

/**
 * An enumeration of states that a fetchable
 * view could possibly have.
 */
export interface States<TData, TError> {
  /** Is our view currently loading? */
  loading: boolean;
  /** Do we have an error in the view? */
  error?: GetComponentState<TData, TError>["error"];
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
 * Props for the <Mutate /> component.
 */
export interface MutateComponentCommonProps {
  /**
   * The path at which to request data,
   * typically composed by parents or the RestfulProvider.
   */
  path?: string;
  /**
   * What HTTP verb are we using?
   */
  verb: "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * An escape hatch and an alternative to `path` when you'd like
   * to fetch from an entirely different URL.
   *
   */
  base?: string;
  /** Options passed into the fetch call. */
  requestOptions?: RestfulReactProviderProps["requestOptions"];
}

export interface MutateComponentWithDelete<TData, TError> extends MutateComponentCommonProps {
  verb: "DELETE";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (
    mutate: (resourceId?: string | {}) => Promise<Response>,
    states: States<TData, TError>,
    meta: Meta,
  ) => React.ReactNode;
}

export interface MutateComponentWithOtherVerb<TData, TError> extends MutateComponentCommonProps {
  verb: "POST" | "PUT" | "PATCH";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (
    mutate: (body?: string | {}) => Promise<Response>,
    states: States<TData, TError>,
    meta: Meta,
  ) => React.ReactNode;
}

export type MutateComponentProps<TData, TError> =
  | MutateComponentWithDelete<TData, TError>
  | MutateComponentWithOtherVerb<TData, TError>;

/**
 * State for the <Mutate /> component. These
 * are implementation details and should be
 * hidden from any consumers.
 */
export interface MutateComponentState<TData, TError> {
  response: Response | null;
  error: GetComponentState<TData, TError>["error"];
  loading: boolean;
}

/**
 * The <Mutate /> component without Context. This
 * is a named class because it is useful in
 * debugging.
 */
class ContextlessMutate<TData, TError> extends React.Component<
  MutateComponentProps<TData, TError>,
  MutateComponentState<TData, TError>
> {
  public readonly state: Readonly<MutateComponentState<TData, TError>> = {
    response: null,
    loading: false,
    error: null,
  };

  public mutate = async (body?: string | {}, mutateRequestOptions?: RequestInit) => {
    const { base, path, verb, requestOptions: providerRequestOptions } = this.props;
    this.setState(() => ({ error: null, loading: true }));

    const requestPath = verb === "DELETE" ? `${base}${path || ""}${body ? "/" + body : ""}` : `${base}${path || ""}`;
    const request = new Request(requestPath, {
      method: verb,
      body: typeof body === "object" ? JSON.stringify(body) : body,
      ...(typeof providerRequestOptions === "function" ? providerRequestOptions() : providerRequestOptions),
      ...mutateRequestOptions,
      headers: {
        "content-type": typeof body === "object" ? "application/json" : "text/plain",
        ...(typeof providerRequestOptions === "function"
          ? providerRequestOptions().headers
          : (providerRequestOptions || {}).headers),
        ...(mutateRequestOptions ? mutateRequestOptions.headers : {}),
      },
    });

    const response = await fetch(request);

    if (!response.ok) {
      const responseData = await response.json();
      this.setState({
        loading: false,
        error: { data: responseData, message: `Failed to fetch: ${response.status} ${response.statusText}` },
      });
      throw response;
    }

    this.setState({ loading: false });
    return response;
  };

  public render() {
    const { children, path, base } = this.props;
    const { error, loading, response } = this.state;

    return children(this.mutate, { loading, error }, { response, absolutePath: `${base}${path}` });
  }
}

/**
 * The <Mutate /> component _with_ context.
 * Context is used to compose path props,
 * and to maintain the base property against
 * which all requests will be made.
 *
 * We compose Consumers immediately with providers
 * in order to provide new `base` props that contain
 * a segment of the path, creating composable URLs.
 */
function Mutate<TError = {}, TData = {}>(props: MutateComponentProps<TData, TError>) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulReactProvider {...contextProps} base={`${contextProps.base}${props.path}`}>
          <ContextlessMutate<TData, TError> {...contextProps} {...props} />
        </RestfulReactProvider>
      )}
    </RestfulReactConsumer>
  );
}

export default Mutate;
