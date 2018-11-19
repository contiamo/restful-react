import * as React from "react";
import RestfulReactProvider, { InjectedProps, RestfulReactConsumer, RestfulReactProviderProps } from "./Context";
import { GetState } from "./Get";
import { composePath, composeUrl } from "./util/composeUrl";
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

export type MutateMethod<TData, TBody> = (data?: string | TBody) => Promise<TData>;

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
}

export interface MutateWithDeleteProps<TData, TError, TBody> extends MutateCommonProps {
  verb: "DELETE";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (mutate: MutateMethod<TData, TBody>, states: States<TData, TError>, meta: Meta) => React.ReactNode;
}

export interface MutateWithOtherVerbProps<TData, TError, TBody> extends MutateCommonProps {
  verb: "POST" | "PUT" | "PATCH";
  /**
   * A function that recieves a mutation function, along with
   * some metadata.
   *
   * @param actions - a key/value map of HTTP verbs, aliasing destroy to DELETE.
   */
  children: (mutate: MutateMethod<TData, TBody>, states: States<TData, TError>, meta: Meta) => React.ReactNode;
}

export type MutateProps<TData, TError, TBody> =
  | MutateWithDeleteProps<TData, TError, TBody>
  | MutateWithOtherVerbProps<TData, TError, TBody>;

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
class ContextlessMutate<TData, TError, TBody> extends React.Component<
  MutateProps<TData, TError, TBody> & InjectedProps,
  MutateState<TData, TError>
> {
  public readonly state: Readonly<MutateState<TData, TError>> = {
    response: null,
    loading: false,
    error: null,
  };

  public static defaultProps = {
    base: "",
    parentPath: "",
    path: "",
  };

  /**
   * Abort controller to cancel the current fetch query
   */
  private abortController = new AbortController();
  private signal = this.abortController.signal;

  public componentWillUnmount() {
    this.abortController.abort();
  }

  public mutate = async (body?: string | TBody, mutateRequestOptions?: RequestInit) => {
    const {
      __internal_hasExplicitBase,
      base,
      parentPath,
      path,
      verb,
      requestOptions: providerRequestOptions,
    } = this.props;
    this.setState(() => ({ error: null, loading: true }));

    const makeRequestPath = () => {
      if (__internal_hasExplicitBase) {
        return verb === "DELETE" && typeof body === "string"
          ? composeUrl(base!, "", composePath(path!, body))
          : composeUrl(base!, "", path || "");
      } else {
        return verb === "DELETE" && typeof body === "string"
          ? composeUrl(base!, parentPath!, composePath(path!, body))
          : composeUrl(base!, parentPath!, path!);
      }
    };

    const request = new Request(makeRequestPath(), {
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
    } as RequestInit); // Type assertion for version of TypeScript that can't yet discriminate.

    const response = await fetch(request, { signal: this.signal });
    const { data, responseError } = await processResponse(response);

    // avoid state updates when component has been unmounted
    if (this.signal.aborted) {
      return;
    }
    if (!response.ok || responseError) {
      const error = { data, message: `Failed to fetch: ${response.status} ${response.statusText}` };

      this.setState({
        loading: false,
      });

      if (!this.props.localErrorOnly && this.props.onError) {
        this.props.onError(error, () => this.mutate(body, mutateRequestOptions), response);
      }

      throw error;
    }

    this.setState({ loading: false });
    return data;
  };

  public render() {
    const { children, path, base, parentPath } = this.props;
    const { error, loading, response } = this.state;

    return children(this.mutate, { loading, error }, { response, absolutePath: composeUrl(base!, parentPath!, path!) });
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
function Mutate<TError = any, TData = any, TBody = any>(props: MutateProps<TData, TError, TBody>) {
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <RestfulReactProvider {...contextProps} parentPath={composePath(contextProps.parentPath, props.path!)}>
          <ContextlessMutate<TData, TError, TBody>
            {...contextProps}
            {...props}
            __internal_hasExplicitBase={Boolean(props.base)}
          />
        </RestfulReactProvider>
      )}
    </RestfulReactConsumer>
  );
}

export default Mutate;
