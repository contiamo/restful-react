import url from "url";

export const composeUrl = (base: string, parentPath: string, path: string): string => {
  const composedPath = composePath(parentPath, path);
  /* If the base contains a trailing slash, it will be trimmed during composition */
  return base!.endsWith("/") ? `${base!.slice(0, -1)}${composedPath}` : `${base}${composedPath}`;
};

/**
 * If the path starts with slash, it is considered as absolute url.
 * If not, it is considered as relative url.
 * For example,
 * parentPath = "/someBasePath" and path = "/absolute" resolves to "/absolute"
 * whereas,
 * parentPath = "/someBasePath" and path = "relative" resolves to "/someBasePath/relative"
 */
export const composePath = (parentPath: string, path: string): string => {
  if (path.startsWith("/") && path.length > 1) {
    return url.resolve(parentPath, path);
  } else if (path !== "" && path !== "/") {
    return `${parentPath}/${path}`;
  } else {
    return parentPath;
  }
};

export const composePathWithBody = (path: string, body: string): string => url.resolve(path, body);
