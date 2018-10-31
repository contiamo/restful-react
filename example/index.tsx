import * as React from "react";
import { render } from "react-dom";

import { Get, RestfulProvider } from "../src";

const wait = timeout =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });

const App: React.SFC<{}> = props => (
  <RestfulProvider base="https://dog.ceo">
    <Get path="/api/breeds/list/all" resolve={res => wait(1500).then(() => Promise.resolve(Object.keys(res.message)))}>
      {(breeds, { loading, error }) => {
        if (loading) {
          return "loading..";
        }
        if (error) {
          return <code>{JSON.stringify(error)}</code>;
        }
        if (breeds) {
          return <ul>{breeds.map((breed, breedIndex) => <li key={breedIndex}>{breed}</li>)}</ul>;
        }
        return null;
      }}
    </Get>
  </RestfulProvider>
);

render(<App />, document.querySelector("#app"));
