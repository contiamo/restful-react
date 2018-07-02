# RESTful React

Building React apps that interact with a backend API presents a set of questions, challenges and potential gotchas. This project aims to remove such pitfalls, and provide a pleasant developer experience when crafting such applications. It can be considered a thin wrapper around the [fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) in the form of a React component.

As an abstraction, this tool allows for greater consistency and maintainability of dynamic codebases.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Features](#features)
  - [Global Configuration](#global-configuration)
    - [`RestfulProvider` API](#restfulprovider-api)
  - [Composability](#composability)
  - [Loading and Error States](#loading-and-error-states)
  - [Mutations](#mutations)
    - [Mutations API](#mutations-api)
  - [Lazy Fetching](#lazy-fetching)
  - [Response Resolution](#response-resolution)
  - [TypeScript Integration](#typescript-integration)
  - [Polling](#polling)
    - [`Poll` API](#poll-api)
  - [Caching](#caching)
- [Contributing](#contributing)
- [Next Steps](#next-steps)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Overview

At its core, RESTful React exposes a single component, called `Get`. This component retrieves data, either on mount or later, and then handles error states, caching, loading states, and other cases for you. As such, you simply get a component that _gets stuff_ and then does stuff with it. Here's a quick overview what it looks like.

```jsx
import React from "react";
import Get from "restful-react";

const MyComponent = () => (
  <Get path="https://dog.ceo/api/breeds/image/random">
    {randomDogImage => <img alt="Here's a good boye!" src={randomDogImage.message} />}
  </Get>
);

export default MyComponent;
```

## Getting Started

To install and use this library, simply `yarn add restful-react`, or `npm i restful-react --save` and you should be good to go. Don't forget to `import Get from "restful-react"` or similar wherever you need it!

## Features

### Global Configuration

API endpoints usually sit alongside a host, global URL. As a convenience, the `RestfulProvider` allows top-level configuration of your requests, that are then passed down the React tree to `Get` components.

Consider,

```jsx
import React from "react";
import { RestfulProvider } from "restful-react";

import App from "./App.jsx";

const MyRestfulApp = () => (
  <RestfulProvider host="https://dog.ceo/api">
    <App />
  </RestfulProvider>
);

export default MyRestfulApp;
```

Meanwhile, in `./App.jsx`,

```jsx
import React from "react";
import Get from "restful-react";

const MyComponent = () => (
  <Get path="/breeds/image/random">
    {randomDogImage => <img alt="Here's a good boye!" src={randomDogImage.message} />}
  </Get>
);

export default MyComponent;
```

Naturally, the request will be sent to the full path `https://dog.ceo/api/breeds/image/random`. The full API of the `RestfulProvider` is outlined below. Each configuration option is composable and _can be_ overriden by `Get` components further down the tree.

#### `RestfulProvider` API

Here's a full overview of the API available through the `RestfulProvider`, along with its defaults.

```tsx
// Interface
interface RestfulProviderProps<T> {
  /** The backend URL where the RESTful resources live. */
  host: string;
  /**
   * A function to resolve data return from the backend, most typically
   * used when the backend response needs to be adapted in some way.
   */
  resolve?: ResolveFunction<T>;
  /**
   * Options passed to the fetch request.
   */
  requestOptions?: Partial<RequestInit>;
}

// Usage
<RestfulProvider host="String!" resolve={data => data} requestOptions={{}} />;
```

Here's some docs about the [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request) type of request options.

### Composability

`Get` components can be composed together and request URLs at an accumulation of their collective path props. Consider,

```jsx
// Assuming we're using a RestfulProvider with host={HOST} somewhere,
<Get path="/cats">
  {data => {
    return (
      <div>
        <h1>Here are my cats!</h1>
        {data.map(cat => <img alt={cat.name} src={cat.photoUrl} />)}

        {/* Request HOST/cats/persian */}
        <Get path="/persian">
          {persianCats => {
            return (
              <div>
                <h2>Here are my persian cats!</h2>
                {persianCats.map(cat => <img alt={cat.name} src={cat.photoUrl} />)}
              </div>
            );
          }}
        </Get>
      </div>
    );
  }}
</Get>
```

From the above example, _not only_ does the path accumulate based on the nesting of each `Get`, but each get _can_ override its parent with other props as well: including having _specific_ `requestOptions` for each `Get` if there was a valid use case.

### Loading and Error States

`Get` components pass down loading and error states to their children, to allow for state handling. Consider,

```jsx
const MyAnimalsList = props => (
  <Get path={`/${props.animal}`}>
    {(animals, { loading, error }) =>
      loading ? (
        <Spinner />
      ) : (
        <div>
          You should only see this after things are loaded.
          {error ? (
            "OH NO!"
          ) : (
            <>
              <h1>Here are all my {props.animal}s!</h1>
              <ul>{animals.map(animal => <li>{animal}</li>)}</ul>
            </>
          )}
        </div>
      )
    }
  </Get>
);
```

Within [Operational UI](https://github.com/contiamo/operational-ui), all of our [`<Progress />`](https://operational-ui.netlify.com/#!/Progress) components support an `error` prop. For _even_ better request state handling, we can write:

```jsx
const MyAnimalsList = props => (
  <Get path={`/${props.animal}`}>
    {(animals, { loading, error }) =>
      loading ? (
        <Progress error={error} />
      ) : (
        <div>
          You should only see this after things are loaded.
          <h1>Here are all my {props.animal}s!</h1>
          <ul>{animals.map(animal => <li>{animal}</li>)}</ul>
        </div>
      )
    }
  </Get>
);
```

### Mutations

`Get` components pass mutation functions as the third argument to their children. Consider,

```jsx
const Movies = ({ dispatch }) => (
  <ul>
    <Get path="/movies">
      {(movies, states, actions) =>
        movies.map(movie => (
          <li>
            {movie.name}

            {/* Will send a DELETE request to HOST/movies/:movie.id */}
            <button
              onClick={_ =>
                actions
                  .delete(movie.id)
                  .then(returnedData => dispatch({ type: "DELETED_MOVIE", payload: returnedData }))
              }
            >
              Delete!
            </button>
          </li>
        ))
      }
    </Get>
  </ul>
);
```

The same mutation objects exist for all HTTP verbs, including `get`, `post`, `put`, and `patch`. Methods `post`, `put`, and `patch` all expect a body as their first argument, and all mutation functions receive `requestOptions` as their optional second argument.

Each mutation returns a promise, that can then be used to update local component state, or dispatch an action, or do something else depending on your use case.

#### Mutations API

Here are the functions passed as the second argument to children of `Get` with their signatures.

```ts
interface Mutations<T> {
  get: (path?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  destroy: (id?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  post: (data?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  put: (data?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
  patch: (data?: string, requestOptions?: Partial<RequestInit>) => Promise<T | null>;
}
```

### Lazy Fetching

It is possible to render a `Get` component and defer the fetch to a later stage. This is done with the `lazy` boolean prop. This is great for displaying UI immediately, and then allowing parts of it to be fetched as a response to an event: like the click of a button, for instance. Consider,

```jsx
<Get path="/unicorns" lazy>
  {(unicorns, states, { get }) => (
    <div>
      <h1>Are you ready?</h1>
      <p>Are you ready to unleash all the magic? If yes, click this button!</p>
      <button onClick={get}>GET UNICORNS!!!!!!</button>

      {unicorns && <ul>{unicorns.map((unicorn, index) => <li key={index}>{unicorn}</li>)}</ul>}
    </div>
  )}
</Get>
```

The above example will display your UI, and then load unicorns on demand.

### Response Resolution

Sometimes, your backend responses arrive in a shape that you might want to adapt, validate, or reshape. Other times, maybe your data consistently arrives in a `{ data: {} }` shape, with `data` containing the stuff you want.

At the `RestfulProvider` level, _or_ on the `Get` level, a `resolve` prop will take the data and _do stuff_ to it, providing the final resolved data to the children. Consider,

```jsx
const myNestedData = props => (
  <Get
    path="/this-should-be-simpler"
    resolve={response => response.data.what.omg.how.map(singleThing => singleThing.name)}
  >
    {data => (
      <div>
        <h1>Here's all the things I want</h1>
        <ul>{data.map(thing => <li>{thing}</li>)}</ul>
      </div>
    )}
  </Get>
);
```

### TypeScript Integration

One of the most poweful features of RESTful React, each component exported is strongly typed, empowering developers through self-documenting APIs. As for _returned_ data, simply tell your data prop _what_ you expect, and it'll be available to you throughout your usage of `children`.

![Using RESTful React in VS Code](assets/labs.gif)

### Polling

RESTful React also exports a `Poll` component that will poll a backend endpoint over a predetermined interval until a stop condition is met. Consider,

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

Note the API similarities that we have already uncovered. In essence, `Poll` and `Get` have near-identical APIs, allowing developers to quickly swap out `<Get />` for `<Poll />` calls and have the transition happen seamlessly. This is powerful in the world of an ever-changing startup that may have volatile requirements.

In addition to the `Get` component API, `Poll` also supports:

- an `interval` prop that will poll at a specified interval (defaults to polling 1 second), and
- an `until` prop that accepts a condition expressed as a function that returns a boolean value. When this condition is met, polling will stop.
  - the signature of this function is `(data: T, response: Response) => boolean`. As a developer, you have access to the returned data, along with the response object in case you'd like to stop polling if `response.ok === false`, for example.

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

#### `Poll` API

Below is the full `Poll` component API.

```ts
interface Poll<T> {
  /**
   * What path are we polling on?
   */
  path: GetComponentProps<T>["path"];
  /**
   * A function that gets polled data, the current
   * states, meta information, and various actions
   * that can be executed at the poll-level.
   */
  children: (data: T | null, states: States<T>, actions: Actions, meta: Meta) => React.ReactNode;
  /**
   * How long do we wait between requests?
   * Value in milliseconds.
   * Defaults to 1000.
   */
  interval?: number;
  /**
   * A stop condition for the poll that expects
   * a boolean.
   *
   * @param data - The data returned from the poll.
   * @param response - The full response object. This could be useful in order to stop polling when !response.ok, for example.
   */
  until?: (data: T | null, response: Response | null) => boolean;
  /**
   * Are we going to wait to start the poll?
   * Use this with { start, stop } actions.
   */
  lazy?: GetComponentProps<T>["lazy"];
  /**
   * Should the data be transformed in any way?
   */
  resolve?: GetComponentProps<T>["resolve"];
  /**
   * We can request foreign URLs with this prop.
   */
  host?: GetComponentProps<T>["host"];
  /**
   * Any options to be passed to this request.
   */
  requestOptions?: GetComponentProps<T>["requestOptions"];
}

/**
 * Actions that can be executed within the
 * component.
 */
interface Actions {
  start: () => void;
  stop: () => void;
}

/**
 * States of the current poll
 */
interface States<T> {
  /**
   * Is the component currently polling?
   */
  polling: boolean;
  /**
   * Is the initial request loading?
   */
  loading: boolean;
  /**
   * Has the poll concluded?
   */
  finished: boolean;
  /**
   * Is there an error? What is it?
   */
  error?: string;
}

/**
 * Meta information returned from the poll.
 */
interface Meta extends GetComponentMeta {
  /**
   * The entire response object.
   */
  response: Response | null;
}
```

### Caching

This doesn't exist yet.
Please contribute a solution here until something happens.

There's a general idea of checking if the results are a collection or a resource, and then:

- If collection, cache.
- If resource,

  - Is resource in cached collection?
    - update cached resource.

## Contributing

If you'd like to actively develop or maintain this project, clone the repo and then `yarn watch` to get into dev mode. This project works great when [dogfooded](https://www.google.com/search?q=dogfooding): I'd suggest creating a separate project somewhere (or using an existing one), and using your fork in your project. To do so, after cloning and `npm i`,

- `npm link` inside of the root folder of this project,
- go to your consumer project,
- `npm link restful-react` in there, and `npm` will link the packages.

You can now `import Get from "restful-react"` and do all the things you'd like to do, including test and develop new features for the project to meet your use case.

## Next Steps

We're actively developing this at Contiamo to meet our use cases as they arise. If you have a use case that you'd like to implement, do it! Open an issue, submit a Pull Request, have fun! We're friendly.
