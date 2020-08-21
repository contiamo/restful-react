import noop from "lodash/noop";
import * as React from "react";
import { IStringifyOptions } from "qs";
import { ResolveFunction } from "./Get";

export interface RestfulReactProviderProps<TData = any> {
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
  requestOptions?:
    | (<TRequestBody>(
        url: string,
        method: string,
        requestBody?: TRequestBody,
      ) => Partial<RequestInit> | Promise<Partial<RequestInit>>)
    | Partial<RequestInit>;
  /**
   * Trigger on each error.
   * For `Get` and `Mutation` calls, you can also call `retry` to retry the exact same request.
   * Please note that it's quite hard to retrieve the response data after a retry mutation in this case.
   * Depending of your case, it can be easier to add a `localErrorOnly` on your `Mutate` component
   * to deal with your retry locally instead of in the provider scope.
   */
  onError?: (
    err: {
      message: string;
      data: TData | string;
      status?: number;
    },
    retry: () => Promise<TData | null>,
    response?: Response,
  ) => void;
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
  /**
   * Query parameter stringify options applied for each request.
   */
  queryParamStringifyOptions?: IStringifyOptions;
}

export const Context = React.createContext<Required<RestfulReactProviderProps>>({
  base: "",
  parentPath: "",
  resolve: (data: any) => data,
  requestOptions: {},
  onError: noop,
  onRequest: noop,
  onResponse: noop,
  queryParams: {},
  queryParamStringifyOptions: {},
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
          resolve: (data: any) => data,
          requestOptions: {},
          parentPath: "",
          queryParams: value.queryParams || {},
          queryParamStringifyOptions: value.queryParamStringifyOptions || {},
          ...value,
        }}
      >
        {children}
      </Context.Provider>
    );
  }
}

export const RestfulReactConsumer = Context.Consumer;
