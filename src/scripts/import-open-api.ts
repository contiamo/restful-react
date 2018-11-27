import { pascal } from "case";
import get from "lodash/get";
import groupBy from "lodash/groupBy";
import isEmpty from "lodash/isEmpty";
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

// @ts-ignore - no type definition here
import swagger2openapi from "swagger2openapi";

import YAML from "yamljs";

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
  switch (item.type) {
    case "int32":
    case "int64":
    case "number":
    case "integer":
    case "long":
    case "float":
    case "double":
      return "number";

    case "boolean":
      return "boolean";

    case "array":
      return getArray(item);

    case "object":
      return getObject(item);

    case "string":
      return item.enum ? `"${item.enum.join(`" | "`)}"` : "string";

    case "byte":
    case "binary":
    case "date":
    case "dateTime":
    case "date-time":
    case "password":
      return "string";

    default:
      return getObject(item);
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
    return `${resolveValue(item.items)}[]`;
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

  if (item.properties) {
    return (
      "{" +
      Object.entries(item.properties)
        .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
          const isRequired = (item.required || []).includes(key);
          return `${key}${isRequired ? "" : "?"}: ${resolveValue(prop)}`;
        })
        .join("; ") +
      "}"
    );
  }

  if (item.additionalProperties) {
    return `{[key: string]: ${resolveValue(item.additionalProperties)}}`;
  }

  return item.type === "object" ? "{}" : "any";
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
      // @ts-ignore - no type definition here
      swagger2openapi.convertObj(schema, {}, (err, { openapi }) => {
        if (err) {
          reject(err);
        } else {
          resolve(openapi);
        }
      });
    } else {
      resolve(schema);
    }
  });
};

/**
 * Generate a restful-react compoment from openapi operation specs
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
  let lastParamInTheRoute: string;
  if (verb === "delete") {
    const lastParamInTheRouteRegExp = /\/\$\{(\w+)\}$/;
    lastParamInTheRoute = (route.match(lastParamInTheRouteRegExp) || [])[1];
    route = route.replace(lastParamInTheRouteRegExp, ""); // `/pet/${id}` => `/pet`
  }
  const componentName = pascal(operation.operationId!);
  const Component = verb === "get" ? "Get" : "Mutate";

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
    statusCode.toString().startsWith("2") || statusCode.toString().startsWith("3");
  const isError = (responses: [string, ResponseObject | ReferenceObject]) => !isOk(responses);

  const responseTypes = getResReqTypes(Object.entries(operation.responses).filter(isOk));
  const errorTypes = getResReqTypes(Object.entries(operation.responses).filter(isError)) || "unknown";
  const requestBodyTypes = getResReqTypes([["body", operation.requestBody!]]);
  const needAResponseComponent = responseTypes.includes("{");

  // We ignore last param of DELETE action, the last params should be the `id` and it's given after in restful-react
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

  const params = [...queryParams.map(p => p.name), ...paramsInPath];
  const paramsTypes = [
    ...paramsInPath.map(p => {
      try {
        const { name, required, schema } = pathParams.find(i => i.name === p)!;
        return `${name}${required ? "" : "?"}: ${resolveValue(schema!)}`;
      } catch (err) {
        throw new Error(`The path params ${p} can't be found in parameters (${operation.operationId})`);
      }
    }),
    ...queryParams.map(p => `${p.name}${p.required ? "" : "?"}: ${resolveValue(p.schema!)}`),
  ].join("; ");

  const genericsTypes =
    verb === "get"
      ? `${needAResponseComponent ? componentName + "Response" : responseTypes}, ${errorTypes}`
      : `${needAResponseComponent ? componentName + "Response" : responseTypes}, ${errorTypes}, ${requestBodyTypes}`;

  let output = `${
    needAResponseComponent
      ? `
export interface ${componentName}Response ${responseTypes}
`
      : ""
  }
export type ${componentName}Props = Omit<${Component}Props<${genericsTypes}>, "path"${
    verb === "get" ? "" : ` | "verb"`
  }>${params.length ? ` & {${paramsTypes}}` : ""};

${operation.summary ? "// " + operation.summary : ""}
export const ${componentName} = (${
    params.length ? `{${params.join(", ")}, ...props}` : "props"
  }: ${componentName}Props) => (
  <${Component}<${genericsTypes}>${
    verb === "get"
      ? ""
      : `
    verb="${verb.toUpperCase()}"`
  }
    path=${
      queryParams.length
        ? `{\`${route}?\${qs.stringify({${queryParams.map(p => p.name).join(", ")}})}\`}`
        : `{\`${route}\`}`
    }
    {...props}
  />
);

`;

  if (headerParams.map(({ name }) => name.toLocaleLowerCase()).includes("prefer")) {
    output += `${operation.summary ? "// " + `${operation.summary} (long polling)` : ""}
export const Poll${componentName} = (${
      params.length ? `{${params.join(", ")}, ...props}` : "props"
    }: ${componentName}Props) => (
  <Poll<${genericsTypes}>
    path=${
      queryParams.length
        ? `{\`${route}?\${qs.stringify({${queryParams.map(p => p.name).join(", ")}})}\`}`
        : `{\`${route}\`}`
    }
    {...props}
  />
);

`;
  }

  return output;
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
      .map(
        ([name, schema]) =>
          (!schema.type || schema.type === "object") && !schema.allOf && !isReference(schema)
            ? `export interface ${pascal(name)} ${getScalar(schema)}`
            : `export type ${pascal(name)} = ${resolveValue(schema)};`,
      )
      .join("\n\n") + "\n"
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
        const type = getResReqTypes([["", response]]);
        return type.includes("{") && !type.includes("|") && !type.includes("&")
          ? `export interface ${pascal(name)}Response ${getResReqTypes([["", response]])}`
          : `export type ${pascal(name)}Response = ${getResReqTypes([["", response]])};`;
      })
      .join("\n\n") +
    "\n"
  );
};

/**
 * Main entry of the generator. Generate restful-react component from openAPI.
 *
 * @param data raw data of the spec
 * @param format format of the spec
 */
const importOpenApi = async (data: string, format: "yaml" | "json") => {
  const operationIds: string[] = [];
  const schema = await importSpecs(data, format);

  let output = `/* Generated by restful-react */

import qs from "qs";
import React from "react";
import { Get, GetProps, Mutate, MutateProps } from "restful-react";

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

`;

  output += generateSchemasDefinition(schema.components && schema.components.schemas);
  output += generateResponsesDefinition(schema.components && schema.components.responses);
  Object.entries(schema.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (["get", "post", "patch", "put", "delete"].includes(verb)) {
        output += generateRestfulComponent(operation, verb, route, operationIds, verbs.parameters, schema.components);
      }
    });
  });

  return output;
};

export default importOpenApi;
