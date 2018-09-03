import React from "react";
import equal from "react-fast-compare";
import { RestfulReactConsumer } from "./Context";
import { GetProps, GetState, Meta as GetComponentMeta } from "./Get";
import normalizeUrlPath from "./util/normalizeUrlPath";
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
export interface PollProps<TData, TError> {
  /**
   * What path are we polling on?
   */
  path: GetProps<TData, TError>["path"];
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
  lazy?: GetProps<TData, TError>["lazy"];
  /**
   * Should the data be transformed in any way?
   */
  resolve?: GetProps<TData, TError>["resolve"];
  /**
   * We can request foreign URLs with this prop.
   */
  base?: GetProps<TData, TError>["base"];
  /**
   * Any options to be passed to this request.
   */
  requestOptions?: GetProps<TData, TError>["requestOptions"];
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
class ContextlessPoll<TData, TError> extends React.Component<
  PollProps<TData, TError>,
  Readonly<PollState<TData, TError>>
> {
  public readonly state: Readonly<PollState<TData, TError>> = {
    data: null,
    loading: !this.props.lazy,
    lastResponse: null,
    polling: !this.props.lazy,
    finished: false,
    error: null,
  };

  public static defaultProps = {
    interval: 1000,
    wait: 60,
    resolve: (data: any) => data,
  };

  private keepPolling = !this.props.lazy;

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
    const { base, path, resolve, interval, wait } = this.props;
    const { lastPollIndex } = this.state;
    const requestOptions = this.getRequestOptions();

    const request = new Request(`${base}/${normalizeUrlPath(path)}`, {
      ...requestOptions,

      headers: {
        Prefer: `wait=${wait}s;${lastPollIndex ? `index=${lastPollIndex}` : ""}`,

        ...requestOptions.headers,
      },
    });

    const response = await fetch(request);
    const { data, responseError } = await processResponse(response);

    if (!this.isResponseOk(response) || responseError) {
      const error = { message: `${response.status} ${response.statusText}${responseError ? " - " + data : ""}`, data };
      this.setState({ loading: false, lastResponse: response, data, error });
      throw new Error(`Failed to Poll: ${error}`);
    }

    if (this.isModified(response, data)) {
      this.setState(() => ({
        loading: false,
        lastResponse: response,
        data: resolve ? resolve(data) : data,
        lastPollIndex: response.headers.get("x-polling-index") || undefined,
      }));
    }

    // Wait for interval to pass.
    await new Promise(resolvePromise => setTimeout(resolvePromise, interval));
    this.cycle(); // Do it all again!
  };

  public start = async () => {
    this.keepPolling = true;
    this.setState(() => ({ polling: true })); // let everyone know we're done here.
    this.cycle();
  };

  public stop = async () => {
    this.keepPolling = false;
    this.setState(() => ({ polling: false, finished: true })); // let everyone know we're done here.
  };

  public componentDidMount() {
    const { path, lazy } = this.props;

    if (!path) {
      throw new Error(
        `[restful-react]: You're trying to poll something without a path. Please specify a "path" prop on your Poll component.`,
      );
    }

    if (!lazy) {
      this.start();
    }
  }

  public componentWillUnmount() {
    this.stop();
  }

  public render() {
    const { lastResponse: response, data, polling, loading, error, finished } = this.state;
    const { children, base, path } = this.props;

    const meta: Meta = {
      response,
      absolutePath: `${base}/${normalizeUrlPath(path)}`,
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

    return children(data, states, actions, meta);
  }
}

function Poll<TData = any, TError = any>(props: PollProps<TData, TError>) {
  // Compose Contexts to allow for URL nesting
  return (
    <RestfulReactConsumer>
      {contextProps => (
        <ContextlessPoll
          {...contextProps}
          {...props}
          requestOptions={{ ...contextProps.requestOptions, ...props.requestOptions }}
        />
      )}
    </RestfulReactConsumer>
  );
}

export default Poll;
