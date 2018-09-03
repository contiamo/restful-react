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
   * The initial base path given to the parent.
   */
  originalBase?: string;
}

const { Provider, Consumer: RestfulReactConsumer } = React.createContext<RestfulReactProviderProps>({
  base: "",
  /**
   * This is undefined to make the existence check syntactically simpler
   */
  originalBase: undefined,
  resolve: (data: any) => data,
  requestOptions: {},
});

export default class RestfulReactProvider<T> extends React.Component<RestfulReactProviderProps<T>> {
  public render() {
    const { children, ...value } = this.props;
    return <Provider value={{ ...value, originalBase: value.originalBase || value.base }}>{children}</Provider>;
  }
}

export { RestfulReactConsumer };
