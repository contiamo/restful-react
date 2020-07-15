import noop from "lodash/noop";
import * as React from "react";
import { ResolveFunction, GetDataError } from "./types";

export interface RestfulReactProviderProps<TData = any, TError = TData> {
  /** The backend URL where the RESTful resources live. */
  base: string;
  /**
   * The path that gets accumulated from each level of nesting
   * taking the absolute and relative nature of each path into consideration
   */
  parentPath?: string;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<TData>;
  /**
   * Options passed to the fetch request.
   */
  requestOptions?: (() => Partial<RequestInit> | Promise<Partial<RequestInit>>) | Partial<RequestInit>;
  /**
   * Trigger on each error.
   * For `Get` and `Mutation` calls, you can also call `retry` to retry the exact same request.
   * Please note that it's quite hard to retrieve the response data after a retry mutation in this case.
   * Depending of your case, it can be easier to add a `localErrorOnly` on your `Mutate` component
   * to deal with your retry locally instead of in the provider scope.
   */
  onError?: (err: GetDataError<TError>, retry: () => Promise<TData | null>, response?: Response) => void;
  /**
   * Trigger on each request
   */
  onRequest?: (req: Request) => void;
  /**
   * Trigger on each response
   */
  onResponse?: (res: Response) => void;
  /**
   * Any global level query params?
   * **Warning:** it's probably not a good idea to put API keys here. Consider headers instead.
   */
  queryParams?: { [key: string]: any };
}

export const Context = React.createContext<Required<RestfulReactProviderProps>>({
  base: "",
  parentPath: "",
  resolve: data => data,
  requestOptions: {},
  onError: noop,
  onRequest: noop,
  onResponse: noop,
  queryParams: {},
});

export interface InjectedProps {
  onError: RestfulReactProviderProps["onError"];
  onRequest: RestfulReactProviderProps["onRequest"];
  onResponse: RestfulReactProviderProps["onResponse"];
}

export default class RestfulReactProvider<T> extends React.Component<RestfulReactProviderProps<T>> {
  public static displayName = "RestfulProviderContext";

  public render() {
    const { children, ...value } = this.props;
    return (
      <Context.Provider
        value={{
          onError: noop,
          onRequest: noop,
          onResponse: noop,
          resolve: data => data,
          requestOptions: {},
          parentPath: "",
          queryParams: value.queryParams || {},
          ...value,
        }}
      >
        {children}
      </Context.Provider>
    );
  }
}

export const RestfulReactConsumer = Context.Consumer;
