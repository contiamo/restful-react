# `restful-react`

Building React apps that interact with a RESTful API presents a set of questions, challenges and potential gotchas. This project aims to remove such pitfalls, and provide a pleasant developer experience when crafting such applications. It can be considered a thin wrapper around the [fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) in the form of React components and hooks.

As an abstraction, this tool allows for greater consistency and maintainability of dynamic codebases.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Features](#features)
  - [Global Configuration](#global-configuration)
    - [`RestfulProvider` API](#restfulprovider-api)
  - [Composability](#composability)
    - [Full `Get` Component API](#full-get-component-api)
  - [Loading and Error States](#loading-and-error-states)
  - [Lazy Fetching](#lazy-fetching)
  - [Response Resolution](#response-resolution)
  - [Debouncing Requests](#debouncing-requests)
  - [TypeScript Integration](#typescript-integration)
  - [Query Parameters](#query-parameters)
  - [Mutations with `Mutate`](#mutations-with-mutate)
    - [Full `Mutate` Component API](#full-mutate-component-api)
  - [Polling with `Poll`](#polling-with-poll)
    - [Long Polling](#long-polling)
    - [Full `Poll` Component API](#full-poll-component-api)
  - [Code Generation](#code-generation)
    - [Usage](#usage)
    - [Import from GitHub](#import-from-github)
    - [Transforming an Original Spec](#transforming-an-original-spec)
  - [Caching](#caching)
- [Contributing](#contributing)
  - [Code](#code)
  - [Dogfooding](#dogfooding)
- [Next Steps](#next-steps)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Overview

At its core, `restful-react` exposes a [hook](https://reactjs.org/docs/hooks-intro.html), called `useGet`. This component retrieves data, either on mount or later, and then handles error states, loading states, and other cases for you. As such, you get a component that _gets stuff_ and then does stuff with it. Here's a quick overview what it looks like.

[![Edit restful-react demos](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/restful-react-demos-vjets)

```jsx
import React from "react";
import { useGet } from "restful-react";

const MyComponent = () => {
  const { data: randomDogImage } = useGet({
    path: "https://dog.ceo/api/breeds/image/random",
  });

  return <img alt="Here's a good boye!" src={randomDogImage && randomDogImage.message} />;
};

export default MyComponent;
```

## Getting Started

To install and use this library, install it by running `yarn add restful-react`, or `npm i restful-react --save` and you should be good to go. Don't forget to `import { useGet } from "restful-react"` or similar wherever you need it!

## Features

`restful-react` ships with the following features that we think might be useful.

### Global Configuration

REST API endpoints usually sit alongside a base, global URL. As a convenience, the `RestfulProvider` allows top-level configuration of your requests, that are then passed down the React tree to `useGet` hooks.

Consider,

[![Edit restful-react demos](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/restful-react-demos-vjets)

```jsx
// index.js

import React from "react";
import { RestfulProvider } from "restful-react";

import App from "./App.jsx";

const MyRestfulApp = () => (
  <RestfulProvider base="https://dog.ceo/api">
    <App />
  </RestfulProvider>
);

export default MyRestfulApp;
```

Meanwhile, in `./App.jsx`,

```jsx
// App.jsx

import React from "react";
import { useGet } from "restful-react";

const MyComponent = () => {
  const { data: randomDogImage } = useGet({
    // Inferred from RestfulProvider in index.js
    path: "breeds/image/random",
  });

  return <img alt="Here's a good boye!" src={randomDogImage && randomDogImage.message} />;
};

export default MyComponent;
```

Naturally, the request will be sent to the full path `https://dog.ceo/api/breeds/image/random`. The full API of the `RestfulProvider` is outlined below. Each configuration option is composable and _can be_ overriden by `Get` components further down the tree.

#### `RestfulProvider` API

Here's a full overview of the API available through the `RestfulProvider`, along with its defaults.

```tsx
// Interface
export interface RestfulReactProviderProps<T = any> {
  /** The backend URL where the RESTful resources live. */
  base: string;
  /**
   * The path that gets accumulated from each level of nesting
   * taking the absolute and relative nature of each path into consideration
   */
  parentPath?: string;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<T>;
  /**
   * Options passed to the fetch request.
   */
  requestOptions?: (() => Partial<RequestInit>) | Partial<RequestInit>;
  /**
   * Trigger on each error.
   * For `Get` and `Mutation` calls, you can also call `retry` to retry the exact same request.
   * Please note that it's quite hard to retrieve the response data after a retry mutation in this case.
   * Depending of your case, it can be easier to add a `localErrorOnly` on your `Mutate` component
   * to deal with your retry locally instead of in the provider scope.
   */
  onError?: (err: any, retry: () => Promise<T | null>, response?: Response) => void;
}

// Usage
<RestfulProvider
  base="String!"
  resolve={data => data}
  requestOptions={authToken => ({ headers: { Authorization: authToken } })}
/>;
```

Here's some docs about the [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request) type of request options.

### Loading and Error States

`useGet` hooks return an object with loading and error states, to allow for state handling. Consider,

[![Edit restful-react demos](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/restful-react-demos-vjets)

```jsx
import React from "react";
import { useGet } from "restful-react";

const MyComponent = () => {
  const { data: randomDogImage, loading } = useGet({
    path: "https://dog.ceo/api/breeds/image/random",
  });

  return loading ? <h1>Loading...</h1> : <img alt="Here's a good boye!" src={randomDogImage.message} />;
};

export default MyComponent;
```

### Lazy Fetching

It is possible to use a `useGet` hook and defer the fetch to a later stage. This is done with the `lazy` boolean property. This is great for displaying UI immediately, and then allowing parts of it to be fetched as a response to an event: like the click of a button, for instance. Consider,

[![Edit restful-react demos](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/restful-react-demos-vjets)

```jsx
import React from "react";
import { useGet } from "restful-react";

const MyComponent = () => {
  const { data: randomDogImage, loading, refetch } = useGet({
    path: "https://dog.ceo/api/breeds/image/random",
    lazy: true,
  });

  return !randomDogImage && loading ? (
    <h1>Loading!</h1>
  ) : (
    <div>
      <div>
        <h1>Welcome to my image getter!</h1>
        <button onClick={() => refetch()}>Get a good boye!</button>
      </div>
      <div>{randomDogImage && <img alt="Here's a good boye!" src={randomDogImage.message} />}</div>
    </div>
  );
};

export default MyComponent;
```

The above example will display your UI, and then load good boyes on demand.

### Response Resolution

Sometimes, your backend responses arrive in a shape that you might want to adapt, validate, or restructure. Other times, maybe your data consistently arrives in a `{ data: {} }` shape, with `data` containing the stuff you want.

At the `RestfulProvider` level, _or_ on the `useGet` level, a `resolve` prop will take the data and _do stuff_ to it, providing the final resolved or unwrapped data to the children. Consider,

[![Edit restful-react demos](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/restful-react-demos-vjets)

```jsx
import React from "react";
import { useGet } from "restful-react";

const MyComponent = () => {
  const { data: imageUrl } = useGet({
    path: "https://dog.ceo/api/breeds/image/random",
    resolve: image => image && image.message,
  });

  return <img alt="Here's a good boye!" src={imageUrl} />;
};

export default MyComponent;
```

### Debouncing Requests

Some requests fire in response to a rapid succession of user events: things like autocomplete or resizing a window. For this reason, users sometimes need to wait until all the keystrokes are typed (until everything's _done_), before sending a request.

`restful-react` exposes a `debounce` prop on `Get` that does exactly this.

Here's an example:

```jsx
const SearchThis = props => {
  const { data } = useGet({
    path: "/hello/world",
    debounce: true,
  });

  return (
    <div>
      <h1>Here's all the things I search</h1>
      <ul>
        {data.map(thing => (
          <li>{thing}</li>
        ))}
      </ul>
    </div>
  );
};
```

Debounce also accepts a number, which tells `useGet` how long to wait until doing the request.

```diff
const SearchThis = props => {
  const { data } = useGet({
    path: "/hello/world",
-    debounce: true,
+    debounce: 200 /* ms */,
  })

  return <div>
        <h1>Here's all the things I search</h1>
        <ul>
          {data.map(thing => (
            <li>{thing}</li>
          ))}
        </ul>
      </div>
}
```

It uses [lodash's debounce](https://lodash.com/docs/4.17.10#debounce) function under the hood, so you get all the benefits of it out of the box like so!

```diff

const SearchThis = props => {
  const { data } = useGet({
    path: "/hello/world",
-    debounce: 200,
+    debounce: { wait: 200, options: { leading: true, maxWait: 300, trailing: false } } /* ms */,
  })

  return <div>
        <h1>Here's all the things I search</h1>
        <ul>
          {data.map(thing => (
            <li>{thing}</li>
          ))}
        </ul>
      </div>
}
```

### TypeScript Integration

One of the most poweful features of `restful-react` is that each component exported is strongly typed, empowering developers through self-documenting APIs.

![Using restful-react in VS Code](assets/labs.gif)

### Query Parameters

All components in this library support query params (`https://my.site/?query=param`) via a `queryParams` prop. Each `useGet`, `useMutate` and `Poll` instance is _generic_, having a type signature of `useGet<TData, TError, TQueryParams>`. If described, the `queryParams` prop is _fully_ type-safe in usage and provides autocomplete functionality.

![Autocompletion on QueryParams](assets/idp.gif)

Please note that the above example was built using our [OpenAPI generator](#code-generation) in order to infer the type of component from the specification and automatically generate the entire type-safe component in a _very_ quick and easy way.

### Mutations with `useMutate`

`restful-react` exposes an additional hook called `useMutate`. These components allow sending requests with other HTTP verbs in order to mutate backend resources.

[![Edit restful-react demos](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/restful-react-demos-vjets)

```jsx
import React from "react";
import { useGet, useMutate } from "restful-react";

const base = "https://jsonplaceholder.typicode.com";

const ListItem = ({ id, children }) => {
  const { mutate: del, loading } = useMutate({
    verb: "DELETE",
    path: `/posts/`,
    base,
  });

  return (
    <li key={id}>
      {loading ? (
        "Deleting..."
      ) : (
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            del(id).then(() => alert("Deleted successfully. Pretend it got removed from the DOM."));
          }}
        >
          ❌
        </a>
      )}
      &nbsp;{children}
    </li>
  );
};

const MyHugeList = () => {
  const { data: posts } = useGet({
    path: "/posts",
    base,
  });
  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts &&
          posts.map(post => (
            <ListItem key={post.id} id={post.id}>
              {post.title}
            </ListItem>
          ))}
      </ul>
    </div>
  );
};
export default MyHugeList;
```

`useMutate` is strongly typed, and provides intelligent autocompletion out of the box, complete with available verbs et al.

![Mutate](assets/mutate.png)

Each mutation returns a promise that can then be used to update local component state, dispatch an action, or do something else depending on your use case.

### Polling with `Poll`

`restful-react` also exports a `Poll` render props component that will poll a backend endpoint over a predetermined interval until a stop condition is met. Consider,

```jsx
import { Poll } from "restful-react"

<Poll path="/deployLogs" resolve={data => data && data.data}>
  {(deployLogs: DeployLog[], { loading }) =>
    loading ? (
      <PageSpinner />
    ) : (
      <DataTable
        columns={["createdAt", "deployId", "status", "sha", "message"]}
        orderBy="createdAt"
        data={deployLogs}
        formatters={{
          createdAt: (d: DeployLog["createdAt"]) => title(formatRelative(d, Date.now())),
          sha: (i: DeployLog["sha"]) => i && i.slice(0, 7),
        }}
      />
    )
  }
</Poll>
```

`Poll` supports:

- an `interval` prop that will poll at a specified interval (defaults to polling 1 second), and
- an `until` prop that accepts a condition expressed as a function that returns a boolean value. When this condition is met, polling will stop.
  - the signature of this function is `(data: T, response: ResponseInit) => boolean`. As a developer, you have access to the returned data, along with the response object in case you'd like to stop polling if `response.ok === false`, for example.

Below is a more convoluted example that employs nearly the full power of the `Poll` component.

```jsx
<Poll path="/status" until={(_, response) => response && response.ok} interval={0} lazy>
  {(_, { loading, error, finished, polling }, { start }) => {
    return loading ? (
      <Progress error={error} />
    ) : (
      <Button
        loading={editorLoading || polling}
        condensed
        icon="ExternalLink"
        color="ghost"
        onClick={() => {
          if (finished) {
            return window.open(editor.url);
          }
          requestEditor();
          start();
        }}
      >
        {finished ? "Launch Editor" : "Request Editor"}
      </Button>
    );
  }}
</Poll>
```

Note from the previous example, `Poll` also exposes more states: `finished`, and `polling` that allow better flow control, as well as lazy-start polls that can also be programatically stopped at a later stage.

#### Long Polling

At Contiamo, we have a [powerful Long Polling specification](docs/contiamo-long-poll.md) in place that allows us to build real-time apps over HTTPS, as opposed to WebSockets. At a glance the specification can be distilled into:

- Web UI sends a request with a `Prefer` header that contains:
  - a time, in seconds, to keep requests open (`60s`), and
  - a **polling index** that is a server-sent hash `ahpiegh`.
  - all together, the client sends a request with a header `Prefer: wait=60s;index=939192`.
- The backend server responds, either with:
  - an empty response with status `304 Not Modified`
  - a successful response with data and a new **polling index**.

The polling index allow the client and the server to stay in sync: the client says "the last stuff I got was at this index". The server says "oh, let me get you up to speed and send you a new index".

Visually, this is represented as below.

![Contiamo Poll](docs/long-poll-flow.png).

To get this functionality in `restful-react`, this means specifying a `wait` prop on your `Poll` component, provided your server implements this specification as well.

#### [Full `Poll` Component API](src/Poll.tsx#L53-L101)

### Code Generation

`restful-react` is able to generate _type-safe_ React components from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

#### Usage

Type-safe React data fetchers can be generated from an OpenAPI specification using the following command:

- `restful-react import --file MY_OPENAPI_SPEC.yaml --output my-awesome-generated-types.tsx`

This command can be invoked by _either_:

- Installing `restful-react` globally and running it in the terminal: `npm i -g restful-react`, or
- Adding a `script` to your `package.json` like so:

```diff
      "scripts": {
        "start": "webpack-dev-server",
        "build": "webpack -p",
+       "generate-fetcher": "restful-react import --file MY_SWAGGER_DOCS.json --output FETCHERS.tsx"
      }
```

Your components can then be generated by running `npm run generate-fetcher`. Optionally, we recommend linting/prettifying the output for readability like so:

```diff
      "scripts": {
        "start": "webpack-dev-server",
        "build": "webpack -p",
        "generate-fetcher": "restful-react import --file MY_SWAGGER_DOCS.json --output FETCHERS.tsx",
+       "postgenerate-fetcher": "prettier FETCHERS.d.tsx --write"
      }
```

#### Validation of the OpenAPI specification

To enforce the best quality as possible of specification, we have integrated the amazing [OpenAPI linter from IBM](https://github.com/IBM/openapi-validator). We strongly encourage you to setup your custom rules with a `.validaterc` file, you can find all useful information about this configuration [here](https://github.com/IBM/openapi-validator/#configuration).

To activate this, add a `--validation` flag to your `restful-react` call.

#### Import from GitHub

Adding the `--github` flag to `restful-react import` instead of using the `--file` flag allows us to **create React components from an OpenAPI spec _remotely hosted on GitHub._** <sup>_(how is this real life_ 🔥 _)_</sup>

To generate components from remote specifications, you'll need to follow the following steps:

1.  Visit [your GitHub settings](https://github.com/settings/tokens).
1.  Click **Generate New Token** and choose the following:

        Token Description: (enter anything)
        Scopes:
            [X] repo
                [X] repo:status
                [X] repo_deployment
                [X] public_repo
                [X] repo:invite

1.  Click **Generate token**.
1.  Copy the generated string.
1.  Open a terminal and run `restful-react import --github username:repo:branch:path/to/openapi.yaml --output MY_FETCHERS.tsx`, substituting things where necessary.
1.  You will be prompted for a token.
1.  Paste your token.
1.  You will be asked if you'd like to save it for later. This is _entirely_ up to you and completely safe: it is saved in your `node_modules` folder and _not_ committed to version control or sent to us or anything: the source code of this whole thing is public so you're safe.

    **Caveat:** _Since_ your token is stored in `node_modules`, your token will be removed on each `npm install` of `restful-react`.

1.  You're done! 🎉

#### Transforming an Original Spec

In some cases, you might need to augment an existing OpenAPI specification on the fly, for code-generation purposes. Our CLI makes this quite straightforward:

```bash
  restful-react import --file myspec.yaml --output mybettercomponents.tsx --transformer path/to/my-transformer.js
```

The function specified in `--transformer` is pure: it imports your `--file`, transforms it, and passes the augmented OpenAPI specification to `restful-react`'s generator. Here's how it can be used:

```ts
// /path/to/my-transformer.js

/**
 * Transformer function for restful-react.
 *
 * @param {OpenAPIObject} schema
 * @return {OpenAPIObject}
 */
module.exports = inputSchema => ({
  ...inputSchema,
  // Place your augmentations here
  paths: Object.entries(schema.paths).reduce(
    (mem, [path, pathItem]) => ({
      ...mem,
      [path]: Object.entries(pathItem).reduce(
        (pathItemMem, [verb, operation]) => ({
          ...pathItemMem,
          [verb]: {
            ...fixOperationId(path, verb, operation),
          },
        }),
        {},
      ),
    }),
    {},
  ),
});
```

#### Advanced configuration

`restful-react` supports the concept of "schema stitching" in a RESTful ecosystem as well. We are able to tie multiple backends together and generate code using a single configuration file, `restful-react.config.js`

To activate this "advanced mode", replace all flags from your `restful-react` call with the config flag: `--config restful-react.config.js` (or any filename that you want).

⚠️ **Note:** using a config file makes use of all of the options contained therein, and ignores all other CLI flags.

##### Config File Format

```ts
interface RestfulReactConfig {
  [backend: string]: {
    // classic configuration
    output: string;
    file?: string;
    github?: string;
    transformer?: string;
    validation?: boolean;

    // advanced configuration
    customImport?: string;
    customProps?: {
      base?: string;
    };
  };
}
```

##### Config File Example

```js
// restful-react.config.js
module.exports = {
  myFirstBackend: {
    output: "src/queries/myFirstBackend.tsx",
    file: "specs/my-first-backend.yaml",
    customProps: {
      base: `"http://my-first-backend.com"`,
    },
  },
  configurableBackend: {
    output: "src/queries/configurableBackend.tsx",
    github: "contiamo:restful-react:master:docs/swagger.json",
    customImport: `import { getConfig } from "../components/Config.tsx";`,
    customProps: {
      base: `{getConfig("backendBasePath")}`,
    },
  },
};
```

```json
// package.json
{
  "scripts": {
    "gen": "restful-react import --config restful-react.config.js",
    "gen-first": "restful-react import --config restful-react.config.js myFirstBackend"
  }
}
```

## Contributing

All contributions are welcome – especially:

- documentation,
- bug reports and issues,
- code contributions.

### Code

If you'd like to actively develop or help maintain this project, clone the repo and then `yarn watch` to get into dev mode. There are existing tests against which you can test the library. Typically, this looks like

- `git clone git@github.com:contiamo/restful-react.git`
- `cd restful-react`
- `yarn install`
- `yarn test --watch`

From there, you should be able to start developing without problems.

## Next Steps

We're actively developing this at Contiamo to meet our use cases as they arise. If you have a use case that you'd like to implement, do it! Open an issue, submit a Pull Request, have fun! We're friendly.
