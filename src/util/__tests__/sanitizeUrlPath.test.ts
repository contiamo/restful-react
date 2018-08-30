import sanitizeUrlPath from "../sanitizeUrlPath";

describe("sanitizeUrlPath", () => {
  it("should remove leading and trailing slash", () => {
    const path = "/plop/";

    expect(sanitizeUrlPath(path)).toBe("plop");
  });

  it("should remove and trailing slash", () => {
    const path = "plop/";

    expect(sanitizeUrlPath(path)).toBe("plop");
  });

  it("should nor alter the path if no leading or trailing slash is present", () => {
    const path = "plop";

    expect(sanitizeUrlPath(path)).toBe("plop");
  });
});
