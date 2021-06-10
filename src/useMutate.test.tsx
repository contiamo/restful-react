import { renderHook } from "@testing-library/react-hooks";
import "isomorphic-fetch";
import nock from "nock";
import React from "react";
import { RestfulProvider, useMutate, UseMutateProps } from ".";
import { Omit } from "./useGet";

describe("useMutate", () => {
  // Mute console.error -> https://github.com/kentcdodds/react-testing-library/issues/281
  // tslint:disable:no-console
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = jest.fn;
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("DELETE", () => {
    it("should set loading to true after a call", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), { wrapper });
      result.current.mutate("plop");

      expect(result.current).toMatchObject({
        error: null,
        loading: true,
      });
    });

    it("should cancel on unmount", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { oops: true });
      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );

      const resolve = jest.fn(() => "/plop");
      const { result, unmount } = renderHook(() => useMutate("DELETE", resolve), { wrapper });

      const resultPromise = result.current.mutate({});
      unmount();
      const res = await resultPromise;

      expect(res).toEqual(undefined);
    });

    it("should call the correct url with a specific id", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), { wrapper });
      const res = await result.current.mutate("plop");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should call the correct url with a specific id (base in options)", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://not-here.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", "", { base: "https://my-awesome-api.fake" }), {
        wrapper,
      });
      const res = await result.current.mutate("plop");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should call the correct url with a specific id (base and path in options)", async () => {
      nock("https://my-awesome-api.fake/user")
        .delete("/plop")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://not-here.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", "user", { base: "https://my-awesome-api.fake" }), {
        wrapper,
      });
      const res = await result.current.mutate("plop");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should send the correct body", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/", { foo: "bar" })
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), { wrapper });
      const res = await result.current.mutate({ foo: "bar" });

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should send the empty body object", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/", {})
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), { wrapper });
      const res = await result.current.mutate({});

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should call the correct url without id", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), {
        wrapper,
      });
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should deal with undefined bodies", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate<any, any, { [key: string]: any }, void, void>("DELETE", ""), {
        wrapper,
      });
      const res = await result.current.mutate();

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should deal with query parameters", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query({
          myParam: true,
        })
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", "", { queryParams: { myParam: true } }), {
        wrapper,
      });
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });
  });

  describe("Query Params", () => {
    it("should inherit the provider's query parameters if none specified", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query({
          cheese: "yummy",
        })
        .reply(200, { vegan: false });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParams={{ cheese: "yummy" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), {
        wrapper,
      });
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: false });
    });

    it("should override the provider's query parameters if own specified", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query({
          cheese: "yucky",
        })
        .reply(200, { vegan: true });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParams={{ cheese: "yummy" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", "", { queryParams: { cheese: "yucky" } }), {
        wrapper,
      });
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: true });
    });

    it("should merge with the provider's query parameters if both specified", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query({
          cheese: "yucky",
          meat: "omg amazing",
        })
        .reply(200, { vegan: "confused" });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParams={{ meat: "omg amazing" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", "", { queryParams: { cheese: "yucky" } }), {
        wrapper,
      });
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: "confused" });
    });

    it("should override query parameters if specified in mutate method", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query({
          cheese: "yucky",
          meat: "omg amazing",
        })
        .reply(200, { vegan: "confused" });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParams={{ meat: "omg amazing" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", "", { queryParams: { cheese: "chucky" } }), {
        wrapper,
      });
      const res = await result.current.mutate("", { queryParams: { cheese: "yucky" } });

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: "confused" });
    });

    it("should parse the querystring regarding the options", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query(i => {
          return i["anArray[]"] === "nice";
        })
        .reply(200, () => ({ vegan: true }));

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate("DELETE", "", {
            queryParams: { anArray: ["nice"] },
            queryParamStringifyOptions: { arrayFormat: "brackets" },
          }),
        {
          wrapper,
        },
      );
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: true });
    });

    it("should inherit global queryParamStringifyOptions if none specified", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query(i => {
          return i["anArray[]"] === "nice";
        })
        .reply(200, () => ({ vegan: true }));

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParamStringifyOptions={{ arrayFormat: "brackets" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate("DELETE", "", {
            queryParams: { anArray: ["nice"] },
          }),
        {
          wrapper,
        },
      );
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: true });
    });

    it("should override global queryParamStringifyOptions if own queryParamStringifyOptions are specified", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query(i => {
          return i["anArray"] === "foo,bar";
        })
        .reply(200, () => ({ vegan: true }));

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParamStringifyOptions={{ arrayFormat: "brackets" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate("DELETE", "", {
            queryParams: { anArray: ["foo", "bar"] },
            queryParamStringifyOptions: { arrayFormat: "comma" },
          }),
        {
          wrapper,
        },
      );
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: true });
    });

    it("should merge global queryParamStringifyOptions if both queryParamStringifyOptions are specified", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/?anArray[]=nice;foo=bar")
        .reply(200, () => ({ vegan: true }));

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider queryParamStringifyOptions={{ arrayFormat: "brackets" }} base="https://my-awesome-api.fake">
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate("DELETE", "", {
            queryParams: { anArray: ["nice"], foo: "bar" },
            queryParamStringifyOptions: { delimiter: ";" },
          }),
        {
          wrapper,
        },
      );
      const res = await result.current.mutate("");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ vegan: true });
    });
  });

  describe("Mutate identity", () => {
    it("should remain the same across calls with static props", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop/one")
        .reply(200, { id: 1 })
        .persist();

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const getPath = ({ id }: { id: string }) => `plop/${id}`;
      const pathParams = { id: "one" };
      const { result } = renderHook(
        () =>
          useMutate<{ id: number }, unknown, {}, {}, { id: string }>("POST", getPath, {
            pathParams,
          }),
        {
          wrapper,
        },
      );
      const mutate0 = result.current.mutate;
      const mutate1 = result.current.mutate;
      await result.current.mutate({});
      const mutate2 = result.current.mutate;

      expect(mutate0).toEqual(mutate1);
      expect(mutate0).toEqual(mutate2);
    });

    it("should remain the same across calls with deeply equal props", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop/one")
        .reply(200, { id: 1 })
        .persist();

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const getPath = ({ id }: { id: string }) => `plop/${id}`;
      const { result } = renderHook(
        () =>
          useMutate<{ id: number }, unknown, {}, {}, { id: string }>("POST", getPath, {
            pathParams: { id: "one" },
          }),
        {
          wrapper,
        },
      );
      const mutate0 = result.current.mutate;
      const mutate1 = result.current.mutate;
      await result.current.mutate({});
      const mutate2 = result.current.mutate;

      expect(mutate0).toBe(mutate1);
      expect(mutate0).toBe(mutate2);
    });
  });

  describe("Path Params", () => {
    it("should resolve path parameters if specified", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop/one")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate<{ id: number }, unknown, {}, {}, { id: string }>("POST", ({ id }) => `plop/${id}`, {
            pathParams: { id: "one" },
          }),
        {
          wrapper,
        },
      );
      const res = await result.current.mutate({});

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should override path parameters if specified in mutate method", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop/one")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate<{ id: number }, unknown, {}, {}, { id: string }>("POST", ({ id }) => `plop/${id}`, {
            pathParams: { id: "two" },
          }),
        {
          wrapper,
        },
      );
      const res = await result.current.mutate({}, { pathParams: { id: "one" } });

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });
  });

  describe("POST", () => {
    it("should set loading to true after a call", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate<{ id: number }, unknown, {}, {}>("POST", "plop"), {
        wrapper,
      });
      result.current.mutate({});

      expect(result.current).toMatchObject({
        error: null,
        loading: true,
      });
    });

    it("should call the correct url", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate<{ id: number }, unknown, {}, {}>("POST", ""), { wrapper });
      const res = await result.current.mutate({});

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should send the correct body", async () => {
      nock("https://my-awesome-api.fake")
        .post("/", { foo: "bar" })
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      const res = await result.current.mutate({ foo: "bar" });

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should return the data and the message on error", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(500, { error: "I can't, I'm just a chicken!" });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      try {
        await result.current.mutate({ foo: "bar" });
        expect("this statement").toBe("not executed");
      } catch (e) {
        expect(result.current).toMatchObject({
          error: {
            data: { error: "I can't, I'm just a chicken!" },
            message: "Failed to fetch: 500 Internal Server Error",
            status: 500,
          },
          loading: false,
        });
        expect(e).toEqual({
          data: { error: "I can't, I'm just a chicken!" },
          message: "Failed to fetch: 500 Internal Server Error",
          status: 500,
        });
      }
    });

    it("should call onMutation", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { ok: true });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const onMutate = jest.fn();
      const { result } = renderHook(() => useMutate("POST", "", { onMutate }), { wrapper });
      await result.current.mutate({ foo: "bar" });
      expect(onMutate).toHaveBeenCalled();
    });

    it("should deal with non standard server error response (nginx style)", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, "<html>404 - this is not a json!</html>", {
          "content-type": "application/json",
        });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      try {
        await result.current.mutate({ foo: "bar" });
        expect("this statement").toBe("not executed");
      } catch (e) {
        expect(result.current).toMatchObject({
          error: {
            data:
              "invalid json response body at https://my-awesome-api.fake/ reason: Unexpected token < in JSON at position 0",
            message: "Failed to fetch: 200 OK",
            status: 200,
          },
          loading: false,
        });
        expect(e).toEqual({
          data:
            "invalid json response body at https://my-awesome-api.fake/ reason: Unexpected token < in JSON at position 0",
          message: "Failed to fetch: 200 OK",
          status: 200,
        });
      }
    });

    it("should call the provider onError", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(500, { error: "I can't, I'm just a chicken!" });

      const onError = jest.fn();
      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      await result.current.mutate({ foo: "bar" }).catch(() => {
        /* noop */
      });
      expect(onError).toBeCalledWith(
        {
          data: { error: "I can't, I'm just a chicken!" },
          message: "Failed to fetch: 500 Internal Server Error",
          status: 500,
        },
        expect.any(Function), // retry
        expect.any(Object), // response
      );
    });

    it("should be able to retry after error", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(401, { message: "You shall not pass!" });
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { message: "You shall pass :)" });

      const onError = jest.fn();
      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate<{ id: number }, { message: string }, {}, {}>("POST", ""), {
        wrapper,
      });

      await result.current.mutate({}).catch(() => {
        /* noop */
      });

      expect(onError).toBeCalledWith(
        {
          data: { message: "You shall not pass!" },
          message: "Failed to fetch: 401 Unauthorized",
          status: 401,
        },
        expect.any(Function), // retry
        expect.any(Object), // response
      );

      const data = await onError.mock.calls[0][1](); // call retry
      expect(data).toEqual({ message: "You shall pass :)" });
    });

    it("should not call the provider onError if localErrorOnly is true", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(500, { error: "I can't, I'm just a chicken!" });

      const onError = jest.fn();
      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", "", { localErrorOnly: true }), { wrapper });
      await result.current.mutate({ foo: "bar" }).catch(() => {
        /* noop */
      });
      expect(onError).not.toBeCalled();
    });

    it("should transform the data with the resolve function", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate<{ id: number }, unknown, {}, {}>("POST", "", {
            resolve: (data: any) => ({ id: data.id * 2 }),
          }),
        { wrapper },
      );
      const res = await result.current.mutate({});

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 2 });
    });

    it("should forward the resolve error", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(
        () =>
          useMutate<{ id: number }, unknown, {}, {}>("POST", "", {
            resolve: () => {
              throw new Error("I don't like your data!");
            },
          }),
        { wrapper },
      );

      try {
        await result.current.mutate({});
        expect("this statement").toBe("not executed");
      } catch (e) {
        expect(result.current).toMatchObject({
          error: {
            data: "I don't like your data!",
            message: "Failed to resolve: I don't like your data!",
          },
          loading: false,
        });
        expect(e.message).toEqual("I don't like your data!");
      }
    });

    it("should call the provider onRequest", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { hello: "world" });

      const onRequest = jest.fn();
      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake" onRequest={onRequest}>
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      await result.current.mutate({ foo: "bar" });
      expect(onRequest).toBeCalled();
    });

    it("should call the provider onResponse", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { hello: "world" });

      let body: any;
      const onResponse = jest.fn(async (res: Response) => {
        body = await res.json();
      });
      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake" onResponse={onResponse}>
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      await result.current.mutate({ foo: "bar" });
      expect(onResponse).toBeCalled();
      expect(body).toMatchObject({ hello: "world" });
    });

    it("should call the provider resolve", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { hello: "world" });

      const resolve = jest.fn(val => val)

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          {children}
        </RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("POST", ""), { wrapper });
      await result.current.mutate({ foo: "bar" });
      expect(resolve).toBeCalled();
    });
  });

  describe("generation pattern", () => {
    it("should call the correct endpoint (DELETE)", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .query({ force: true })
        .reply(200, { id: 1 });

      interface MyCustomEnpointResponse {
        id: number;
      }

      interface MyCustomEnpointQueryParams {
        force?: boolean;
      }

      interface MyCustomEnpointError {
        message: string;
        code: number;
      }

      type UseDeleteMyCustomEndpoint = Omit<
        UseMutateProps<MyCustomEnpointResponse, MyCustomEnpointError, MyCustomEnpointQueryParams, {}, {}>,
        "path" | "verb"
      >;
      const useDeleteMyCustomEndpoint = (props?: UseDeleteMyCustomEndpoint) =>
        useMutate<MyCustomEnpointResponse, MyCustomEnpointError, MyCustomEnpointQueryParams, string, {}>(
          "DELETE",
          "",
          props,
        );

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useDeleteMyCustomEndpoint({ queryParams: { force: true } }), { wrapper });
      const res = await result.current.mutate("plop");

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });

    it("should call the correct endpoint (POST)", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop", { id: 1 })
        .query({ force: true })
        .reply(200, { id: 1 });

      interface MyCustomEnpointResponse {
        id: number;
      }

      interface MyCustomEnpointQueryParams {
        force?: boolean;
      }

      interface MyCustomEnpointError {
        message: string;
        code: number;
      }

      interface MyCustomEndpointBody {
        id: number;
      }

      type UseDeleteMyCustomEndpoint = Omit<
        UseMutateProps<MyCustomEnpointResponse, MyCustomEnpointError, MyCustomEnpointQueryParams, {}, {}>,
        "path" | "verb"
      >;
      const useDeleteMyCustomEndpoint = (props?: UseDeleteMyCustomEndpoint) =>
        useMutate<MyCustomEnpointResponse, MyCustomEnpointError, MyCustomEnpointQueryParams, MyCustomEndpointBody, {}>(
          "POST",
          "plop",
          props,
        );

      const wrapper: React.FC = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useDeleteMyCustomEndpoint({ queryParams: { force: true } }), { wrapper });
      const res = await result.current.mutate({ id: 1 });

      expect(result.current).toMatchObject({
        error: null,
        loading: false,
      });
      expect(res).toEqual({ id: 1 });
    });
  });
});
