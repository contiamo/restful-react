import noop from "lodash/noop";
import * as React from "react";
import { ResolveFunction } from "./Get";

export interface RestfulReactProviderProps<T = any> {
  /** The backend URL where the RESTful resources live. */
  base: string;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<T>;
  /**
   * Options passed to the fetch request.
   */
  requestOptions?: (() => Partial<RequestInit>) | Partial<RequestInit>;
  /**
   * Trigger on each error.
   * For `Get` and `Mutation` calls, you can also call `retry` to retry the exact same request.
   * Please note that it's quite hard to retrieve the response data after a retry mutation in this case.
   * Depending of your case, it can be easier to add a `localErrorOnly` on your `Mutate` component
   * to deal with your retry locally instead of in the provider scope.
   */
  onError?: (err: any, retry?: () => Promise<T | null>) => void;
}

const { Provider, Consumer: RestfulReactConsumer } = React.createContext<Required<RestfulReactProviderProps>>({
  base: "",
  resolve: (data: any) => data,
  requestOptions: {},
  onError: noop,
});

export interface InjectedProps {
  onError: RestfulReactProviderProps["onError"];
}

export default class RestfulReactProvider<T> extends React.Component<RestfulReactProviderProps<T>> {
  public render() {
    const { children, ...value } = this.props;
    return (
      <Provider
        value={{
          onError: noop,
          resolve: (data: any) => data,
          requestOptions: {},
          ...value,
        }}
      >
        {children}
      </Provider>
    );
  }
}

export { RestfulReactConsumer };
