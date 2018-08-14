import { pascal } from "case";
import { readFileSync } from "fs";

import {
  ComponentsObject,
  OpenAPIObject,
  OperationObject,
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
const isReference = (property: any): property is ReferenceObject => {
  return Boolean(property.$ref);
};

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
const getScalar = (item: SchemaObject) => {
  switch (item.type) {
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
    case "byte":
    case "binary":
    case "date":
    case "dateTime":
    case "password":
      return "string";

    default:
      return "any";
  }
};

/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
const getRef = ($ref: ReferenceObject["$ref"]) => {
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
const getArray = (item: SchemaObject): string => {
  const items = item.items!;
  if (isReference(items)) {
    return `${getRef(items.$ref)}[]`;
  } else {
    return `${getScalar(items)}[]`;
  }
};

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
const getObject = (item: SchemaObject): string => {
  if (item.additionalProperties) {
    if (isReference(item.additionalProperties)) {
      return `{[key: string]: ${getRef(item.additionalProperties.$ref)}`;
    } else if (item.additionalProperties.oneOf) {
      return `{[key: string]: ${item.additionalProperties.oneOf
        .map(prop => (isReference(prop) ? getRef(prop.$ref) : getScalar(prop)))
        .join(" | ")}}`;
    }
  }

  return "any"; // fallback
};

/**
 * Extract responses types from open-api specs
 *
 * @todo remove potential duplicates
 * @param responses reponses object from open-api specs
 * @param componentName name of the current component
 */
const getResponseTypes = (responses: Array<[string, ResponseObject | ReferenceObject]>, componentName: string) =>
  responses
    .map(([statusCode, res]) => {
      if (isReference(res)) {
        throw new Error("$ref are not implemented inside responses");
      } else {
        if (res.content && res.content["application/json"]) {
          const schema = res.content["application/json"].schema!;
          return isReference(schema) ? getRef(schema.$ref) : getScalar(schema);
        } else if (res.content && res.content["application/octet-stream"]) {
          const schema = res.content["application/octet-stream"].schema!;
          return isReference(schema) ? getRef(schema.$ref) : getScalar(schema);
        } else {
          throw new Error(
            `The ${componentName} ${statusCode} response don't have application/json or octet-stream defined`,
          );
        }
      }
    })
    .join(` | `);

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param path abosulte path of the yaml/json openapi 3.0.x file
 */
const importSpecs = (path: string): OpenAPIObject => {
  const data = readFileSync(path, "utf-8");
  const { ext } = parse(path);
  return ext === ".yaml" ? YAML.parse(data) : JSON.parse(data);
};

/**
 * Generate a restful-react Get compoment from openapi operation specs
 *
 * @param operation
 */
const generateGetComponent = (operation: OperationObject, verb: string, route: string) => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }

  const componentName = pascal(operation.operationId!);

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) => statusCode.toString().startsWith("2");
  const isError = ([statusCode]: [string, ResponseObject | ReferenceObject]) => !statusCode.toString().startsWith("2");

  const responseTypes = getResponseTypes(Object.entries(operation.responses).filter(isOk), componentName);
  const errorTypes = getResponseTypes(Object.entries(operation.responses).filter(isError), componentName);

  return `
export type ${componentName}Props = Omit<GetProps<${responseTypes}, ${errorTypes}>, "path">

${operation.summary ? "// " + operation.summary : ""}
export const ${componentName}: React.SFC<${componentName}Props> = (props) => (
  <Get path="${route}" {...props} />
)

`;
};

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
const generateSchemaDefinition = (schemas: ComponentsObject["schemas"] = {}) =>
  Object.entries(schemas)
    .map(([name, schema]) => {
      switch (schema.type || "object") {
        case "object":
          return `
export interface ${pascal(name)} {
${Object.entries(schema.properties || {})
            .map(
              ([key, properties]) =>
                isReference(properties) ? `  ${key}: ${getRef(properties.$ref)}` : `${key}: ${getScalar(properties)}`,
            )
            .join("\n")}
}
`;
        case "array":
          return `export type ${pascal(name)} = ${getArray(schema)}`;
        case "string":
          return schema.enum
            ? `export type ${pascal(name)} = "${schema.enum.join(`" | "`)}"`
            : `export type ${pascal(name)} = string`;
        default:
          return `export type ${pascal(name)} = ${getScalar(schema)}`;
      }
    })
    .join("\n\n");

const main = () => {
  const schema = importSpecs("./scripts/openapi.yaml");

  if (!schema.openapi.startsWith("3.0")) {
    throw new Error("This tools can only parse open-api 3.0.x specifications");
  }

  let output = `
/* Generated by restful-react */

import React from "react";
import { Get, GetProps, Mutate, MutateProps } from "restful-react";

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

`;

  output += generateSchemaDefinition(schema.components && schema.components.schemas);
  Object.entries(schema.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (verb === "get") {
        output += generateGetComponent(operation, verb, route);
      }
    });
  });

  return output;
};

// tslint:disable-next-line:no-console
console.log(main());
