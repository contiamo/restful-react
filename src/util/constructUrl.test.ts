import { composePath } from "./composeUrl";
import { constructUrl } from "./constructUrl";

describe("construct url utility", () => {
  describe("should be compatible with old resolveUrl behavior", () => {
    it("should handle empty parentPath with absolute path", () => {
      const parentPath = "";
      const path = "/absolute";
      expect(constructUrl(parentPath, path)).toBe("/absolute");

      const base = "https://my-awesome-api.fake";
      expect(constructUrl(base, composePath(parentPath, path))).toBe("https://my-awesome-api.fake/absolute");

      const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
      expect(constructUrl(baseWithSubpath, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/MY_SUBROUTE/absolute",
      );
    });

    it("should handle empty parentPath with relative path", () => {
      const parentPath = "";
      const path = "relative";
      expect(composePath(parentPath, path)).toBe("/relative");

      const base = "https://my-awesome-api.fake";
      expect(constructUrl(base, composePath(parentPath, path))).toBe("https://my-awesome-api.fake/relative");

      const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
      expect(constructUrl(baseWithSubpath, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/MY_SUBROUTE/relative",
      );
    });

    it("should ignore empty string from path", () => {
      const parentPath = "/someBasePath";
      const path = "";
      expect(composePath(parentPath, path)).toBe("/someBasePath");

      const base = "https://my-awesome-api.fake";
      expect(constructUrl(base, composePath(parentPath, path))).toBe("https://my-awesome-api.fake/someBasePath");

      const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
      expect(constructUrl(baseWithSubpath, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/MY_SUBROUTE/someBasePath",
      );
    });

    it("should ignore lone forward slash from path", () => {
      const parentPath = "/someBasePath";
      const path = "/";
      expect(composePath(parentPath, path)).toBe("/someBasePath");

      const base = "https://my-awesome-api.fake";
      expect(constructUrl(base, composePath(parentPath, path))).toBe("https://my-awesome-api.fake/someBasePath");

      const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
      expect(constructUrl(baseWithSubpath, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/MY_SUBROUTE/someBasePath",
      );
    });

    it("should not include parentPath value when path is absolute", () => {
      const parentPath = "/someBasePath";
      const path = "/absolute";
      expect(composePath(parentPath, path)).toBe("/absolute");

      const base = "https://my-awesome-api.fake";
      expect(constructUrl(base, composePath(parentPath, path))).toBe("https://my-awesome-api.fake/absolute");

      const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
      expect(constructUrl(baseWithSubpath, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/MY_SUBROUTE/absolute",
      );
    });

    it("should include parentPath value when path is relative", () => {
      const parentPath = "/someBasePath";
      const path = "relative";
      expect(composePath(parentPath, path)).toBe("/someBasePath/relative");

      const base = "https://my-awesome-api.fake";
      expect(constructUrl(base, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/someBasePath/relative",
      );

      const baseWithSubpath = "https://my-awesome-api.fake/MY_SUBROUTE";
      expect(constructUrl(baseWithSubpath, composePath(parentPath, path))).toBe(
        "https://my-awesome-api.fake/MY_SUBROUTE/someBasePath/relative",
      );
    });
  });
});
