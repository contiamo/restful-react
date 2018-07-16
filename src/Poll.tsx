import React from "react";
import { RestfulReactConsumer } from "./Context";
import { RestfulProvider } from ".";
import { GetComponentState, Meta as GetComponentMeta, GetComponentProps } from "./Get";

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
interface States<T> {
  /**
   * Is the component currently polling?
   */
  polling: PollState<T>["polling"];
  /**
   * Is the initial request loading?
   */
  loading: PollState<T>["loading"];
  /**
   * Has the poll concluded?
   */
  finished: PollState<T>["finished"];
  /**
   * Is there an error? What is it?
   */
  error?: PollState<T>["error"];
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
interface PollProps<T> {
  /**
   * What path are we polling on?
   */
  path: GetComponentProps<T>["path"];
  /**
   * A function that gets polled data, the current
   * states, meta information, and various actions
   * that can be executed at the poll-level.
   */
  children: (data: T | null, states: States<T>, actions: Actions, meta: Meta) => React.ReactNode;
  /**
   * How long do we wait between requests?
   * Value in milliseconds.
   * Defaults to 1000.
   */
  interval?: number;
  /**
   * A stop condition for the poll that expects
   * a boolean.
   *
   * @param data - The data returned from the poll.
   * @param response - The full response object. This could be useful in order to stop polling when !response.ok, for example.
   */
  until?: (data: T | null, response: Response | null) => boolean;
  /**
   * Are we going to wait to start the poll?
   * Use this with { start, stop } actions.
   */
  lazy?: GetComponentProps<T>["lazy"];
  /**
   * Should the data be transformed in any way?
   */
  resolve?: GetComponentProps<T>["resolve"];
  /**
   * We can request foreign URLs with this prop.
   */
  base?: GetComponentProps<T>["base"];
  /**
   * Any options to be passed to this request.
   */
  requestOptions?: GetComponentProps<T>["requestOptions"];
}

/**
 * The state of the Poll component. This should contain
 * implementation details not necessarily exposed to
 * consumers.
 */
interface PollState<T> {
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
  data: GetComponentState<T>["data"];
  /**
   * Are we loading?
   */
  loading: GetComponentState<T>["loading"];
  /**
   * Do we currently have an error?
   */
  error?: GetComponentState<T>["error"];
}

/**
 * The <Poll /> component without context.
 */
class ContextlessPoll<T> extends React.Component<PollProps<T>, Readonly<PollState<T>>> {
  private keepPolling = !this.props.lazy;
  readonly state: Readonly<PollState<T>> = {
    data: null,
    loading: !this.props.lazy,
    lastResponse: null,
    polling: this.keepPolling,
    finished: false,
  };

  static defaultProps = {
    interval: 1000,
    resolve: (data: any) => data,
  };

  /**
   * This thing does the actual poll.
   */
  cycle = async () => {
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
    const { base, path, requestOptions, resolve, interval } = this.props;
    const response = await fetch(
      `${base}${path}`,
      typeof requestOptions === "function" ? requestOptions() : requestOptions,
    );

    const responseBody =
      response.headers.get("content-type") === "application/json" ? await response.json() : await response.text();

    this.setState(() => ({
      loading: false,
      lastResponse: response,
      data: resolve ? resolve(responseBody) : responseBody,
    }));

    await new Promise(resolve => setTimeout(resolve, interval)); // Wait for interval to pass.
    this.cycle(); // Do it all again!
  };

  start = async () => {
    this.keepPolling = true;
    this.setState(() => ({ polling: true })); // let everyone know we're done here.}
    this.cycle();
  };

  stop = async () => {
    this.keepPolling = false;
    this.setState(() => ({ polling: false, finished: true })); // let everyone know we're done here.}
  };

  componentDidMount() {
    const { path, lazy } = this.props;

    if (!path) {
      throw new Error(
        `[restful-react]: You're trying to poll something without a path. Please specify a "path" prop on your Poll component.`,
      );
    }

    !lazy && this.start();
  }

  componentWillUnmount() {
    this.stop();
  }

  render() {
    const { lastResponse: response, data, polling, loading, error, finished } = this.state;
    const { children, base, path } = this.props;

    const meta: Meta = {
      response,
      absolutePath: `${base}${path}`,
    };

    const states: States<T> = {
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

function Poll<T>(props: PollProps<T>) {
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
