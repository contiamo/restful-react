import merge from "lodash/merge";
import * as qs from "qs";
import * as React from "react";
import equal from "react-fast-compare";

import { InjectedProps, RestfulReactConsumer } from "./Context";
import { GetProps, GetState, Meta as GetComponentMeta } from "./Get";
import { composeUrl } from "./util/composeUrl";
import { processResponse } from "./util/processResponse";

/**
 * Meta information returned from the poll.
 */
interface Meta extends GetComponentMeta {
  /**
   * The entire response object.
   */
  response: Response | null;
}

/**
 * States of the current poll
 */
interface States<TData, TError> {
  /**
   * Is the component currently polling?
   */
  polling: PollState<TData, TError>["polling"];
  /**
   * Is the initial request loading?
   */
  loading: PollState<TData, TError>["loading"];
  /**
   * Has the poll concluded?
   */
  finished: PollState<TData, TError>["finished"];
  /**
   * Is there an error? What is it?
   */
  error: PollState<TData, TError>["error"];
}

/**
 * Actions that can be executed within the
 * component.
 */
interface Actions {
  start: () => void;
  stop: () => void;
}

/**
 * Props that can control the Poll component.
 */
export interface PollProps<TData, TError, TQueryParams> {
  /**
   * What path are we polling on?
   */
  path: GetProps<TData, TError, TQueryParams>["path"];
  /**
   * A function that gets polled data, the current
   * states, meta information, and various actions
   * that can be executed at the poll-level.
   */
  children: (data: TData | null, states: States<TData, TError>, actions: Actions, meta: Meta) => React.ReactNode;
  /**
   * How long do we wait between repeating a request?
   * Value in milliseconds.
   *
   * Defaults to 1000.
   */
  interval?: number;
  /**
   * How long should a request stay open?
   * Value in seconds.
   *
   * Defaults to 60.
   */
  wait?: number;
  /**
   * A stop condition for the poll that expects
   * a boolean.
   *
   * @param data - The data returned from the poll.
   * @param response - The full response object. This could be useful in order to stop polling when !response.ok, for example.
   */
  until?: (data: TData | null, response: Response | null) => boolean;
  /**
   * Are we going to wait to start the poll?
   * Use this with { start, stop } actions.
   */
  lazy?: GetProps<TData, TError, TQueryParams>["lazy"];
  /**
   * Are we going to wait to start the poll?
   * Use this with { start, stop } actions.
   */
  skip?: GetProps<TData, TError, TQueryParams>["skip"];
  /**
   * Should the data be transformed in any way?
   */
  resolve?: (data: any, prevData: TData | null) => TData;
  /**
   * We can request foreign URLs with this prop.
   */
  base?: GetProps<TData, TError, TQueryParams>["base"];
  /**
   * Any options to be passed to this request.
   */
  requestOptions?: GetProps<TData, TError, TQueryParams>["requestOptions"];
  /**
   * Query parameters
   */
  queryParams?: TQueryParams;
  /**
   * Don't send the error to the Provider
   */
  localErrorOnly?: boolean;
}

/**
 * The state of the Poll component. This should contain
 * implementation details not necessarily exposed to
 * consumers.
 */
export interface PollState<TData, TError> {
  /**
   * Are we currently polling?
   */
  polling: boolean;
  /**
   * Have we finished polling?
   */
  finished: boolean;
  /**
   * What was the last response?
   */
  lastResponse: Response | null;
  /**
   * What data are we holding in here?
   */
  data: GetState<TData, TError>["data"];
  /**
   * What data did we had before?
   */
  previousData: GetState<TData, TError>["data"];
  /**
   * Are we loading?
   */
  loading: GetState<TData, TError>["loading"];
  /**
   * Do we currently have an error?
   */
  error: GetState<TData, TError>["error"];
  /**
   * Index of the last polled response.
   */
  lastPollIndex?: string;
}

/**
 * The <Poll /> component without context.
 */
class ContextlessPoll<TData, TError, TQueryParams> extends React.Component<
  PollProps<TData, TError, TQueryParams> & InjectedProps,
  Readonly<PollState<TData, TError>>
> {
  public readonly state: Readonly<PollState<TData, TError>> = {
    data: null,
    previousData: null,
    loading: !(this.props.lazy || this.props.skip),
    lastResponse: null,
    polling: !(this.props.lazy || this.props.skip),
    finished: false,
    error: null,
  };

  public static defaultProps = {
    interval: 1000,
    wait: 60,
    base: "",
    resolve: (data: any) => data,
    queryParams: {},
  };

  private keepPolling = !(this.props.lazy || this.props.skip);

  /**
   * Abort controller to cancel the current fetch query
   */
  private abortController = new AbortController();
  private signal = this.abortController.signal;

  private isModified = (response: Response, nextData: TData) => {
    if (response.status === 304) {
      return false;
    }
    if (equal(this.state.data, nextData)) {
      return false;
    }
    return true;
  };

  private getRequestOptions = () =>
    typeof this.props.requestOptions === "function" ? this.props.requestOptions() : this.props.requestOptions || {};

  // 304 is not a OK status code but is green in Chrome 🤦🏾‍♂️
  private isResponseOk = (response: Response) => response.ok || response.status === 304;

  /**
   * This thing does the actual poll.
   */
  public cycle = async () => {
    // Have we stopped?
    if (!this.keepPolling) {
      return; // stop.
    }

    // Should we stop?
    if (this.props.until && this.props.until(this.state.data, this.state.lastResponse)) {
      await this.stop(); // stop.
      return;
    }

    // If we should keep going,
    const { base, path, interval, wait } = this.props;
    const { lastPollIndex } = this.state;
    const requestOptions = await this.getRequestOptions();

    let url = composeUrl(base!, "", path);

    // We use a ! because it's in defaultProps
    if (Object.keys(this.props.queryParams!).length) {
      url += `?${qs.stringify(this.props.queryParams)}`;
    }

    const request = new Request(url, {
      ...requestOptions,
      headers: {
        Prefer: `wait=${wait}s;${lastPollIndex ? `index=${lastPollIndex}` : ""}`,
        ...requestOptions.headers,
      },
    });

    try {
      const response = await fetch(request, { signal: this.signal });
      const { data, responseError } = await processResponse(response);

      if (!this.keepPolling || this.signal.aborted) {
        // Early return if we have stopped polling or component was unmounted
        // to avoid memory leaks
        return;
      }

      if (!this.isResponseOk(response) || responseError) {
        const error = {
          message: `Failed to poll: ${response.status} ${response.statusText}${responseError ? " - " + data : ""}`,
          data,
          status: response.status,
        };
        this.setState({ loading: false, lastResponse: response, error });

        if (!this.props.localErrorOnly && this.props.onError) {
          this.props.onError(error, () => Promise.resolve(), response);
        }
      } else if (this.isModified(response, data)) {
        this.setState(prevState => ({
          loading: false,
          lastResponse: response,
          previousData: prevState.data,
          data,
          error: null,
          lastPollIndex: response.headers.get("x-polling-index") || undefined,
        }));
      }

      // Wait for interval to pass.
      await new Promise(resolvePromise => setTimeout(resolvePromise, interval));
      this.cycle(); // Do it all again!
    } catch (e) {
      // the only error not catched is the `fetch`, this means that we have cancelled the fetch
    }
  };

  public start = () => {
    this.keepPolling = true;
    if (!this.state.polling) {
      this.setState(() => ({ polling: true })); // let everyone know we're done here.
    }
    this.cycle();
  };

  public stop = () => {
    this.keepPolling = false;
    this.setState(() => ({ polling: false, finished: true })); // let everyone know we're done here.
  };

  public componentDidMount() {
    const { path, lazy, skip } = this.props;

    if (path === undefined) {
      throw new Error(
        `[restful-react]: You're trying to poll something without a path. Please specify a "path" prop on your Poll component.`,
      );
    }

    if (!lazy && !skip) {
      this.start();
    }
  }

  public componentWillUnmount() {
    // Cancel the current query
    this.abortController.abort();

    // Stop the polling cycle
    this.stop();
  }

  public render() {
    const { lastResponse: response, previousData, data, polling, loading, error, finished } = this.state;
    const { children, base, path, resolve } = this.props;

    const meta: Meta = {
      response,
      absolutePath: composeUrl(base!, "", path),
    };

    const states: States<TData, TError> = {
      polling,
      loading,
      error,
      finished,
    };

    const actions: Actions = {
      stop: this.stop,
      start: this.start,
    };
    // data is parsed only when poll has already resolved so response is defined
    const resolvedData = response && resolve ? resolve(data, previousData) : data;
    return children(resolvedData, states, actions, meta);
  }
}

function Poll<TData = any, TError = any, TQueryParams = { [key: string]: any }>(
  props: PollProps<TData, TError, TQueryParams>,
) {
  // Compose Contexts to allow for URL nesting
  return (
    <RestfulReactConsumer>
      {contextProps => {
        const contextRequestOptions =
          typeof contextProps.requestOptions === "function"
            ? contextProps.requestOptions()
            : contextProps.requestOptions || {};
        const propsRequestOptions =
          typeof props.requestOptions === "function" ? props.requestOptions() : props.requestOptions || {};

        return (
          <ContextlessPoll
            {...contextProps}
            {...props}
            queryParams={{ ...contextProps.queryParams, ...props.queryParams }}
            requestOptions={async () => merge(await contextRequestOptions, await propsRequestOptions)}
          />
        );
      }}
    </RestfulReactConsumer>
  );
}

export default Poll;
