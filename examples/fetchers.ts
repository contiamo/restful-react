import qs from "qs";

export interface CustomGetProps<
  _TData = any,
  _TError = any,
  TQueryParams = {
    [key: string]: any;
  }
> {
  queryParams?: TQueryParams;
}

export const customGet = <
  TData = any,
  TError = any,
  TQueryParams = {
    [key: string]: any;
  }
>(
  path: string,
  props: { queryParams?: TQueryParams },
  signal?: RequestInit["signal"],
): Promise<TData | TError> => {
  let url = path;
  if (props.queryParams && Object.keys(props.queryParams).length) {
    url += `?${qs.stringify(props.queryParams)}`;
  }
  return fetch(url, {
    headers: {
      "content-type": "application/json",
    },
    signal,
  }).then(res => res.json());
};

export interface CustomMutateProps<
  _TData = any,
  _TError = any,
  TQueryParams = {
    [key: string]: any;
  },
  TRequestBody = any
> {
  body: TRequestBody;
  queryParams?: TQueryParams;
}

export const customMutate = <
  TData = any,
  TError = any,
  TQueryParams = {
    [key: string]: any;
  },
  TRequestBody = any
>(
  method: string,
  path: string,
  props: { body: TRequestBody; queryParams?: TQueryParams },
  signal?: RequestInit["signal"],
): Promise<TData | TError> => {
  let url = path;
  if (method === "DELETE" && typeof props.body === "string") {
    url += `/${props.body}`;
  }
  if (props.queryParams && Object.keys(props.queryParams).length) {
    url += `?${qs.stringify(props.queryParams)}`;
  }
  return fetch(url, {
    method,
    body: JSON.stringify(props.body),
    headers: {
      "content-type": "application/json",
    },
    signal,
  }).then(res => res.json());
};
