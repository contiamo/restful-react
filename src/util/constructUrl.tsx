import qs, { IStringifyOptions } from "qs";
import url from "url";

type ResolvePathOptions = {
  queryParamOptions?: IStringifyOptions;
  stripTrailingSlash?: boolean;
};

export function constructUrl<TQueryParams>(
  base: string,
  path: string,
  queryParams?: TQueryParams,
  resolvePathOptions: ResolvePathOptions = {},
) {
  const { queryParamOptions, stripTrailingSlash } = resolvePathOptions;

  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;

  const encodedPathWithParams = Object.keys(queryParams || {}).length
    ? `${trimmedPath}?${qs.stringify(queryParams, queryParamOptions)}`
    : trimmedPath;

  const composed = Boolean(encodedPathWithParams) ? url.resolve(normalizedBase, encodedPathWithParams) : normalizedBase;

  return stripTrailingSlash && composed.endsWith("/") ? composed.slice(0, -1) : composed;
}
