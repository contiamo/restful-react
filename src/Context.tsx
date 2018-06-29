import * as React from "react";

import { ResolveFunction } from ".";

export interface RestfulReactProviderProps<T = any> {
  /** The backend URL where the RESTful resources live. */
  host: string;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<T>;
  /**
   * Options passed to the fetch request.
   */
  requestOptions?: Partial<RequestInit>;
}

const { Provider, Consumer: RestfulReactConsumer } = React.createContext<RestfulReactProviderProps>({
  host: "",
  resolve: (data: any) => data,
  requestOptions: {},
});

export default class RestfulReactProvider<T> extends React.Component<RestfulReactProviderProps<T>> {
  render() {
    const { children, ...value } = this.props;
    return <Provider value={value}>{children}</Provider>;
  }
}

export { RestfulReactConsumer };
