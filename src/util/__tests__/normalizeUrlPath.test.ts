import normalizeUrlPath from "../normalizeUrlPath";

describe("normalizeUrlPath", () => {
  it("should remove leading and trailing slash", () => {
    const path = "/plop/";

    expect(normalizeUrlPath(path)).toBe("plop");
  });

  it("should remove trailing slash", () => {
    const path = "plop/";

    expect(normalizeUrlPath(path)).toBe("plop");
  });

  it("should remove leading slash", () => {
    const path = "/plop";

    expect(normalizeUrlPath(path)).toBe("plop");
  });

  it("should nor alter the path if no leading or trailing slash is present", () => {
    const path = "plop";

    expect(normalizeUrlPath(path)).toBe("plop");
  });
});
