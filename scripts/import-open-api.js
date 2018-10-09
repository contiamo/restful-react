"use strict";
exports.__esModule = true;
var case_1 = require("case");
var fs_1 = require("fs");
var path_1 = require("path");
var yamljs_1 = require("yamljs");
/**
 * Discriminator helper for `ReferenceObject`
 *
 * @param property
 */
exports.isReference = function(property) {
  return Boolean(property.$ref);
};
/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
exports.getScalar = function(item) {
  switch (item.type) {
    case "integer":
    case "long":
    case "float":
    case "double":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return exports.getArray(item);
    case "object":
      return exports.getObject(item);
    case "string":
      return item["enum"] ? '"' + item["enum"].join('" | "') + '"' : "string";
    case "byte":
    case "binary":
    case "date":
    case "dateTime":
    case "password":
      return "string";
    default:
      return exports.getObject(item);
  }
};
/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
exports.getRef = function($ref) {
  if ($ref.startsWith("#/components/schemas")) {
    return case_1.pascal($ref.replace("#/components/schemas/", ""));
  } else {
    throw new Error("This library only resolve $ref that are include into `#/components/schemas` for now");
  }
};
/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
exports.getArray = function(item) {
  if (item.items) {
    return exports.resolveValue(item.items) + "[]";
  } else {
    throw new Error("All arrays must have an `items` key define");
  }
};
/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
exports.getObject = function(item) {
  if (exports.isReference(item)) {
    return exports.getRef(item.$ref);
  }
  if (item.allOf) {
    return item.allOf.map(exports.resolveValue).join(" & ");
  }
  if (item.properties) {
    return (
      "{" +
      Object.entries(item.properties)
        .map(function(_a) {
          var key = _a[0],
            prop = _a[1];
          var isRequired = (item.required || []).includes(key);
          return "" + key + (isRequired ? "" : "?") + ": " + exports.resolveValue(prop);
        })
        .join("; ") +
      "}"
    );
  }
  if (item.additionalProperties) {
    if (exports.isReference(item.additionalProperties)) {
      return "{[key: string]: " + exports.getRef(item.additionalProperties.$ref) + "}";
    } else if (item.additionalProperties.oneOf) {
      return "{[key: string]: " + item.additionalProperties.oneOf.map(exports.resolveValue).join(" | ") + "}";
    } else if (item.additionalProperties.type) {
      return "{[key: string]: " + item.additionalProperties.type + "}";
    }
  }
  return "any"; // fallback
};
/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
exports.resolveValue = function(schema) {
  return exports.isReference(schema) ? exports.getRef(schema.$ref) : exports.getScalar(schema);
};
/**
 * Extract responses types from open-api specs
 *
 * @todo remove potential duplicates
 * @param responses reponses object from open-api specs
 */
exports.getResponseTypes = function(responses) {
  return responses
    .map(function(_a) {
      var _ = _a[0],
        res = _a[1];
      if (exports.isReference(res)) {
        throw new Error("$ref are not implemented inside responses");
      } else {
        if (res.content && res.content["application/json"]) {
          var schema = res.content["application/json"].schema;
          return exports.resolveValue(schema);
        } else if (res.content && res.content["application/octet-stream"]) {
          var schema = res.content["application/octet-stream"].schema;
          return exports.resolveValue(schema);
        } else {
          return "void";
        }
      }
    })
    .join(" | ");
};
/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param path abosulte path of the yaml/json openapi 3.0.x file
 */
var importSpecs = function(path) {
  var data = fs_1.readFileSync(path, "utf-8");
  var ext = path_1.parse(path).ext;
  return ext === ".yaml" || ext === ".yml" ? yamljs_1.parse(data) : JSON.parse(data);
};
/**
 * Generate a restful-react Get compoment from openapi operation specs
 *
 * @param operation
 */
exports.generateGetComponent = function(operation, verb, route, baseUrl) {
  if (!operation.operationId) {
    throw new Error("Every path must have a operationId - No operationId set for " + verb + " " + route);
  }
  var componentName = case_1.pascal(operation.operationId);
  var isOk = function(_a) {
    var statusCode = _a[0];
    return statusCode.toString().startsWith("2") || statusCode.toString().startsWith("3");
  };
  var isError = function(responses) {
    return !isOk(responses);
  };
  var responseTypes = exports.getResponseTypes(Object.entries(operation.responses).filter(isOk));
  var errorTypes = exports.getResponseTypes(Object.entries(operation.responses).filter(isError));
  return (
    "\nexport type " +
    componentName +
    "Props = Omit<GetProps<" +
    responseTypes +
    ", " +
    errorTypes +
    '>, "path">\n\n' +
    (operation.summary ? "// " + operation.summary : "") +
    "\nexport const " +
    componentName +
    " = (props: " +
    componentName +
    "Props) => (\n  <Get<" +
    responseTypes +
    ", " +
    errorTypes +
    '>\n    path="' +
    route +
    '"\n    base="' +
    baseUrl +
    '"\n    {...props}\n  />\n)\n\n'
  );
};
/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
exports.generateSchemaDefinition = function(schemas) {
  if (schemas === void 0) {
    schemas = {};
  }
  return (
    Object.entries(schemas)
      .map(function(_a) {
        var name = _a[0],
          schema = _a[1];
        return (!schema.type || schema.type === "object") && !schema.allOf && !exports.isReference(schema)
          ? "export interface " + case_1.pascal(name) + " " + exports.getScalar(schema)
          : "export type " + case_1.pascal(name) + " = " + exports.resolveValue(schema) + ";";
      })
      .join("\n\n") + "\n"
  );
};
var importOpenApi = function(path, baseUrl) {
  if (baseUrl === void 0) {
    baseUrl = "http://localhost";
  }
  var schema = importSpecs(path);
  if (!schema.openapi.startsWith("3.0")) {
    throw new Error("This tools can only parse open-api 3.0.x specifications");
  }
  var output =
    '/* Generated by restful-react */\n\nimport React from "react";\nimport { Get, GetProps, Mutate, MutateProps } from "restful-react";\n\nexport type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;\n\n';
  output += exports.generateSchemaDefinition(schema.components && schema.components.schemas);
  Object.entries(schema.paths).forEach(function(_a) {
    var route = _a[0],
      verbs = _a[1];
    Object.entries(verbs).forEach(function(_a) {
      var verb = _a[0],
        operation = _a[1];
      if (verb === "get") {
        output += exports.generateGetComponent(operation, verb, route, baseUrl);
      }
      // @todo deal with `post`, `put`, `patch`, `delete` verbs
    });
  });
  return output;
};
exports["default"] = importOpenApi;
