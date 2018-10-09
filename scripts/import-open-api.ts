import { pascal } from "case";
import { readFileSync } from "fs";
import uniq from "lodash/uniq";

import {
  ComponentsObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
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

  return "any"; // fallback
};

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = (schema: SchemaObject) => (isReference(schema) ? getRef(schema.$ref) : getScalar(schema));

/**
 * Extract responses types from open-api specs
 *
 * @todo remove potential duplicates
 * @param responses reponses object from open-api specs
 */
export const getResponseTypes = (responses: Array<[string, ResponseObject | ReferenceObject]>) =>
  uniq(
    responses.map(([_, res]) => {
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
 * Generate a restful-react Get compoment from openapi operation specs
 *
 * @param operation
 */
export const generateGetComponent = (operation: OperationObject, verb: string, route: string, baseUrl: string) => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }

  const componentName = pascal(operation.operationId!);

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
    statusCode.toString().startsWith("2") || statusCode.toString().startsWith("3");
  const isError = (responses: [string, ResponseObject | ReferenceObject]) => !isOk(responses);

  const responseTypes = getResponseTypes(Object.entries(operation.responses).filter(isOk));
  const errorTypes = getResponseTypes(Object.entries(operation.responses).filter(isError));
  const params = (operation.parameters || []).filter<ParameterObject>(
    (p): p is ParameterObject => {
      if (isReference(p)) {
        throw new Error("$ref are not implemented inside parameters");
      } else {
        return p.in === "path";
      }
    },
  );

  const paramsTypes = params.map(p => `${p.name}${p.required ? "" : "?"}: ${resolveValue(p.schema!)}`).join("; ");

  return `
export type ${componentName}Props = Omit<GetProps<${responseTypes}, ${errorTypes}>, "path">${
    params.length ? ` & {${paramsTypes}}` : ""
  };

${operation.summary ? "// " + operation.summary : ""}
export const ${componentName} = (${
    params.length ? `{${params.map(p => p.name).join(", ")}, ...props}` : "props"
  }: ${componentName}Props) => (
  <Get<${responseTypes}, ${errorTypes}>
    path=${params.length ? `{\`${route}?\${qs.stringify({${params.map(p => p.name).join(", ")}})}\`}` : `"${route}"`}
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

import React from "react";
import { Get, GetProps, Mutate, MutateProps } from "restful-react";

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

`;

  output += generateSchemaDefinition(schema.components && schema.components.schemas);
  Object.entries(schema.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (verb === "get") {
        output += generateGetComponent(operation, verb, route, baseUrl);
      }
      // @todo deal with `post`, `put`, `patch`, `delete` verbs
    });
  });

  return output;
};

export default importOpenApi;
