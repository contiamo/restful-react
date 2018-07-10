import * as React from "react";
import RestfulProvider, { RestfulReactConsumer, RestfulReactProviderProps } from "./Context";

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
 * Props for the <Mutate /> component.
 */
export interface MutateComponentProps {
  /**
   * The path at which to request data,
   * typically composed by parents or the RestfulProvider.
   */
  path: string;
  /**
   * What HTTP verb are we using?
   */
  verb: "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (mutate: (body?: string | {}) => Promise<Response>, states: States, meta: Meta) => React.ReactNode;
  /**
   * An escape hatch and an alternative to `path` when you'd like
   * to fetch from an entirely different URL.
   *
   */
  base?: string;
  /** Options passed into the fetch call. */
  requestOptions?: RestfulReactProviderProps["requestOptions"];
}

/**
 * State for the <Mutate /> component. These
 * are implementation details and should be
 * hidden from any consumers.
 */
export interface MutateComponentState {
  response: Response | null;
  error: string;
  loading: boolean;
}

/**
 * The <Mutate /> component without Context. This
 * is a named class because it is useful in
 * debugging.
 */
class ContextlessMutate extends React.Component<MutateComponentProps, MutateComponentState> {
  readonly state: Readonly<MutateComponentState> = {
    response: null,
    loading: false,
    error: "",
  };

  mutate = async (body?: string | {}, mutateRequestOptions?: RequestInit) => {
    const { base, path, verb: method, requestOptions: providerRequestOptions } = this.props;
    this.setState(() => ({ error: "", loading: true }));

    const response = await fetch(`${base}${path || ""}`, {
      method,
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

    if (!response.ok) {
      this.setState({ loading: false, error: `Failed to fetch: ${response.status} ${response.statusText}` });
      throw response;
    }

    this.setState({ loading: false });
    return response;
  };

  render() {
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
function Mutate(props: MutateComponentProps) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulProvider {...contextProps} base={`${contextProps.base}${props.path}`}>
          <ContextlessMutate {...contextProps} {...props} />
        </RestfulProvider>
      )}
    </RestfulReactConsumer>
  );
}

export default Mutate;
