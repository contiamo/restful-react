import * as React from "react";
import url from "url";
import RestfulReactProvider, { InjectedProps, RestfulReactConsumer, RestfulReactProviderProps } from "./Context";
import { GetState } from "./Get";
import { processResponse } from "./util/processResponse";

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

export type MutateMethod<TData> = (data?: string | {}) => Promise<TData>;

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
export interface MutateCommonProps {
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
   * An escape hatch and an alternative to `path` when you'd like
   * to fetch from an entirely different URL.
   *
   */
  base?: string;
  /** Options passed into the fetch call. */
  requestOptions?: RestfulReactProviderProps["requestOptions"];
  /**
   * Don't send the error to the Provider
   */
  localErrorOnly?: boolean;
}

export interface MutateWithDeleteProps<TData, TError> extends MutateCommonProps {
  verb: "DELETE";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (mutate: MutateMethod<TData>, states: States<TData, TError>, meta: Meta) => React.ReactNode;
}

export interface MutateWithOtherVerbProps<TData, TError> extends MutateCommonProps {
  verb: "POST" | "PUT" | "PATCH";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (mutate: MutateMethod<TData>, states: States<TData, TError>, meta: Meta) => React.ReactNode;
}

export type MutateProps<TData, TError> = MutateWithDeleteProps<TData, TError> | MutateWithOtherVerbProps<TData, TError>;

/**
 * State for the <Mutate /> component. These
 * are implementation details and should be
 * hidden from any consumers.
 */
export interface MutateState<TData, TError> {
  response: Response | null;
  error: GetState<TData, TError>["error"];
  loading: boolean;
}

/**
 * The <Mutate /> component without Context. This
 * is a named class because it is useful in
 * debugging.
 */
class ContextlessMutate<TData, TError> extends React.Component<
  MutateProps<TData, TError> & InjectedProps,
  MutateState<TData, TError>
> {
  public readonly state: Readonly<MutateState<TData, TError>> = {
    response: null,
    loading: false,
    error: null,
  };

  public static defaultProps = {
    base: "",
    path: "",
  };

  public mutate = async (body?: string | {}, mutateRequestOptions?: RequestInit) => {
    const { base, path, verb, requestOptions: providerRequestOptions } = this.props;
    this.setState(() => ({ error: null, loading: true }));

    const requestPath =
      verb === "DELETE" && typeof body === "string"
        ? url.resolve(base!, url.resolve(path, body))
        : url.resolve(base!, path);
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
    const { data, responseError } = await processResponse(response);

    if (!response.ok || responseError) {
      const error = { data, message: `Failed to fetch: ${response.status} ${response.statusText}` };

      this.setState({
        loading: false,
      });

      if (!this.props.localErrorOnly && this.props.onError) {
        this.props.onError(error, () => this.mutate(body, mutateRequestOptions));
      }

      throw error;
    }

    this.setState({ loading: false });
    return data;
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
function Mutate<TError = any, TData = any>(props: MutateProps<TData, TError>) {
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
