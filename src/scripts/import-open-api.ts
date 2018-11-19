import { pascal } from "case";
import { readFileSync } from "fs";
import groupBy from "lodash/groupBy";
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

import { parse } from "path";
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
  } else {
    throw new Error("This library only resolve $ref that are include into `#/components/schemas` for now");
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
        throw new Error("$ref are not implemented inside responses");
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
 * Return every params is a path
 *
 * @example
 * ```
 * getTemplatePathParams("/pet/{category}/{name}/");
 * // => ["category", "name"]
 * ```
 * @param path
 */
export const getParamsInPath = (path: string) => {
  let n;
  const output = [];
  const templatePathRegex = /\{\w+}/g;
  // tslint:disable-next-line:no-conditional-assignment
  while ((n = templatePathRegex.exec(path)) !== null) {
    output.push(n[0].slice(1, -1));
  }

  return output;
};

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param path abosulte path of the yaml/json openapi 3.0.x file
 */
const importSpecs = (path: string): OpenAPIObject => {
  const data = readFileSync(path, "utf-8");
  const { ext } = parse(path);
  return ext === ".yaml" || ext === ".yml" ? YAML.parse(data) : JSON.parse(data);
};

/**
 * Generate a restful-react compoment from openapi operation specs
 *
 * @param operation
 */
export const generateRestfulComponent = (operation: OperationObject, verb: string, route: string, baseUrl: string) => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }

  route = route.replace(/\{/g, "${"); // `/pet/{id}` => `/pet/${id}`
  const componentName = pascal(operation.operationId!);
  const Component = verb === "get" ? "Get" : "Mutate";

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
    statusCode.toString().startsWith("2") || statusCode.toString().startsWith("3");
  const isError = (responses: [string, ResponseObject | ReferenceObject]) => !isOk(responses);

  const responseTypes = getResReqTypes(Object.entries(operation.responses).filter(isOk));
  const errorTypes = getResReqTypes(Object.entries(operation.responses).filter(isError));
  const requestBodyTypes = getResReqTypes([["body", operation.requestBody!]]);

  const paramsInPath = getParamsInPath(route);
  const { query: queryParams = [], path: pathParams = [] } = groupBy(
    (operation.parameters || []).filter<ParameterObject>(
      (p): p is ParameterObject => {
        if (isReference(p)) {
          throw new Error("$ref are not implemented inside parameters");
        } else {
          return true;
        }
      },
    ),
    "in",
  );

  const params = [...queryParams.map(p => p.name), ...paramsInPath];
  const paramsTypes = [
    ...paramsInPath.map(p => {
      const { name, required, schema } = pathParams.find(i => i.name === p)!;
      return `${name}${required ? "" : "?"}: ${resolveValue(schema!)}`;
    }),
    ...queryParams.map(p => `${p.name}${p.required ? "" : "?"}: ${resolveValue(p.schema!)}`),
  ].join("; ");

  const genericsTypes =
    verb === "get" ? `${responseTypes}, ${errorTypes}` : `${errorTypes}, ${responseTypes}, ${requestBodyTypes}`;

  return `
export type ${componentName}Props = Omit<${Component}Props<${genericsTypes}>, "path">${
    params.length ? ` & {${paramsTypes}}` : ""
  };

${operation.summary ? "// " + operation.summary : ""}
export const ${componentName} = (${
    params.length ? `{${params.join(", ")}, ...props}` : "props"
  }: ${componentName}Props) => (
  <${Component}<${genericsTypes}>
    path=${
      queryParams.length
        ? `{\`${route}?\${qs.stringify({${queryParams.map(p => p.name).join(", ")}})}\`}`
        : `{\`${route}\`}`
    }
    base="${baseUrl}"
    {...props}
  />
);

`;
};

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemaDefinition = (schemas: ComponentsObject["schemas"] = {}) => {
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

const importOpenApi = (path: string, baseUrl: string = "http://localhost") => {
  const schema = importSpecs(path);

  if (!schema.openapi.startsWith("3.0")) {
    throw new Error("This tools can only parse open-api 3.0.x specifications");
  }

  let output = `/* Generated by restful-react */

import qs from "qs";
import React from "react";
import { Get, GetProps, Mutate, MutateProps } from "restful-react";

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

`;

  output += generateSchemaDefinition(schema.components && schema.components.schemas);
  Object.entries(schema.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      output += generateRestfulComponent(operation, verb, route, baseUrl);
    });
  });

  return output;
};

export default importOpenApi;
