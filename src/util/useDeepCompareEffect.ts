import isEqualWith from "lodash/isEqualWith";
import React, { useEffect, useRef } from "react";

function useDeepCompareMemoize(value: Readonly<any>) {
  const ref = useRef<any>();

  if (
    !isEqualWith(value, ref.current, (a, b) => {
      // Deal with the function comparison case
      if (typeof a === "function" && typeof b === "function") {
        return a.toString() === b.toString();
      }
      // Fallback on the method
      return undefined;
    })
  ) {
    ref.current = value;
  }

  return ref.current;
}

/**
 * Accepts a function that contains imperative, possibly effectful code.
 *
 * This is the deepCompare version of the `React.useEffect` hooks (that is shallowed compare)
 *
 * @param effect Imperative function that can return a cleanup function
 * @param deps If present, effect will only activate if the values in the list change.
 *
 * @see https://gist.github.com/kentcdodds/fb8540a05c43faf636dd68647747b074#gistcomment-2830503
 */
export function useDeepCompareEffect<T>(effect: React.EffectCallback, deps: T) {
  useEffect(effect, useDeepCompareMemoize(deps));
}
