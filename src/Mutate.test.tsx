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
});
