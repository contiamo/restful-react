import "isomorphic-fetch";
import "jest-dom/extend-expect";
import times from "lodash/times";
import nock from "nock";
import React, { useState } from "react";
import { cleanup, fireEvent, render, wait, waitForElement } from "react-testing-library";

import { RestfulProvider, useGet } from "./index";

// NOTES:
// We have react warning due to https://github.com/kentcdodds/react-testing-library/issues/281
describe("useGet hook", () => {
  afterEach(() => {
    cleanup();
    nock.cleanAll();
  });
  describe("classic usage", () => {
    it("should have a loading state on mount", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/" });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      expect(getByTestId("loading")).toHaveTextContent("Loading…");
    });

    it("should have data from the request after loading", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/" });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("data"));

      expect(getByTestId("data")).toHaveTextContent("my god 😍");
    });

    it("shouldn't resolve after component unmount", async () => {
      let requestResolves;
      const pendingRequestFinishes = new Promise(resolvePromise => {
        requestResolves = resolvePromise;
      });
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => pendingRequestFinishes);

      const resolve = jest.fn(val => val);

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/", resolve });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { unmount } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      unmount();
      requestResolves();
      await wait(() => expect(resolve).not.toHaveBeenCalled());
    });
  });

  describe("url composition", () =>
    // this follow the rules of compositions from the `url` package
    [
      { base: "https://my-awesome-api.fake", path: "/", expected: ["https://my-awesome-api.fake", "/"] },
      { base: "https://my-awesome-api.fake", path: "/plop", expected: ["https://my-awesome-api.fake", "/plop"] },
      { base: "https://my-awesome-api.fake/plop", path: "/", expected: ["https://my-awesome-api.fake", "/"] },
      { base: "https://my-awesome-api.fake/plop/", path: "/", expected: ["https://my-awesome-api.fake", "/"] },
      { base: "https://my-awesome-api.fake/plop/", path: "", expected: ["https://my-awesome-api.fake", "/plop/"] },
      { base: "https://my-awesome-api.fake/plop/", path: "../", expected: ["https://my-awesome-api.fake", "/"] },
      { base: "https://my-awesome-api.fake/a", path: "/b", expected: ["https://my-awesome-api.fake", "/b"] },
      { base: "https://my-awesome-api.fake/a/", path: "", expected: ["https://my-awesome-api.fake", "/a/"] },
    ].forEach(({ base, path, expected }) => {
      it(`should call ${expected.join("")}`, async () => {
        nock(expected[0])
          .get(expected[1])
          .reply(200, { oh: "my god 😍" });
        const MyAwesomeComponent = () => {
          const { data, loading } = useGet<{ oh: string }>({ path });
          return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
        };

        const { getByTestId } = render(
          <RestfulProvider base={base}>
            <MyAwesomeComponent />
          </RestfulProvider>,
        );

        await waitForElement(() => getByTestId("data"));

        expect(getByTestId("data")).toHaveTextContent("my god 😍");
      });
    }));

  describe("with error", () => {
    it("should set the `error` object properly", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });

      const MyAwesomeComponent = () => {
        const { data, loading, error } = useGet<{ oh: string }, { message: string }>({ path: "/" });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("error"));

      expect(getByTestId("error")).toHaveTextContent("Failed to fetch: 401 Unauthorized");
    });

    it("should handle network error", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .replyWithError({ message: "You shall not pass!" });

      const MyAwesomeComponent = () => {
        const { data, loading, error } = useGet<{ oh: string }, { message: string }>({ path: "" });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("error"));

      expect(getByTestId("error")).toHaveTextContent(
        "Failed to fetch: request to https://my-awesome-api.fake/ failed, reason: You shall not pass!",
      );
    });

    it("should deal with non standard server error response (nginx style)", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, "<html>404 - this is not a json!</html>", {
          "content-type": "application/json",
        });

      const MyAwesomeComponent = () => {
        const { data, loading, error } = useGet<{ oh: string }, { message: string }>({ path: "" });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("error"));

      expect(getByTestId("error")).toHaveTextContent(
        "Failed to fetch: 200 OK - invalid json response body at https://my-awesome-api.fake/ reason: Unexpected token < in JSON at position 0",
      );
    });

    it("should call the provider onError", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });

      const onError = jest.fn();

      const MyAwesomeComponent = () => {
        const { data, loading, error } = useGet<{ oh: string }, { message: string }>({ path: "/" });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("error"));
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

      const MyAwesomeComponent = () => {
        const { data, loading, error } = useGet<{ message: string }, { message: string }>({ path: "" });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div>Loading…</div> : <div data-testid="data">{data.message}</div>;
      };

      const App = () => {
        const [retry, setRetry] = useState<() => Promise<any> | null>();

        return (
          <RestfulProvider base="https://my-awesome-api.fake" onError={(_, r) => setRetry(() => r)}>
            <MyAwesomeComponent />
            {retry && <button data-testid="retry" onClick={() => retry()} />}
          </RestfulProvider>
        );
      };

      const { getByTestId } = render(<App />);

      await waitForElement(() => getByTestId("retry"));
      fireEvent.click(getByTestId("retry"));

      await waitForElement(() => getByTestId("data"));
      expect(getByTestId("data")).toHaveTextContent("You shall pass :)");
    });

    it("should not call the provider onError if localErrorOnly is true", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(401, { message: "You shall not pass!" });

      const onError = jest.fn();

      const MyAwesomeComponent = () => {
        const { data, loading, error } = useGet<{ message: string }, { message: string }>({
          path: "",
          localErrorOnly: true,
        });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.message}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake" onError={onError}>
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("error"));

      expect(onError).not.toBeCalled();
    });
  });

  describe("with custom resolver", () => {
    it("should transform data", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/", resolve: res => ({ oh: res.oh + "🎉" }) });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("data"));

      expect(getByTestId("data")).toHaveTextContent("my god 😍🎉");
    });

    it("should pass an error when the resolver throws a runtime error", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, error, loading } = useGet<{ oh: string }>({
          path: "/",
          resolve: () => {
            throw new Error("oh no!");
          },
        });

        if (error) {
          return <div data-testid="error">{error.message}</div>;
        }
        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("error"));

      expect(getByTestId("error")).toHaveTextContent("Failed to fetch: oh no!");
    });
  });

  describe("with lazy", () => {
    it("should not fetch on mount", async () => {
      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = () => {
        const { data, error, loading } = useGet<{ oh: string }>({ path: "/", lazy: true });

        return children({ data, error, loading });
      };

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await wait(() => expect(children).toBeCalledTimes(1));
      expect(children).toHaveBeenCalledWith({ data: null, error: null, loading: false });
    });
  });
  describe("with base", () => {
    it("should override the base url", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/", base: "https://my-awesome-api.fake" });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https:/not-here.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("data"));
      expect(getByTestId("data")).toHaveTextContent("my god 😍");
    });

    it("should override the base url and compose with the path", async () => {
      nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/plop", base: "https://my-awesome-api.fake" });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https:/not-here.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("data"));
      expect(getByTestId("data")).toHaveTextContent("my god 😍");
    });
  });

  describe("with custom request options", () => {
    it("should add a custom header", async () => {
      nock("https://my-awesome-api.fake", { reqheaders: { foo: "bar" } })
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/", requestOptions: { headers: { foo: "bar" } } });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("data"));

      expect(getByTestId("data")).toHaveTextContent("my god 😍");
    });

    it("should merge headers with providers", async () => {
      nock("https://my-awesome-api.fake", { reqheaders: { foo: "bar", bar: "foo" } })
        .get("/")
        .reply(200, { oh: "my god 😍" });

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/", requestOptions: { headers: { foo: "bar" } } });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { getByTestId } = render(
        <RestfulProvider base="https://my-awesome-api.fake" requestOptions={() => ({ headers: { bar: "foo" } })}>
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      await waitForElement(() => getByTestId("data"));

      expect(getByTestId("data")).toHaveTextContent("my god 😍");
    });
  });

  describe("actions", () => {
    it("should refetch", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = () => {
        const params = useGet<{ id: number }>({ path: "/" });
        return children(params);
      };

      // initial fetch
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );
      expect(children.mock.calls[0][0].loading).toEqual(true);
      expect(children.mock.calls[0][0].data).toEqual(null);

      await wait(() => expect(children).toBeCalledTimes(2));
      expect(children.mock.calls[1][0].loading).toEqual(false);
      expect(children.mock.calls[1][0].data).toEqual({ id: 1 });

      // refetch
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 2 });
      children.mock.calls[1][0].refetch();
      await wait(() => expect(children).toHaveBeenCalledTimes(4));

      // transition state
      expect(children.mock.calls[2][0].loading).toEqual(true);
      expect(children.mock.calls[2][0].data).toEqual({ id: 1 });

      // after refetch state
      expect(children.mock.calls[3][0].loading).toEqual(false);
      expect(children.mock.calls[3][0].data).toEqual({ id: 2 });
    });

    it("should refetch with custom options", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = () => {
        const params = useGet<{ id: number }>({ path: "/" });
        return children(params);
      };

      // initial fetch
      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );
      expect(children.mock.calls[0][0].loading).toEqual(true);
      expect(children.mock.calls[0][0].data).toEqual(null);

      await wait(() => expect(children).toBeCalledTimes(2));
      expect(children.mock.calls[1][0].loading).toEqual(false);
      expect(children.mock.calls[1][0].data).toEqual({ id: 1 });

      // refetch
      nock("https://my-awesome-api.fake")
        .get("/plop")
        .reply(200, { id: 2 });
      children.mock.calls[1][0].refetch({ path: "/plop" });
      await wait(() => expect(children).toHaveBeenCalledTimes(4));

      // transition state
      expect(children.mock.calls[2][0].loading).toEqual(true);
      expect(children.mock.calls[2][0].data).toEqual({ id: 1 });

      // after refetch state
      expect(children.mock.calls[3][0].loading).toEqual(false);
      expect(children.mock.calls[3][0].data).toEqual({ id: 2 });
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

      const MyAwesomeComponent = ({ path }) => {
        const params = useGet<{ id: number }>({ path, debounce: true });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="?test=1" />
        </RestfulProvider>,
      );

      times(10, i =>
        rerender(
          <RestfulProvider base="https://my-awesome-api.fake">
            <MyAwesomeComponent path={`?test=${i + 1}`} />
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

      const MyAwesomeComponent = ({ path }) => {
        const params = useGet<{ id: number }>({ path });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="?test=1" />
        </RestfulProvider>,
      );

      times(10, i =>
        rerender(
          <RestfulProvider base="https://my-awesome-api.fake">
            <MyAwesomeComponent path={`?test=${i + 1}`} />
          </RestfulProvider>,
        ),
      );

      await wait(() => expect(apiCalls).toEqual(10));
    });
    it("should cancel the debounce on unmount", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ({ oh: "yeah" }));

      const resolve = jest.fn(val => val);

      const MyAwesomeComponent = () => {
        const { data, loading } = useGet<{ oh: string }>({ path: "/", resolve, debounce: true });

        return loading ? <div data-testid="loading">Loading…</div> : <div data-testid="data">{data.oh}</div>;
      };

      const { unmount } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent />
        </RestfulProvider>,
      );

      unmount();
      await new Promise(res => {
        setTimeout(res, 100);
      });
      expect(resolve).not.toHaveBeenCalled();
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

      const MyAwesomeComponent = ({ path }) => {
        const params = useGet<{ id: number }>({ path });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" />
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" />
        </RestfulProvider>,
      );

      expect(apiCalls).toEqual(1);
    });

    it("should refetch when path changes", async () => {
      const firstAPI = nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 1 });

      const secondAPI = nock("https://my-new-api.fake")
        .get("/plop")
        .reply(200, { id: 2 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = ({ path }) => {
        const params = useGet<{ id: number }>({ path });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" />
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-new-api.fake">
          <MyAwesomeComponent path="plop" />
        </RestfulProvider>,
      );

      expect(firstAPI.isDone()).toBeTruthy();
      expect(secondAPI.isDone()).toBeTruthy();
    });

    it("should refetch when resolve changes", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = ({ path, resolve }) => {
        const params = useGet<{ id: number }>({ path, resolve });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" resolve={() => "plop"} />
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" resolve={() => "hello"} />
        </RestfulProvider>,
      );

      expect(apiCalls).toBe(2);
    });

    it("should not refetch when resolve is the same", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = ({ path, resolve }) => {
        const params = useGet<{ id: number }>({ path, resolve });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" resolve={() => "plop"} />
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" resolve={() => "plop"} />
        </RestfulProvider>,
      );

      expect(apiCalls).toBe(1);
    });

    it("should refetch when queryParams changes", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .reply(200, { id: 0 });
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({ page: 2 })
        .reply(200, { id: 1 });

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = ({ path, queryParams }) => {
        const params = useGet<{ id: number }, any, { page: number }>({ path, queryParams });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" queryParams={null} />
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" queryParams={{ page: 2 }} />
        </RestfulProvider>,
      );

      await wait(() => expect(children).toBeCalledTimes(3));
      expect(children.mock.calls[2][0].loading).toEqual(false);
      expect(children.mock.calls[2][0].data).toEqual({ id: 1 });
    });

    it("should not refetch when queryParams are the same", () => {
      let apiCalls = 0;
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({ page: 2 })
        .reply(200, () => ++apiCalls)
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = ({ path, queryParams }) => {
        const params = useGet<{ id: number }, any, { page: number }>({ path, queryParams });
        return children(params);
      };

      const { rerender } = render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" queryParams={{ page: 2 }} />
        </RestfulProvider>,
      );

      rerender(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" queryParams={{ page: 2 }} />
        </RestfulProvider>,
      );

      expect(apiCalls).toBe(1);
    });
  });

  describe("with queryParams", () => {
    it("should call the correct endpoint", async () => {
      nock("https://my-awesome-api.fake")
        .get("/")
        .query({ page: 2 })
        .reply(200, () => ({ id: 42 }))
        .persist();

      const children = jest.fn();
      children.mockReturnValue(<div />);

      const MyAwesomeComponent = ({ path, queryParams }) => {
        const params = useGet<{ id: number }, any, { page: number }>({ path, queryParams });
        return children(params);
      };

      render(
        <RestfulProvider base="https://my-awesome-api.fake">
          <MyAwesomeComponent path="" queryParams={{ page: 2 }} />
        </RestfulProvider>,
      );

      await wait(() => expect(children).toBeCalledTimes(2));
      expect(children.mock.calls[1][0].loading).toEqual(false);
      expect(children.mock.calls[1][0].data).toEqual({ id: 42 });
    });
  });
});
