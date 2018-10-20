import makeCancelable from "./makeCancelable";

describe("makeCancelable", () => {
  it("should resolve when promise resolves", async () => {
    const future = new Promise(resolve => {
      setTimeout(() => resolve("well done!"), 1000);
    });
    const pending = makeCancelable(future);
    const response = await pending.promise;
    expect(response).toBe("well done!");
  });
  it("should reject if promise cancels before resolving", async () => {
    const future = new Promise(resolve => {
      setTimeout(() => resolve("well done!"), 1000);
    });
    const pending = makeCancelable(future);
    const next = jest.fn();
    pending.cancel();
    try {
      await pending.promise;
      next();
    } catch (e) {
      expect(e.isCancelled).toBe(true);
    }
    expect(next).not.toHaveBeenCalled();
  });
  it("should reject if promise is rejected", async () => {
    const future = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error("oops")), 1000);
    });
    const pending = makeCancelable(future);
    const next = jest.fn();
    pending.cancel();
    try {
      await pending.promise;
      next();
    } catch (e) {
      expect(e.message).toBe("oops");
    }
    expect(next).not.toHaveBeenCalled();
  });
});
