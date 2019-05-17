import "isomorphic-fetch";
import nock from "nock";
import React from "react";
import { renderHook } from "react-hooks-testing-library";
import { RestfulProvider, useMutate } from ".";
import { Omit } from "./useGet";
import { UseMutateProps } from "./useMutate";

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

      const wrapper = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(() => useMutate("DELETE", ""), { wrapper });
      result.current.mutate("plop");

      expect(result.current).toMatchObject({
        error: null,
        loading: true,
      });
    });

    it("should call the correct url with a specific id", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { id: 1 });

      const wrapper = ({ children }) => (
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

      const wrapper = ({ children }) => <RestfulProvider base="https://not-here.fake">{children}</RestfulProvider>;
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

      const wrapper = ({ children }) => <RestfulProvider base="https://not-here.fake">{children}</RestfulProvider>;
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

    it("should call the correct url without id", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .reply(200, { id: 1 });

      const wrapper = ({ children }) => (
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

    it("should deal with query parameters", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .query({
          myParam: true,
        })
        .reply(200, { id: 1 });

      const wrapper = ({ children }) => (
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

  describe("POST", () => {
    it("should set loading to true after a call", async () => {
      nock("https://my-awesome-api.fake")
        .post("/plop")
        .reply(200, { id: 1 });

      const wrapper = ({ children }) => (
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

      const wrapper = ({ children }) => (
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

      const wrapper = ({ children }) => (
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

      const wrapper = ({ children }) => (
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

    it("should call the provider onError", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(500, { error: "I can't, I'm just a chicken!" });

      const onError = jest.fn();
      const wrapper = ({ children }) => (
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
      const wrapper = ({ children }) => (
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
      const wrapper = ({ children }) => (
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

      const wrapper = ({ children }) => (
        <RestfulProvider base="https://my-awesome-api.fake">{children}</RestfulProvider>
      );
      const { result } = renderHook(
        () => useMutate<{ id: number }, unknown, {}, {}>("POST", "", { resolve: data => ({ id: data.id * 2 }) }),
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

      const wrapper = ({ children }) => (
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
        UseMutateProps<MyCustomEnpointResponse, MyCustomEnpointQueryParams>,
        "path" | "verb"
      >;
      const useDeleteMyCustomEndpoint = (props?: UseDeleteMyCustomEndpoint) =>
        useMutate<MyCustomEnpointResponse, MyCustomEnpointError, MyCustomEnpointQueryParams, string>(
          "DELETE",
          "",
          props,
        );

      const wrapper = ({ children }) => (
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
        UseMutateProps<MyCustomEnpointResponse, MyCustomEnpointQueryParams>,
        "path" | "verb"
      >;
      const useDeleteMyCustomEndpoint = (props?: UseDeleteMyCustomEndpoint) =>
        useMutate<MyCustomEnpointResponse, MyCustomEnpointError, MyCustomEnpointQueryParams, MyCustomEndpointBody>(
          "POST",
          "plop",
          props,
        );

      const wrapper = ({ children }) => (
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
