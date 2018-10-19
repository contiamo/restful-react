import "isomorphic-fetch";
import "jest-dom/extend-expect";
import times from "lodash/times";
import nock from "nock";
import React from "react";
import { cleanup, render, wait } from "react-testing-library";

import { Get, RestfulProvider } from "./index";

afterEach(() => {
  cleanup();
  nock.cleanAll();
});

describe("Get", () => {
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
          "invalid json response body at https://my-awesome-api.fake/ reason: Unexpected token < in JSON at position 0",
        message:
          "Failed to fetch: 200 OK - invalid json response body at https://my-awesome-api.fake/ reason: Unexpected token < in JSON at position 0",
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
        },
        expect.any(Function),
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
        },
        expect.any(Function),
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
        .reply(401, "Go away!");

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
          <Get path="?test=1" debounce>
            {children}
          </Get>
        </RestfulProvider>,
      );

      times(10, i =>
        rerender(
          <RestfulProvider base="https://my-awesome-api.fake">
            <Get path={`?test=${i + 1}`} debounce>
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

      const resolve = a => a;

      /**
       * A new instance of RestfulProvider is created on every rerender.
       * This will create a new resolve function every time forcing Get to
       * refetch.
       * In a real app, only Get would be rerendered so resolve would be the
       * same on every new render. To mimic that behavior, resolve is created
       * ahead so Get will get the same instance on every rerender.
       */
      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get path="?test=1">{children}</Get>
        </RestfulProvider>,
      );

      times(10, i =>
        rerender(
          <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
            <Get path={`?test=${i + 1}`}>{children}</Get>
          </RestfulProvider>,
        ),
      );

      expect(apiCalls).toEqual(10);
    });
  });
  describe("refetch after update", () => {
    it("should not refetch when base, path or resolve don't change", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const resolve = a => a;
      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      expect(apiCalls).toEqual(1);
    });
    it("should refetch when base changes", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const resolve = a => a;
      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      nock("https://my-new-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls);
      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get base="https://my-new-api.fake" path="">
            {children}
          </Get>
        </RestfulProvider>,
      );

      expect(apiCalls).toEqual(2);
    });
    it("should refetch when path changes", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .filteringPath(/test=[^&]*/g, "test=XXX")
        .get("/?test=XXX")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const resolve = a => a;
      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get path="/?test=0">{children}</Get>
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={resolve}>
          <Get path="/?test=1">{children}</Get>
        </RestfulProvider>,
      );

      expect(apiCalls).toEqual(2);
    });
    it("should refetch when resolve changes", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const providerResolve = a => a;
      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={providerResolve}>
          <Get path="">{children}</Get>
        </RestfulProvider>,
      );

      const newResolve = a => a;
      rerender(
        <RestfulProvider base="https://my-awesome-api.fake" resolve={providerResolve}>
          <Get path="" resolve={newResolve}>
            {children}
          </Get>
        </RestfulProvider>,
      );

      expect(apiCalls).toEqual(2);
    });
  });
});
