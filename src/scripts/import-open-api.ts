import { pascal } from "case";
import chalk from "chalk";
import openApiValidator from "ibm-openapi-validator";
import get from "lodash/get";
import groupBy from "lodash/groupBy";
import isEmpty from "lodash/isEmpty";
import set from "lodash/set";
import uniq from "lodash/uniq";

import {
  ComponentsObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from "openapi3-ts";

import swagger2openapi from "swagger2openapi";

import YAML from "yamljs";
import { AdvancedOptions } from "../bin/restful-react-import";

const IdentifierRegexp = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Discriminator helper for `ReferenceObject`
 *
 * @param property
 */
export const isReference = (property: any): property is ReferenceObject => {
  return Boolean(property.$ref);
};

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getScalar = (item: SchemaObject) => {
  const nullable = item.nullable ? " | null" : "";

  switch (item.type) {
    case "int32":
    case "int64":
    case "number":
    case "integer":
    case "long":
    case "float":
    case "double":
      return "number" + nullable;

    case "boolean":
      return "boolean" + nullable;

    case "array":
      return getArray(item) + nullable;

    case "string":
    case "byte":
    case "binary":
    case "date":
    case "dateTime":
    case "date-time":
    case "password":
      return (item.enum ? `"${item.enum.join(`" | "`)}"` : "string") + nullable;

    case "object":
    default:
      return getObject(item) + nullable;
  }
};

/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export const getRef = ($ref: ReferenceObject["$ref"]) => {
  if ($ref.startsWith("#/components/schemas")) {
    return pascal($ref.replace("#/components/schemas/", ""));
  } else if ($ref.startsWith("#/components/responses")) {
    return pascal($ref.replace("#/components/responses/", "")) + "Response";
  } else if ($ref.startsWith("#/components/parameters")) {
    return pascal($ref.replace("#/components/parameters/", "")) + "Parameter";
  } else if ($ref.startsWith("#/components/requestBodies")) {
    return pascal($ref.replace("#/components/requestBodies/", "")) + "RequestBody";
  } else {
    throw new Error("This library only resolve $ref that are include into `#/components/*` for now");
  }
};

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = (item: SchemaObject): string => {
  if (item.items) {
    if (!isReference(item.items) && (item.items.oneOf || item.items.allOf)) {
      return `(${resolveValue(item.items)})[]`;
    } else {
      return `${resolveValue(item.items)}[]`;
    }
  } else {
    throw new Error("All arrays must have an `items` key define");
  }
};

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (item: SchemaObject): string => {
  if (isReference(item)) {
    return getRef(item.$ref);
  }

  if (item.allOf) {
    return item.allOf.map(resolveValue).join(" & ");
  }

  if (item.oneOf) {
    return item.oneOf.map(resolveValue).join(" | ");
  }

  if (!item.type && !item.properties && !item.additionalProperties) {
    return "{}";
  }

  // Free form object (https://swagger.io/docs/specification/data-models/data-types/#free-form)
  if (
    item.type === "object" &&
    !item.properties &&
    (!item.additionalProperties || item.additionalProperties === true || isEmpty(item.additionalProperties))
  ) {
    return "{[key: string]: any}";
  }

  // Consolidation of item.properties & item.additionalProperties
  let output = "{\n";
  if (item.properties) {
    output += Object.entries(item.properties)
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        const doc = isReference(prop) ? "" : formatDescription(prop.description, 2);
        const isRequired = (item.required || []).includes(key);
        const processedKey = IdentifierRegexp.test(key) ? key : `"${key}"`;
        return `  ${doc}${processedKey}${isRequired ? "" : "?"}: ${resolveValue(prop)};`;
      })
      .join("\n");
  }

  if (item.additionalProperties) {
    if (item.properties) {
      output += "\n";
    }
    output += `  [key: string]: ${
      item.additionalProperties === true ? "any" : resolveValue(item.additionalProperties)
    };`;
  }

  if (item.properties || item.additionalProperties) {
    if (output === "{\n") return "{}";
    return output + "\n}";
  }

  return item.type === "object" ? "{[key: string]: any}" : "any";
};

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = (schema: SchemaObject) => (isReference(schema) ? getRef(schema.$ref) : getScalar(schema));

/**
 * Extract responses / request types from open-api specs
 *
 * @param responsesOrRequests reponses or requests object from open-api specs
 */
export const getResReqTypes = (
  responsesOrRequests: Array<[string, ResponseObject | ReferenceObject | RequestBodyObject]>,
) =>
  uniq(
    responsesOrRequests.map(([_, res]) => {
      if (!res) {
        return "void";
      }

      if (isReference(res)) {
        return getRef(res.$ref);
      } else {
        if (res.content && res.content["application/json"]) {
          const schema = res.content["application/json"].schema!;
          return resolveValue(schema);
        } else if (res.content && res.content["application/octet-stream"]) {
          const schema = res.content["application/octet-stream"].schema!;
          return resolveValue(schema);
        } else {
          return "void";
        }
      }
    }),
  ).join(" | ");

/**
 * Return every params in a path
 *
 * @example
 * ```
 * getParamsInPath("/pet/{category}/{name}/");
 * // => ["category", "name"]
 * ```
 * @param path
 */
export const getParamsInPath = (path: string) => {
  let n;
  const output = [];
  const templatePathRegex = /\{(\w+)}/g;
  // tslint:disable-next-line:no-conditional-assignment
  while ((n = templatePathRegex.exec(path)) !== null) {
    output.push(n[1]);
  }

  return output;
};

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param data raw data of the spec
 * @param format format of the spec
 */
const importSpecs = (data: string, extension: "yaml" | "json"): Promise<OpenAPIObject> => {
  const schema = extension === "yaml" ? YAML.parse(data) : JSON.parse(data);

  return new Promise((resolve, reject) => {
    if (!schema.openapi || !schema.openapi.startsWith("3.0")) {
      swagger2openapi.convertObj(schema, {}, (err, convertedObj) => {
        if (err) {
          reject(err);
        } else {
          resolve(convertedObj.openapi);
        }
      });
    } else {
      resolve(schema);
    }
  });
};

/**
 * Take a react props value style and convert it to object style
 *
 * Example:
 *  reactPropsValueToObjectValue(`{ getConfig("myVar") }`) // `getConfig("myVar")`
 */
export const reactPropsValueToObjectValue = (value: string) => value.replace(/^{(.*)}$/, "$1");

/**
 * Generate a restful-react component from openapi operation specs
 *
 * @param operation
 * @param verb
 * @param route
 * @param baseUrl
 * @param operationIds - List of `operationId` to check duplication
 */
export const generateRestfulComponent = (
  operation: OperationObject,
  verb: string,
  route: string,
  operationIds: string[],
  parameters: Array<ReferenceObject | ParameterObject> = [],
  schemasComponents?: ComponentsObject,
  customProps: AdvancedOptions["customProps"] = {},
  customGenerator?: AdvancedOptions["customGenerator"],
) => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }
  if (operationIds.includes(operation.operationId)) {
    throw new Error(`"${operation.operationId}" is duplicated in your schema definition!`);
  }
  operationIds.push(operation.operationId);

  route = route.replace(/\{/g, "${"); // `/pet/{id}` => `/pet/${id}`

  // Remove the last param of the route if we are in the DELETE case
  let lastParamInTheRoute: string | null = null;
  if (verb === "delete") {
    const lastParamInTheRouteRegExp = /\/\$\{(\w+)\}\/?$/;
    lastParamInTheRoute = (route.match(lastParamInTheRouteRegExp) || [])[1];
    route = route.replace(lastParamInTheRouteRegExp, ""); // `/pet/${id}` => `/pet`
  }
  const componentName = pascal(operation.operationId!);
  const Component = verb === "get" ? "Get" : "Mutate";

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) => statusCode.toString().startsWith("2");
  const isError = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
    statusCode.toString().startsWith("4") || statusCode.toString().startsWith("5") || statusCode === "default";

  const responseTypes = getResReqTypes(Object.entries(operation.responses).filter(isOk)) || "void";
  const errorTypes = getResReqTypes(Object.entries(operation.responses).filter(isError)) || "unknown";
  const requestBodyTypes = getResReqTypes([["body", operation.requestBody!]]);
  const needARequestBodyComponent = requestBodyTypes.includes("{");
  const needAResponseComponent = responseTypes.includes("{");

  /**
   * We strip the ID from the URL in order to pass it as an argument to the
   * `delete` function for generated <DeleteResource /> components.
   *
   * For example:
   *
   *  A given request
   *    DELETE https://my.api/resource/123
   *
   *  Becomes
   *    <DeleteResource>
   *      {(deleteThisThing) => <Button onClick={() => deleteThisThing("123")}>DELETE IT</Button>}
   *    </DeleteResource>
   */

  const paramsInPath = getParamsInPath(route).filter(param => !(verb === "delete" && param === lastParamInTheRoute));
  const { query: queryParams = [], path: pathParams = [], header: headerParams = [] } = groupBy(
    [...parameters, ...(operation.parameters || [])].map<ParameterObject>(p => {
      if (isReference(p)) {
        return get(schemasComponents, p.$ref.replace("#/components/", "").replace("/", "."));
      } else {
        return p;
      }
    }),
    "in",
  );

  const paramsTypes = paramsInPath
    .map(p => {
      try {
        const { name, required, schema } = pathParams.find(i => i.name === p)!;
        return `${name}${required ? "" : "?"}: ${resolveValue(schema!)}`;
      } catch (err) {
        throw new Error(`The path params ${p} can't be found in parameters (${operation.operationId})`);
      }
    })
    .join("; ");

  const queryParamsType = queryParams
    .map(p => {
      const processedName = IdentifierRegexp.test(p.name) ? p.name : `"${p.name}"`;
      return `${formatDescription(p.description, 2)}${processedName}${p.required ? "" : "?"}: ${resolveValue(
        p.schema!,
      )}`;
    })
    .join(";\n  ");

  const genericsTypes =
    verb === "get"
      ? `${needAResponseComponent ? componentName + "Response" : responseTypes}, ${errorTypes}, ${
          queryParamsType ? componentName + "QueryParams" : "void"
        }`
      : `${needAResponseComponent ? componentName + "Response" : responseTypes}, ${errorTypes}, ${
          queryParamsType ? componentName + "QueryParams" : "void"
        }, ${
          verb === "delete" && lastParamInTheRoute
            ? "string"
            : needARequestBodyComponent
            ? componentName + "RequestBody"
            : requestBodyTypes
        }`;

  const genericsTypesForHooksProps =
    verb === "get"
      ? `${needAResponseComponent ? componentName + "Response" : responseTypes}, ${
          queryParamsType ? componentName + "QueryParams" : "void"
        }`
      : `${needAResponseComponent ? componentName + "Response" : responseTypes}, ${
          queryParamsType ? componentName + "QueryParams" : "void"
        }, ${
          verb === "delete" && lastParamInTheRoute
            ? "string"
            : needARequestBodyComponent
            ? componentName + "RequestBody"
            : requestBodyTypes
        }`;

  const customPropsEntries = Object.entries(customProps);

  const description = formatDescription(
    operation.summary && operation.description
      ? `${operation.summary}\n\n${operation.description}`
      : `${operation.summary || ""}${operation.description || ""}`,
  );

  let output = `${
    needAResponseComponent
      ? `
export ${
          responseTypes.includes("|") ? `type ${componentName}Response =` : `interface ${componentName}Response`
        } ${responseTypes}
`
      : ""
  }${
    queryParamsType
      ? `
export interface ${componentName}QueryParams {
  ${queryParamsType};
}
`
      : ""
  }${
    needARequestBodyComponent
      ? `
export interface ${componentName}RequestBody ${requestBodyTypes}
`
      : ""
  }
export type ${componentName}Props = Omit<${Component}Props<${genericsTypes}>, "path"${
    verb === "get" ? "" : ` | "verb"`
  }>${paramsInPath.length ? ` & {${paramsTypes}}` : ""};

${description}export const ${componentName} = (${
    paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
  }: ${componentName}Props) => (
  <${Component}<${genericsTypes}>${
    verb === "get"
      ? ""
      : `
    verb="${verb.toUpperCase()}"`
  }
    path={\`${route}\`}${
    customPropsEntries.length
      ? "\n    " + customPropsEntries.map(([key, value]) => `${key}=${value}`).join("\n    ")
      : ""
  }
    {...props}
  />
);

`;

  // Hooks version
  output += `export type Use${componentName}Props = Omit<Use${Component}Props<${genericsTypesForHooksProps}>, "path"${
    verb === "get" ? "" : ` | "verb"`
  }>${paramsInPath.length ? ` & {${paramsTypes}}` : ""};

${description}export const use${componentName} = (${
    paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
  }: Use${componentName}Props) => use${Component}<${genericsTypes}>(${
    verb === "get" ? "" : `"${verb.toUpperCase()}", `
  }\`${route}\`, ${
    customPropsEntries.length
      ? `{ ${customPropsEntries
          .map(([key, value]) => `${key}:${reactPropsValueToObjectValue(value || "")}`)
          .join(", ")}, ...props}`
      : "props"
  });

`;

  // Custom version
  if (customGenerator) {
    output += customGenerator({
      componentName,
      verb,
      route,
      description,
      genericsTypes,
      operation,
    });
  }

  if (headerParams.map(({ name }) => name.toLocaleLowerCase()).includes("prefer")) {
    output += `export type Poll${componentName}Props = Omit<PollProps<${genericsTypes}>, "path">${
      paramsInPath.length ? ` & {${paramsTypes}}` : ""
    };

${operation.summary ? `// ${operation.summary} (long polling)` : ""}
export const Poll${componentName} = (${
      paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
    }: Poll${componentName}Props) => (
  <Poll<${genericsTypes}>
    path={\`${route}\`}
    {...props}
  />
);

`;
  }

  return output;
};

/**
 * Generate the interface string
 *
 * @param name interface name
 * @param schema
 */
export const generateInterface = (name: string, schema: SchemaObject) => {
  const scalar = getScalar(schema);
  return `${formatDescription(schema.description)}export interface ${pascal(name)} ${scalar}`;
};

/**
 * Propagate every `discriminator.propertyName` mapping to the original ref
 *
 * Note: This method directly mutate the `specs` object.
 *
 * @param specs
 */
export const resolveDiscriminator = (specs: OpenAPIObject) => {
  if (specs.components && specs.components.schemas) {
    Object.values(specs.components.schemas).forEach(schema => {
      if (isReference(schema) || !schema.discriminator || !schema.discriminator.mapping) {
        return;
      }
      const { mapping, propertyName } = schema.discriminator;

      Object.entries(mapping).forEach(([name, ref]) => {
        if (!ref.startsWith("#/components/schemas/")) {
          throw new Error("Discriminator mapping outside of `#/components/schemas` is not supported");
        }
        set(specs, `components.schemas.${ref.slice("#/components/schemas/".length)}.properties.${propertyName}.enum`, [
          name,
        ]);
      });
    });
  }
};

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemasDefinition = (schemas: ComponentsObject["schemas"] = {}) => {
  if (isEmpty(schemas)) {
    return "";
  }

  return (
    Object.entries(schemas)
      .map(([name, schema]) =>
        !isReference(schema) &&
        (!schema.type || schema.type === "object") &&
        !schema.allOf &&
        !schema.oneOf &&
        !isReference(schema) &&
        !schema.nullable
          ? generateInterface(name, schema)
          : `${formatDescription(isReference(schema) ? undefined : schema.description)}export type ${pascal(
              name,
            )} = ${resolveValue(schema)};`,
      )
      .join("\n\n") + "\n"
  );
};

/**
 * Extract all types from #/components/requestBodies
 *
 * @param requestBodies
 */
export const generateRequestBodiesDefinition = (requestBodies: ComponentsObject["requestBodies"] = {}) => {
  if (isEmpty(requestBodies)) {
    return "";
  }

  return (
    "\n" +
    Object.entries(requestBodies)
      .map(([name, requestBody]) => {
        const doc = isReference(requestBody) ? "" : formatDescription(requestBody.description);
        const type = getResReqTypes([["", requestBody]]);
        const isEmptyInterface = type === "{}";
        if (isEmptyInterface) {
          return `// tslint:disable-next-line:no-empty-interface
export interface ${pascal(name)}RequestBody ${type}`;
        } else if (type.includes("{") && !type.includes("|") && !type.includes("&")) {
          return `${doc}export interface ${pascal(name)}RequestBody ${type}`;
        } else {
          return `${doc}export type ${pascal(name)}RequestBody = ${type};`;
        }
      })
      .join("\n\n") +
    "\n"
  );
};

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (responses: ComponentsObject["responses"] = {}) => {
  if (isEmpty(responses)) {
    return "";
  }

  return (
    "\n" +
    Object.entries(responses)
      .map(([name, response]) => {
        const doc = isReference(response) ? "" : formatDescription(response.description);
        const type = getResReqTypes([["", response]]);
        const isEmptyInterface = type === "{}";
        if (isEmptyInterface) {
          return `// tslint:disable-next-line:no-empty-interface
export interface ${pascal(name)}Response ${type}`;
        } else if (type.includes("{") && !type.includes("|") && !type.includes("&")) {
          return `${doc}export interface ${pascal(name)}Response ${type}`;
        } else {
          return `${doc}export type ${pascal(name)}Response = ${type};`;
        }
      })
      .join("\n\n") +
    "\n"
  );
};

/**
 * Format a description to code documentation.
 *
 * @param description
 */
export const formatDescription = (description?: string, tabSize = 0) =>
  description
    ? `/**\n${description
        .split("\n")
        .map(i => `${" ".repeat(tabSize)} * ${i}`)
        .join("\n")}\n${" ".repeat(tabSize)} */\n${" ".repeat(tabSize)}`
    : "";

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 *
 * @param specs openAPI spec
 */
const validate = async (specs: OpenAPIObject) => {
  // tslint:disable:no-console
  const log = console.log;

  // Catch the internal console.log to add some information if needed
  // because openApiValidator() calls console.log internally and
  // we want to add more context if it's used
  let wasConsoleLogCalledFromBlackBox = false;
  console.log = (...props: any) => {
    wasConsoleLogCalledFromBlackBox = true;
    log(...props);
  };
  const { errors, warnings } = await openApiValidator(specs);
  console.log = log; // reset console.log because we're done with the black box

  if (wasConsoleLogCalledFromBlackBox) {
    log("More information: https://github.com/IBM/openapi-validator/#configuration");
  }
  if (warnings.length) {
    log(chalk.yellow("(!) Warnings"));
    warnings.forEach(i =>
      log(
        chalk.yellow(`
Message : ${i.message}
Path    : ${i.path}`),
      ),
    );
  }
  if (errors.length) {
    log(chalk.red("(!) Errors"));
    errors.forEach(i =>
      log(
        chalk.red(`
Message : ${i.message}
Path    : ${i.path}`),
      ),
    );
  }
  // tslint:enable:no-console
};

/**
 * Main entry of the generator. Generate restful-react component from openAPI.
 *
 * @param options.data raw data of the spec
 * @param options.format format of the spec
 * @param options.transformer custom function to transform your spec
 * @param options.validation validate the spec with ibm-openapi-validator tool
 */
const importOpenApi = async ({
  data,
  format,
  transformer,
  validation,
  customImport,
  customProps,
  customGenerator,
}: {
  data: string;
  format: "yaml" | "json";
  transformer?: (specs: OpenAPIObject) => OpenAPIObject;
  validation?: boolean;
  customImport?: AdvancedOptions["customImport"];
  customProps?: AdvancedOptions["customProps"];
  customGenerator?: AdvancedOptions["customGenerator"];
}) => {
  const operationIds: string[] = [];
  let specs = await importSpecs(data, format);
  if (transformer) {
    specs = transformer(specs);
  }

  if (validation) {
    await validate(specs);
  }

  resolveDiscriminator(specs);

  let output = "";

  output += generateSchemasDefinition(specs.components && specs.components.schemas);
  output += generateRequestBodiesDefinition(specs.components && specs.components.requestBodies);
  output += generateResponsesDefinition(specs.components && specs.components.responses);
  Object.entries(specs.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (["get", "post", "patch", "put", "delete"].includes(verb)) {
        output += generateRestfulComponent(
          operation,
          verb,
          route,
          operationIds,
          verbs.parameters,
          specs.components,
          customProps,
          customGenerator,
        );
      }
    });
  });

  const haveGet = Boolean(output.match(/<Get</));
  const haveMutate = Boolean(output.match(/<Mutate</));
  const havePoll = Boolean(output.match(/<Poll</));

  const imports = [];
  if (haveGet) {
    imports.push("Get", "GetProps", "useGet", "UseGetProps");
  }
  if (haveMutate) {
    imports.push("Mutate", "MutateProps", "useMutate", "UseMutateProps");
  }
  if (havePoll) {
    imports.push("Poll", "PollProps");
  }
  output =
    `/* Generated by restful-react */

import React from "react";
import { ${imports.join(", ")} } from "restful-react";${customImport ? `\n${customImport}\n` : ""}

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

` + output;
  return output;
};

export default importOpenApi;
