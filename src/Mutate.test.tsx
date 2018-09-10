import "isomorphic-fetch";
import "jest-dom/extend-expect";
import nock from "nock";
import React from "react";
import { cleanup, render, wait } from "react-testing-library";

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
  });
});
