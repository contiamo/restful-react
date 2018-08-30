import * as React from "react";
import { ResolveFunction } from "./Get";

export interface RestfulReactProviderProps<T = any> {
  /** The backend URL where the RESTful resources live. */
  base: string;
  /** The original backend URL where the RESTful resources live. */
  originalBase?: string;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<T>;
  /**
   * Options passed to the fetch request.
   */
  requestOptions?: (() => Partial<RequestInit>) | Partial<RequestInit>;
}

const { Provider, Consumer: RestfulReactConsumer } = React.createContext<RestfulReactProviderProps>({
  base: "",
  resolve: (data: any) => data,
  requestOptions: {},
});

let originalBase: string = "";

export default class RestfulReactProvider<T> extends React.Component<RestfulReactProviderProps<T>> {
  constructor(props: RestfulReactProviderProps) {
    super(props);

    if (!originalBase) {
      originalBase = props.base;
    }
  }

  public render() {
    const { children, ...value } = this.props;
    return <Provider value={{ ...value, originalBase }}>{children}</Provider>;
  }
}

export { RestfulReactConsumer };
