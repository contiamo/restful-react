import "isomorphic-fetch";
import "jest-dom/extend-expect";
import nock from "nock";
import React from "react";
import { cleanup, render, wait } from "react-testing-library";

import Get from "./Get";
import { Mutate, RestfulProvider } from "./index";

afterEach(() => {
  cleanup();
  nock.cleanAll();
});

describe("Mutate", () => {
  describe("DELETE", () => {
    it("should call the correct url with a specific id", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="DELETE" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // delete action
      children.mock.calls[0][0]("plop");
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after delete state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should call the correct url with a specific id (with base in Mutate)", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="DELETE" path="" base="https://my-awesome-api.fake">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // delete action
      children.mock.calls[0][0]("plop");
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after delete state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should call the correct url with a specific id (with base and path in Mutate)", async () => {
      nock("https://my-awesome-api.fake/user")
        .delete("/plop")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="DELETE" base="https://my-awesome-api.fake" path="user">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // delete action
      children.mock.calls[0][0]("plop");
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after delete state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should call the correct url without id", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="DELETE" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // delete action
      children.mock.calls[0][0](); // no id specified here
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after delete state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });
  });
  describe("POST", () => {
    it("should call the correct url", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should send the correct body", async () => {
      nock("https://my-awesome-api.fake")
        .post("/", { foo: "bar" })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]({ foo: "bar" });
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should return the correct data", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      expect(await children.mock.calls[0][0]()).toEqual({ id: 1 });
    });

    it("should return the data and the message on error", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(500, { error: "oh no… not again…" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      return children.mock.calls[0][0]().catch(error => {
        expect(error).toEqual({
          data: { error: "oh no… not again…" },
          message: "Failed to fetch: 500 Internal Server Error",
        });
      });
    });

    it("should call the provider onError", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(401, { message: "You shall not pass!" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onError = jest.fn();

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <Mutate verb="POST" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      // post action
      await children.mock.calls[0][0]().catch(() => {
        /* noop */
      });

      expect(onError).toBeCalledWith(
        {
          data: { message: "You shall not pass!" },
          message: "Failed to fetch: 401 Unauthorized",
        },
        expect.any(Function), // retry
        expect.any(Object), // response
      );
    });

    it("should be able to retry after an error", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(401, { message: "You shall not pass!" });
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { message: "You shall pass :)" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onError = jest.fn();

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <Mutate verb="POST" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      // post action
      await children.mock.calls[0][0]().catch(() => {
        /* noop */
      });

      expect(onError).toBeCalledWith(
        {
          data: { message: "You shall not pass!" },
          message: "Failed to fetch: 401 Unauthorized",
        },
        expect.any(Function), // retry
        expect.any(Object), // response
      );
      const data = await onError.mock.calls[0][1]();
      expect(data).toEqual({ message: "You shall pass :)" });
    });

    it("should not call the provider onError if localErrorOnly is true", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(401, { message: "You shall not pass!" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onError = jest.fn();

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <Mutate verb="POST" path="" localErrorOnly>
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      // post action
      await children.mock.calls[0][0]().catch(() => {
        /* noop */
      });

      expect(onError.mock.calls.length).toEqual(0);
    });

    it("should have the correct type definition", async () => {
      interface Data {
        id: string;
        name: string;
      }

      interface Error {
        message: string;
        code: number;
      }

      interface Body {
        id: string;
        name?: string;
        age?: number;
      }

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate<Data, Error, Body> path="" verb="POST">
            {mutate => <button onClick={() => mutate({ id: "my-id", name: "fabien" })}>test</button>}
          </Mutate>
          <Mutate<Data, Error> path="" verb="DELETE">
            {mutate => <button onClick={() => mutate("my-id")}>test</button>}
          </Mutate>
        </RestfulProvider>,
      );
    });
  });
  describe("Compose paths and urls", () => {
    it("should compose absolute urls", async () => {
      nock("https://my-awesome-api.fake")
        .post("/absolute")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="/people">
            {() => (
              <Mutate verb="POST" path="/absolute">
                {children}
              </Mutate>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should compose relative urls", async () => {
      nock("https://my-awesome-api.fake")
        .post("/people/relative")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="/people">
            {() => (
              <Mutate verb="POST" path="relative">
                {children}
              </Mutate>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should compose with base subpath", async () => {
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .post("/people/relative")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/MY_SUBROUTE">
          <Mutate verb="POST" path="/people">
            {() => (
              <Mutate verb="POST" path="relative">
                {children}
              </Mutate>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should rewrite the base and handle path accordingly", async () => {
      nock("https://my-other-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      nock("https://my-awesome-api.fake/eaegae")
        .get("/LOL")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/eaegae">
          <Get path="/LOL">
            {() => (
              <Mutate verb="POST" base="https://my-other-api.fake" path="">
                {children}
              </Mutate>
            )}
          </Get>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(2));
      const response = await children.mock.calls[0][0]();
      expect(children.mock.calls.length).toBe(4);
      expect(response).toEqual({ id: 1 });
    });

    it("should compose base with trailing slash", async () => {
      nock("https://my-awesome-api.fake/MY_SUBROUTE")
        .post("/people/relative")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/MY_SUBROUTE/">
          <Mutate verb="POST" path="/people">
            {() => (
              <Mutate verb="POST" path="relative">
                {children}
              </Mutate>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should compose properly when one of the nested paths is empty string", async () => {
      nock("https://my-awesome-api.fake/absolute-1")
        .post("/absolute-2/relative-2/relative-3")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/absolute-1">
          <Mutate verb="POST" path="">
            {() => (
              <Mutate verb="POST" path="relative-1">
                {() => (
                  <Mutate verb="POST" path="/absolute-2">
                    {() => (
                      <Mutate verb="POST" path="relative-2">
                        {() => (
                          <Mutate verb="POST" path="relative-3">
                            {children}
                          </Mutate>
                        )}
                      </Mutate>
                    )}
                  </Mutate>
                )}
              </Mutate>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });

    it("should compose properly when one of the nested paths is lone slash and base has trailing slash", async () => {
      nock("https://my-awesome-api.fake/absolute-1")
        .post("/absolute-2/relative-2/relative-3")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      render(
        <RestfulProvider base="https://my-awesome-api.fake/absolute-1/">
          <Mutate verb="POST" path="/">
            {() => (
              <Mutate verb="POST" path="relative-1">
                {() => (
                  <Mutate verb="POST" path="/absolute-2">
                    {() => (
                      <Mutate verb="POST" path="relative-2">
                        {() => (
                          <Mutate verb="POST" path="relative-3">
                            {children}
                          </Mutate>
                        )}
                      </Mutate>
                    )}
                  </Mutate>
                )}
              </Mutate>
            )}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // post action
      children.mock.calls[0][0]();
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });
  });
});
