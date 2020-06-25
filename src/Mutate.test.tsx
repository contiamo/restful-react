import "@testing-library/jest-dom/extend-expect";
import { cleanup, render, wait } from "@testing-library/react";
import "isomorphic-fetch";
import nock from "nock";
import React from "react";

import Get from "./Get";
import { Mutate, RestfulProvider } from "./index";

describe("Mutate", () => {
  afterEach(() => {
    cleanup();
    nock.cleanAll();
  });
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

    it("should deal with query parameters", async () => {
      nock("https://my-awesome-api.fake")
        .delete("/plop")
        .query({
          myParam: true,
        })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="DELETE" path="" queryParams={{ myParam: true }}>
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
      return children.mock.calls[0][0]().catch((error: any) => {
        expect(error).toEqual({
          data: { error: "oh no… not again…" },
          message: "Failed to fetch: 500 Internal Server Error",
          status: 500,
        });
        expect(children.mock.calls[2][1].error).toEqual({
          data: { error: "oh no… not again…" },
          message: "Failed to fetch: 500 Internal Server Error",
          status: 500,
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
          status: 401,
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
          status: 401,
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

      // No `expect` here, it's just to test if the types are correct 😉
    });

    it("should call onMutate", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onMutate = jest.fn();

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="POST" path="" onMutate={onMutate}>
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      // call mutate
      await wait(() => expect(children.mock.calls.length).toBe(1));
      await children.mock.calls[0][0]();

      expect(onMutate).toHaveBeenCalled();
    });
  });

  describe("PUT", () => {
    it("should deal with empty response", async () => {
      nock("https://my-awesome-api.fake")
        .put("/")
        .reply(204);

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate verb="PUT" path="">
            {children}
          </Mutate>
        </RestfulProvider>,
      );

      await wait(() => expect(children.mock.calls.length).toBe(1));
      expect(children.mock.calls[0][1].loading).toEqual(false);
      expect(children.mock.calls[0][0]).toBeDefined();

      // put action
      children.mock.calls[0]
        [0]()
        .then((data: any) => expect(data).toBe(undefined))
        .catch(() => expect("should not").toBe("called"));
      await wait(() => expect(children.mock.calls.length).toBe(3));

      // transition state
      expect(children.mock.calls[1][1].loading).toEqual(true);

      // after post state
      expect(children.mock.calls[2][1].loading).toEqual(false);
    });
  });
  describe("Compose paths, urls, and query parameters", () => {
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
    it("should deal with query params", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .query({
          myParam: true,
        })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <Mutate<void, void, { myParam: boolean }> verb="POST" path="" queryParams={{ myParam: true }}>
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
    it("should inherit provider's query params if present", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .query({
          myParam: true,
        })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake" queryParams={{ myParam: true }}>
          <Mutate<void, void, { myParam: boolean }> verb="POST" path="">
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
    it("should override provider's query params if own present", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .query({
          myParam: false,
        })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake" queryParams={{ myParam: true }}>
          <Mutate<void, void, { myParam: boolean }> verb="POST" path="" queryParams={{ myParam: false }}>
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
    it("should merge provider's query params with own if present", async () => {
      nock("https://my-awesome-api.fake")
        .post("/")
        .query({
          myParam: false,
          otherParam: true,
        })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      // setup - first render
      render(
        <RestfulProvider base="https://my-awesome-api.fake" queryParams={{ otherParam: true }}>
          <Mutate<void, void, { myParam: boolean }> verb="POST" path="" queryParams={{ myParam: false }}>
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

    it("should call the provider onRequest", async () => {
      const path = "https://my-awesome-api.fake";
      nock(path)
        .post("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const onRequest = jest.fn();
      const request = new Request(path, {
        method: "POST",
        headers: { "content-type": "text/plain" },
      });

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onRequest={onRequest}>
          <Mutate<void, void, void> verb="POST" path="">
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

      // expect onRequest to be called
      expect(onRequest).toBeCalledWith(request);
    });

    it("should call the provider onResponse", async () => {
      const path = "https://my-awesome-api.fake";
      nock(path)
        .post("/")
        .reply(200, { hello: "world" });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      let body: any;
      const onResponse = jest.fn(async (res: Response) => {
        body = await res.json();
      });

      render(
        <RestfulProvider base="https://my-awesome-api.fake" onResponse={onResponse}>
          <Mutate<void, void, void> verb="POST" path="">
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

      // expect onResponse to be called
      expect(onResponse).toBeCalled();
      expect(body).toMatchObject({ hello: "world" });
    });
  });
});
