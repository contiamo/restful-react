import "isomorphic-fetch";
import "jest-dom/extend-expect";
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
    it("should call the path if base and originalBase are empty", async () => {
      const route = nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200);

      render(<Get path="https://my-awesome-api.fake">{() => <div />}</Get>);

      await wait(() => route.done());
    });

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

  describe("composing nested urls", () => {
    it("should not compose if a absolute is specified", async () => {
      const parentRoute = nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200);
      const nestedRoute = nock("https://my-awesome-api.fake")
        .get("/boom")
        .reply(200);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="plop">
            {() => (
              <Get absolute path="boom">
                {() => <div />}
              </Get>
            )}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => {
        parentRoute.done();
        nestedRoute.done();
      });
    });

    it("should compose nested relative urls with the base", async () => {
      const parentRoute = nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200);
      const nestedRoute = nock("https://my-awesome-api.fake")
        .get("/plop/boom")
        .reply(200);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="plop">{() => <Get path="boom">{() => <div />}</Get>}</Get>
        </RestfulProvider>,
      );

      await wait(() => {
        parentRoute.done();
        nestedRoute.done();
      });
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
        .reply(200, "<html>404 - this is not a json!</html>", { "content-type": "application/json" });

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
      });
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

  /**
   * This test is pretty much a duplicate
   * of a test above for composing routes; It is more explicit
   *
   */
  describe("with absolute", () => {
    it("should compose with the originalBase url", async () => {
      const root = nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200, { id: 1 });
      const absolute = nock("https://my-awesome-api.fake")
        .get("/boom")
        .reply(200, { id: 1 });

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Get path="plop">
            {() => (
              <Get absolute path="boom">
                {() => <div />}
              </Get>
            )}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => {
        root.done();
        absolute.done();
      });
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

  describe("with base", () => {
    it("should override the base url with absolute paths", async () => {
      const baseOverride = nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });
      const relative = nock("https://not-here.fake")
        .get("/plop")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://not-here.fake">
          <Get absolute path="" base="https://my-awesome-api.fake">
            {children}
          </Get>
          {/* this should use the original base path supplied through context */}
          <Get absolute path="plop">
            {() => <div />}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => {
        expect(children).toHaveBeenCalledTimes(2);
        baseOverride.done();
        relative.done();
      });
      expect(children.mock.calls[1][1].loading).toEqual(false);
      expect(children.mock.calls[1][0]).toEqual({ id: 1 });
    });

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
});
