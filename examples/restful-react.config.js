/**
 * Example config for `yarn example:advanced`
 */

const { camel } = require("case");

/**
 * @type {import("../src/bin/config").RestfulReactAdvancedConfiguration}
 */
module.exports = {
  "petstore-file": {
    file: "examples/petstore.yaml",
    output: "examples/petstoreFromFileSpecWithConfig.tsx",
  },
  "petstore-github": {
    github: "OAI:OpenAPI-Specification:master:examples/v3.0/petstore.yaml",
    output: "examples/petstoreFromGithubSpecWithConfig.tsx",
    customImport: "/* a custom import */",
    customProps: {
      base: `"http://my-pet-store.com"`,
    },
  },
  "petstore-custom-fetch": {
    file: "examples/petstore.yaml",
    output: "examples/petstoreFromFileSpecWithCustomFetch.tsx",
    customImport: `import { customGet, customMutate, CustomGetProps, CustomMutateProps } from "./fetchers"`,
    customGenerator: ({ componentName, verb, route, description, genericsTypes, paramsInPath, paramsTypes }) => {
      const propsType = type =>
        `Custom${type}Props<${genericsTypes}>${paramsInPath.length ? ` & {${paramsTypes}}` : ""}`;

      return verb === "get"
        ? `${description}export const ${camel(componentName)} = (${
            paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
          }: ${propsType(
            "Get",
          )}, signal?: RequestInit["signal"]) => customGet<${genericsTypes}>(\`http://petstore.swagger.io/v1${route}\`, props, signal);\n\n`
        : `${description}export const ${camel(componentName)} = (${
            paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
          }: ${propsType(
            "Mutate",
          )}, signal?: RequestInit["signal"]) => customMutate<${genericsTypes}>("${verb.toUpperCase()}", \`http://petstore.swagger.io/v1${route}\`, props, signal);\n\n`;
    },
  },
};
