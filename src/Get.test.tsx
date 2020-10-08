import "@testing-library/jest-dom/extend-expect";
import { cleanup, render, wait, waitForElement } from "@testing-library/react";
import "isomorphic-fetch";
import times from "lodash/times";
import nock from "nock";
import React from "react";

import { Get, RestfulProvider } from "./index";
import Mutate from "./Mutate";

describe("Get", () => {
  afterEach(() => {
    cleanup();
    nock.cleanAll();
  });

  describe("classic usage", () => {
    it("should call the url set in provider", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should deal with trailing slashs", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/">
          <Get path="/">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should set loading to `true` on mount", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[0][1].loading).toEqual(true);
    });

    it("should set loading to `false` on data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
    });

    it("should send data on data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][0]).toEqual({ hello: "world" });
    });

    it("shouldn't resolve after component unmounts", async () => {
      let requestResolves: () => void;
      const pendingRequestFinishes = new Promise(resolvePromise => {
        requestResolves = resolvePromise;
      });
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, async () => {
          await pendingRequestFinishes;
        });

      const children = jest.fn();
      children.mockReturnValue(<div />);
      const resolve = jest.fn((a: any) => a);

      const { unmount } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" resolve={resolve}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      unmount();
      requestResolves!();
      await wait(() => expect(resolve).not.toHaveBeenCalled());
    });

    it("should call the provider onRequest", async () => {
      const path = "https://my-awesome-api.fake";
      nock(path)
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onRequest = jest.fn();
      const request = new Request(path);

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onRequest={onRequest}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(onRequest).toBeCalledWith(request);
    });

    it("should call the provider onResponse", async () => {
      const path = "https://my-awesome-api.fake";
      nock(path)
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      let body: any;
      const onResponse = jest.fn(async (res: Response) => {
        body = await res.json();
      });

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onResponse={onResponse}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(onResponse).toBeCalled();
      expect(body).toMatchObject({ hello: "world" });
    });

    it("should return the original response, including headers", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { oh: "my god 😍" }, { "X-custom-header": "custom value" });

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="/">
            {(_data, { loading }, _refetch, { response }) => {
              return loading ? (
                <div data-testid="loading">Loading…</div>
              ) : (
                <>
                  <div data-testid="response">{response ? JSON.stringify(response) : null}</div>
                  <div data-testid="custom-header">{response?.headers.get("X-custom-header") || ""}</div>
                </>
              );
            }}
          </Get>
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("response"));
      expect(getByTestId("response")).not.toBeEmpty();
      expect(getByTestId("custom-header")).toHaveTextContent("custom value");
    });
  });

  describe("with error", () => {
    it("should set the `error` object properly", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][0]).toEqual(null);
      expect(children.mock.calls[1][1].error).toEqual({
        data: { message: "You shall not pass!" },
        message: "Failed to fetch: 401 Unauthorized",
        status: 401,
      });
    });

    it("should handle network error", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .replyWithError({ message: "You shall not pass!" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][0]).toEqual(null);
      expect(children.mock.calls[1][1].error).toMatchObject({
        message: "Failed to fetch: request to https://my-awesome-api.fake failed, reason: You shall not pass!",
      });
    });

    it("should deal with non standard server error response (nginx style)", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, "<html>404 - this is not a json!</html>", {
          "content-type": "application/json",
        });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][0]).toEqual(null);
      expect(children.mock.calls[1][1].error).toEqual({
        data:
          "invalid json response body at https://my-awesome-api.fake reason: Unexpected token < in JSON at position 0",
        message:
          "Failed to fetch: 200 OK - invalid json response body at https://my-awesome-api.fake reason: Unexpected token < in JSON at position 0",
        status: 200,
      });
    });

    it("should call the provider onError", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onError = jest.fn();

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(onError).toBeCalledWith(
        {
          data: { message: "You shall not pass!" },
          message: "Failed to fetch: 401 Unauthorized",
          status: 401,
        },
        expect.any(Function), // retry
        expect.any(Object), // response
      );
    });

    it("should be able to retry after an error", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { message: "You shall pass :)" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onError = jest.fn();

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(onError).toBeCalledWith(
        {
          data: { message: "You shall not pass!" },
          message: "Failed to fetch: 401 Unauthorized",
          status: 401,
        },
        expect.any(Function), // retry
        expect.any(Object), // response
      );
      onError.mock.calls[0][1]();
      await wait(() => expect(children.mock.calls.length).toBe(4));
      expect(children.mock.calls[3][0]).toEqual({ message: "You shall pass :)" });
    });

    it("should not call the provider onError if localErrorOnly is true", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onError = jest.fn();

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <Get path="" localErrorOnly>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(onError.mock.calls.length).toEqual(0);
    });
  });

  describe("with custom resolver", () => {
    it("should transform data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" resolve={data => ({ ...data, foo: "bar" })}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][0]).toEqual({ hello: "world", foo: "bar" });
    });

    it("should transform data with a promise", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" resolve={data => Promise.resolve({ ...data, foo: "bar" })}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][0]).toEqual({ hello: "world", foo: "bar" });
    });

    it("should pass an error when the resolver throws a runtime error", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" resolve={data => data.apples.oranges}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].error.message).toEqual("RESOLVE_ERROR");
      expect(children.mock.calls[1][0]).toEqual(null);
    });

    it("should pass an error when the resolver is a promise that rejects", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" resolve={() => Promise.reject("nogood")}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].error).toEqual({ message: "RESOLVE_ERROR", data: JSON.stringify("nogood") });
      expect(children.mock.calls[1][0]).toEqual(null);
    });
  });

  describe("with lazy", () => {
    it("should not fetch on mount", async () => {
      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" lazy>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toBe(false);
      expect(children.mock.calls[0][0]).toBe(null);
    });
  });

  describe("with wait", () => {
    it("should render nothing if until we have data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .delay(1000)
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" wait>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(0));
    });

    it("should render if we have data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" wait>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toBe(false);
      expect(children.mock.calls[0][0]).toEqual({ hello: "world" });
    });
    it("should render if we have data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" wait>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toBe(false);
      expect(children.mock.calls[0][0]).toEqual({ hello: "world" });
    });

    it("should render if we have an error", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, "Go away!", { "content-type": "text/plain" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" wait>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toBe(false);
      expect(children.mock.calls[0][1].error).toEqual({
        data: "Go away!",
        message: "Failed to fetch: 401 Unauthorized",
        status: 401,
      });
    });
  });

  describe("with base", () => {
    it("should override the base url", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://not-here.fake">
          <Get path="" base="https://my-awesome-api.fake">
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });
    });

    it("should override the base url and compose with the path", async () => {
      nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://not-here.fake">
          <Get path="/plop" base="https://my-awesome-api.fake">
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });
    });
  });

  describe("with custom request options", () => {
    it("should add a custom header", async () => {
      nock("https://my-awesome-api.fake", { reqheaders: { foo: "bar" } })
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" requestOptions={{ headers: { foo: "bar" } }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });
    });

    it("should add a custom header with requestOptions method", async () => {
      nock("https://my-awesome-api.fake", { reqheaders: { foo: "bar" } })
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" requestOptions={() => ({ headers: { foo: "bar" } })}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });
    });

    it("should add a promised custom header with the requestOptions method", async () => {
      nock("https://my-awesome-api.fake", { reqheaders: { foo: "bar" } })
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get
            path=""
            requestOptions={() => new Promise(res => setTimeout(() => res({ headers: { foo: "bar" } }), 1000))}
          >
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });
    });
  });

  describe("actions", () => {
    it("should refetch", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // initial fetch
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });

      // refetch
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 2 });
      children.mock.calls[1][2].refetch();
      await wait(() => expect(children.mock.calls.length).toBe(4));

      // transition state
      expect(children.mock.calls[2][1].loading).toEqual(true);
      expect(children.mock.calls[2][0]).toEqual({ id: 1 });

      // after refetch state
      expect(children.mock.calls[3][1].loading).toEqual(false);
      expect(children.mock.calls[3][0]).toEqual({ id: 2 });
    });
  });

  describe("with debounce", () => {
    it("should call the API only 1 time", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .filteringPath(/test=[^&]*/g, "test=XXX")
        .get("/?test=XXX")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ test: 1 }} debounce>
            {children}
          </Get>
        </RestfulProvider>,
      );

      times(10, i =>
        rerender(
          <RestfulProvider base="https://my-awesome-api.fake">
            <Get path="" queryParams={{ test: i + 1 }} debounce>
              {children}
            </Get>
          </RestfulProvider>,
        ),
      );

      await wait(() => expect(apiCalls).toEqual(1));
    });

    it("should call the API only 10 times without debounce", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .filteringPath(/test=[^&]*/g, "test=XXX")
        .get("/?test=XXX")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ test: 1 }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      times(10, i =>
        rerender(
          <RestfulProvider base="https://my-awesome-api.fake">
            <Get path="" queryParams={{ test: i + 1 }}>
              {children}
            </Get>
          </RestfulProvider>,
        ),
      );

      await wait(() => expect(apiCalls).toEqual(10));
    });
  });

  describe("refetch after provider props update", () => {
    it("should refetch when base changes", async () => {
      const firstAPI = nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });

      const secondAPI = nock("https://my-new-api.fake")
        .get("/")
        .reply(200, { id: 2 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-new-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(firstAPI.isDone()).toBeTruthy());
      await wait(() => expect(secondAPI.isDone()).toBeTruthy());
    });
    it("should refetch when parentPath changes", async () => {
      const firstAPI = nock("https://my-awesome-api.fake")
        .get("/parent1")
        .reply(200, { id: 1 });

      const secondAPI = nock("https://my-awesome-api.fake")
        .get("/parent2")
        .reply(200, { id: 2 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" parentPath="/parent1">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" parentPath="/parent2">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(firstAPI.isDone()).toBeTruthy());
      await wait(() => expect(secondAPI.isDone()).toBeTruthy());
    });
    it("should refetch when queryParams change", async () => {
      const firstAPI = nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 })
        .persist();
      const secondAPI = nock("https://my-awesome-api.fake")
        .get("/")
        .query({ page: 2 })
        .reply(200, { id: 2 })
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" queryParams={{ page: 2 }}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(firstAPI.isDone()).toBeTruthy());
      await wait(() => expect(secondAPI.isDone()).toBeTruthy());
    });
    it("should refetch when requestOptions change", async () => {
      const firstAPI = nock("https://my-awesome-api.fake")
        .get("/")
        .matchHeader("header1", "value1")
        .reply(200, { id: 1 });
      const secondAPI = nock("https://my-awesome-api.fake")
        .get("/")
        .matchHeader("header2", "value2")
        .reply(200, { id: 2 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" requestOptions={() => ({ headers: { header1: "value1" } })}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" requestOptions={() => ({ headers: { header2: "value2" } })}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(firstAPI.isDone()).toBeTruthy());
      await wait(() => expect(secondAPI.isDone()).toBeTruthy());
    });
  });

  describe("refetch after  get props update", () => {
    it("should not refetch when base, path or resolve don't change", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={data => data}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={data => data}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(apiCalls).toEqual(1));
    });

    it("should rewrite the base and handle path accordingly", async () => {
      nock("https://my-other-api.fake")
        .get("/")
        .reply(200, { id: 1 });
      nock("https://my-awesome-api.fake/eaegae")
        .post("/LOL")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/eaegae">
          <Mutate verb="POST" path="/LOL">
            {() => (
              <Get base="https://my-other-api.fake" path="">
                {children}
              </Get>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should refetch when base changes", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      nock("https://my-new-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls);

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get base="https://my-new-api.fake" path="">
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(apiCalls).toEqual(2));
    });

    it("should refetch when path changes", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .filteringPath(/test=[^&]*/g, "test=XXX")
        .get("/?test=XXX")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ test: 0 }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ test: 1 }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(apiCalls).toEqual(2));
    });

    it("should refetch when resolve changes", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);
      const providerResolve = (a: any) => a;

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={providerResolve}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      const newResolve = () => "hello";

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={newResolve}>
          <Get path="" resolve={newResolve}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(apiCalls).toEqual(2));
    });

    it("should NOT refetch when queryParams are the same", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({ page: 2 })
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ page: 2 }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ page: 2 }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(apiCalls).toEqual(1));
    });

    it("should refetch when queryParams changes", async () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({ page: 2 })
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="" queryParams={{ page: 2 }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(apiCalls).toEqual(2));
    });
  });

  describe("Compose paths and urls", () => {
    it("should compose the url with the base", async () => {
      nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="/plop">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should compose absolute urls", async () => {
      nock("https://my-awesome-api.fake")
        .get("/people")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute")
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="/people">{() => <Get path="/absolute">{children}</Get>}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(3));
    });

    it("should compose relative urls", async () => {
      nock("https://my-awesome-api.fake")
        .get("/people")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/people/relative")
        .reply(200, { path: "/people/relative" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="/people">{() => <Get path="relative">{children}</Get>}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(3));
      expect(children.mock.calls[2][0]).toEqual({ path: "/people/relative" });
    });

    it("should compose absolute urls with base subpath", async () => {
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/people")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/absolute")
        .reply(200, { path: "/absolute" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/MY_SUBROUTE">
          <Get path="/people">{() => <Get path="/absolute">{children}</Get>}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(3));
      expect(children.mock.calls[2][0]).toEqual({ path: "/absolute" });
    });

    it("should compose relative urls with base subpath", async () => {
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/people")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/people/relative")
        .reply(200, { path: "/people/relative" });

      const children = jest.fn();
      children.mockReturnValue(<div />);
      render(
        <RestfulProvider base="https://my-awesome-api.fake/MY_SUBROUTE">
          <Get path="/people">{() => <Get path="relative">{children}</Get>}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(3));
      expect(children.mock.calls[2][0]).toEqual({ path: "/people/relative" });
    });

    it("should compose properly when base contains a trailing slash", async () => {
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/people")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/people/relative")
        .reply(200, { path: "/people/relative" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/MY_SUBROUTE/">
          <Get path="/people">{() => <Get path="relative">{children}</Get>}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(3));
      expect(children.mock.calls[2][0]).toEqual({ path: "/people/relative" });
    });

    it("should compose more nested absolute and relative urls", async () => {
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/absolute-1")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/absolute-1/relative-1")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/absolute-2")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/absolute-2/relative-2")
        .reply(200);
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .get("/absolute-2/relative-2/relative-3")
        .reply(200, { path: "/absolute-2/relative-2/relative-3" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/MY_SUBROUTE/">
          <Get path="/absolute-1">
            {() => (
              <Get path="relative-1">
                {() => (
                  <Get path="/absolute-2">
                    {() => <Get path="relative-2">{() => <Get path="relative-3">{children}</Get>}</Get>}
                  </Get>
                )}
              </Get>
            )}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(6));
      expect(children.mock.calls[5][0]).toEqual({ path: "/absolute-2/relative-2/relative-3" });
    });

    it("should compose properly when one of the paths is empty string", async () => {
      nock("https://my-awesome-api.fake")
        .get("/absolute-1")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/relative-1")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/absolute-2")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/absolute-2/relative-2")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/absolute-2/relative-2/relative-3")
        .reply(200, { path: "/absolute-1/absolute-2/relative-2/relative-3" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/absolute-1">
          <Get path="">
            {() => (
              <Get path="relative-1">
                {() => (
                  <Get path="/absolute-2">
                    {() => <Get path="relative-2">{() => <Get path="relative-3">{children}</Get>}</Get>}
                  </Get>
                )}
              </Get>
            )}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(6));
      expect(children.mock.calls[5][0]).toEqual({ path: "/absolute-1/absolute-2/relative-2/relative-3" });
    });

    it("should compose properly when one of the paths is lone slash and base has trailing slash", async () => {
      nock("https://my-awesome-api.fake")
        .get("/absolute-1")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/relative-1")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/absolute-2")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/absolute-2/relative-2")
        .reply(200);
      nock("https://my-awesome-api.fake")
        .get("/absolute-1/absolute-2/relative-2/relative-3")
        .reply(200, { path: "/absolute-1/absolute-2/relative-2/relative-3" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/absolute-1/">
          <Get path="/">
            {() => (
              <Get path="relative-1">
                {() => (
                  <Get path="/absolute-2">
                    {() => <Get path="relative-2">{() => <Get path="relative-3">{children}</Get>}</Get>}
                  </Get>
                )}
              </Get>
            )}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(6));
      expect(children.mock.calls[5][0]).toEqual({ path: "/absolute-1/absolute-2/relative-2/relative-3" });
    });
  });

  describe("with query params", () => {
    it("should add the correct query params in the url", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({
          myParam: true,
        })
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get<void, void, { myParam: boolean }> path="" queryParams={{ myParam: true }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should inherit provider's queryParams if none specified", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({
          myParam: true,
        })
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider queryParams={{ myParam: true }} base="https://my-awesome-api.fake">
          <Get<void, void, { myParam: boolean }> path="">{children}</Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should override provider's queryParams if own specified", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({
          myParam: false,
        })
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider queryParams={{ myParam: true }} base="https://my-awesome-api.fake">
          <Get<void, void, { myParam: boolean }> path="" queryParams={{ myParam: false }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });

    it("should merge provider's queryParams with own", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({
          myParam: false,
          otherParam: true,
        })
        .reply(200);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider queryParams={{ otherParam: true }} base="https://my-awesome-api.fake">
          <Get<void, void, { myParam: boolean }> path="" queryParams={{ myParam: false }}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
    });
  });
});
