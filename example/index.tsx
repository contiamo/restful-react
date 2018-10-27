import React from "react";
import { render } from "react-dom";

import { RestfulProvider, useGet } from "../src";

const ShowMeADog = () => {
  const { data, loading } = useGet<{ message: string }>({ path: "" });

  return loading ? <div>Loading…</div> : <img src={data ? data.message : ""} />;
};

const App = () => (
  <RestfulProvider base="https://dog.ceo/api/breeds/image/random">
    <ShowMeADog />
  </RestfulProvider>
);

render(<App />, document.getElementById("app"));
