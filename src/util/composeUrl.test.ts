import { composePath, composePathWithBody, composeUrl } from "./composeUrl";

describe("compose paths and urls", () => {
  it("should handle empty parentPath with absolute path", () => {
    const parentPath = "";
    const path = "/absolute";
    expect(composePath(parentPath, path)).toBe("/absolute");

    const base = "https://my-awesome-api.fake";
    expect(composeUrl(base, parentPath, path)).toBe("https://my-awesome-api.fake/absolute");

    const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
    expect(composeUrl(baseWithSubpath, parentPath, path)).toBe("https://my-awesome-api.fake/MY_SUBROUTE/absolute");
  });

  it("should handle empty parentPath with relative path", () => {
    const parentPath = "";
    const path = "relative";
    expect(composePath(parentPath, path)).toBe("/relative");

    const base = "https://my-awesome-api.fake";
    expect(composeUrl(base, parentPath, path)).toBe("https://my-awesome-api.fake/relative");

    const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
    expect(composeUrl(baseWithSubpath, parentPath, path)).toBe("https://my-awesome-api.fake/MY_SUBROUTE/relative");
  });

  it("should ignore empty string from path", () => {
    const parentPath = "/someBasePath";
    const path = "";
    expect(composePath(parentPath, path)).toBe("/someBasePath");

    const base = "https://my-awesome-api.fake";
    expect(composeUrl(base, parentPath, path)).toBe("https://my-awesome-api.fake/someBasePath");

    const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
    expect(composeUrl(baseWithSubpath, parentPath, path)).toBe("https://my-awesome-api.fake/MY_SUBROUTE/someBasePath");
  });

  it("should ignore lone forward slash from path", () => {
    const parentPath = "/someBasePath";
    const path = "/";
    expect(composePath(parentPath, path)).toBe("/someBasePath");

    const base = "https://my-awesome-api.fake";
    expect(composeUrl(base, parentPath, path)).toBe("https://my-awesome-api.fake/someBasePath");

    const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
    expect(composeUrl(baseWithSubpath, parentPath, path)).toBe("https://my-awesome-api.fake/MY_SUBROUTE/someBasePath");
  });

  it("should not include parentPath value when path is absolute", () => {
    const parentPath = "/someBasePath";
    const path = "/absolute";
    expect(composePath(parentPath, path)).toBe("/absolute");

    const base = "https://my-awesome-api.fake";
    expect(composeUrl(base, parentPath, path)).toBe("https://my-awesome-api.fake/absolute");

    const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
    expect(composeUrl(baseWithSubpath, parentPath, path)).toBe("https://my-awesome-api.fake/MY_SUBROUTE/absolute");
  });

  it("should include parentPath value when path is relative", () => {
    const parentPath = "/someBasePath";
    const path = "relative";
    expect(composePath(parentPath, path)).toBe("/someBasePath/relative");

    const base = "https://my-awesome-api.fake";
    expect(composeUrl(base, parentPath, path)).toBe("https://my-awesome-api.fake/someBasePath/relative");

    const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
    expect(composeUrl(baseWithSubpath, parentPath, path)).toBe(
      "https://my-awesome-api.fake/MY_SUBROUTE/someBasePath/relative",
    );
  });
});

describe("compose path with body", () => {
  it("should compose body with absolute path", () => {
    const path = "/absolute";
    const body = "?somebody";

    expect(composePathWithBody(path, body)).toBe("/absolute?somebody");
  });

  it("should compose body with relative path", () => {
    const path = "relative";
    const body = "?somebody";

    expect(composePathWithBody(path, body)).toBe("relative?somebody");
  });
});
