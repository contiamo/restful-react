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

import YAML from "js-yaml";
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
      return (item.enum ? `${item.enum.join(` | `)}` : "number") + nullable;

    case "boolean":
      return "boolean" + nullable;

    case "array":
      return getArray(item) + nullable;

    case "null":
      return "null";

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
  if (!item.items) {
    throw new Error("All arrays must have an `items` key defined");
  }
  let item_type = resolveValue(item.items);
  if (!isReference(item.items) && (item.items.oneOf || item.items.allOf || item.items.enum)) {
    item_type = `(${item_type})`;
  }
  if (item.minItems && item.maxItems && item.minItems === item.maxItems) {
    return `[${new Array(item.minItems).fill(item_type).join(", ")}]`;
  }
  return `${item_type}[]`;
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
      }

      if (res.content) {
        for (let contentType of Object.keys(res.content)) {
          if (
            contentType.startsWith("*/*") ||
            contentType.startsWith("application/json") ||
            contentType.startsWith("application/octet-stream")
          ) {
            const schema = res.content[contentType].schema!;
            return resolveValue(schema);
          }
        }
        return "void";
      }

      return "void";
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
  const schema = extension === "yaml" ? YAML.safeLoad(data) : JSON.parse(data);

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
export const reactPropsValueToObjectValue = (value: string) => {
  if (value.startsWith("{") && value.endsWith("}")) {
    return value.slice(1, -1);
  }
  return value;
};

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
  skipReact = false,
  pathParametersEncodingMode?: AdvancedOptions["pathParametersEncodingMode"],
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
        const { name, required, schema, description } = pathParams.find(i => i.name === p)!;
        return `${description ? formatDescription(description, 2) : ""}${name}${required ? "" : "?"}: ${resolveValue(
          schema!,
        )}`;
      } catch (err) {
        throw new Error(`The path params ${p} can't be found in parameters (${operation.operationId})`);
      }
    })
    .join(";\n  ");

  const queryParamsType = queryParams
    .map(p => {
      const processedName = IdentifierRegexp.test(p.name) ? p.name : `"${p.name}"`;
      return `${formatDescription(p.description, 2)}${processedName}${p.required ? "" : "?"}: ${resolveValue(
        p.schema!,
      )}`;
    })
    .join(";\n  ");

  // Retrieve the type of the param for delete verb
  const lastParamInTheRouteDefinition =
    operation.parameters && lastParamInTheRoute
      ? operation.parameters
          .map(p =>
            isReference(p)
              ? (get(schemasComponents, p.$ref.replace("#/components/", "").replace("/", ".")) as ParameterObject)
              : p,
          )
          .find(p => p.name === lastParamInTheRoute)
      : { schema: { type: "string" } };

  if (!lastParamInTheRouteDefinition) {
    throw new Error(`The path params ${lastParamInTheRoute} can't be found in parameters (${operation.operationId})`);
  }

  const lastParamInTheRouteType =
    !isReference(lastParamInTheRouteDefinition.schema) && lastParamInTheRouteDefinition.schema
      ? getScalar(lastParamInTheRouteDefinition.schema)
      : isReference(lastParamInTheRouteDefinition.schema)
      ? getRef(lastParamInTheRouteDefinition.schema.$ref)
      : "string";

  const responseType = needAResponseComponent ? componentName + "Response" : responseTypes;
  const genericsTypes =
    verb === "get"
      ? `${responseType}, ${errorTypes}, ${queryParamsType ? componentName + "QueryParams" : "void"}, ${
          paramsInPath.length ? componentName + "PathParams" : "void"
        }`
      : `${responseType}, ${errorTypes}, ${queryParamsType ? componentName + "QueryParams" : "void"}, ${
          verb === "delete" && lastParamInTheRoute
            ? lastParamInTheRouteType
            : needARequestBodyComponent
            ? componentName + "RequestBody"
            : requestBodyTypes
        }, ${paramsInPath.length ? componentName + "PathParams" : "void"}`;

  const genericsTypesForHooksProps =
    verb === "get"
      ? `${responseType}, ${errorTypes}, ${queryParamsType ? componentName + "QueryParams" : "void"}, ${
          paramsInPath.length ? componentName + "PathParams" : "void"
        }`
      : `${responseType}, ${errorTypes}, ${queryParamsType ? componentName + "QueryParams" : "void"}, ${
          verb === "delete" && lastParamInTheRoute
            ? lastParamInTheRouteType
            : needARequestBodyComponent
            ? componentName + "RequestBody"
            : requestBodyTypes
        }, ${paramsInPath.length ? componentName + "PathParams" : "void"}`;

  const customPropsEntries = Object.entries(customProps).map(([key, prop]) => {
    if (typeof prop === "function") {
      return [key, prop({ responseType })];
    }
    return [key, prop];
  });

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
    paramsInPath.length
      ? `
export interface ${componentName}PathParams {
  ${paramsTypes}
}
`
      : ""
  }${
    needARequestBodyComponent
      ? `
export ${
          requestBodyTypes.includes("&")
            ? `type ${componentName}RequestBody =`
            : `interface ${componentName}RequestBody`
        } ${requestBodyTypes}
`
      : ""
  }
`;

  if (!skipReact) {
    const encode = pathParametersEncodingMode ? "encode" : "";

    // Component version
    output += `export type ${componentName}Props = Omit<${Component}Props<${genericsTypes}>, "path"${
      verb === "get" ? "" : ` | "verb"`
    }>${paramsInPath.length ? ` & ${componentName}PathParams` : ""};

${description}export const ${componentName} = (${
      paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
    }: ${componentName}Props) => (
  <${Component}<${genericsTypes}>${
      verb === "get"
        ? ""
        : `
    verb="${verb.toUpperCase()}"`
    }
    path=${`{${encode}\`${route}\`}`}${
      customPropsEntries.length
        ? "\n    " + customPropsEntries.map(([key, value]) => `${key}=${value}`).join("\n    ")
        : ""
    }
    ${verb === "delete" && pathParametersEncodingMode ? "pathInlineBodyEncode={encodingFn}" : ""}
    {...props}
  />
);

`;

    // Poll component
    if (headerParams.map(({ name }) => name.toLocaleLowerCase()).includes("prefer")) {
      output += `export type Poll${componentName}Props = Omit<PollProps<${genericsTypes}>, "path">${
        paramsInPath.length ? ` & {${paramsTypes}}` : ""
      };

${operation.summary ? `// ${operation.summary} (long polling)` : ""}
export const Poll${componentName} = (${
        paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
      }: Poll${componentName}Props) => (
<Poll<${genericsTypes}>
  path={${encode}\`${route}\`}
  {...props}
/>
);

`;
    }

    // Hooks version
    output += `export type Use${componentName}Props = Omit<Use${Component}Props<${genericsTypesForHooksProps}>, "path"${
      verb === "get" ? "" : ` | "verb"`
    }>${paramsInPath.length ? ` & ${componentName}PathParams` : ""};

${description}export const use${componentName} = (${
      paramsInPath.length ? `{${paramsInPath.join(", ")}, ...props}` : "props"
    }: Use${componentName}Props) => use${Component}<${genericsTypes}>(${
      verb === "get" ? "" : `"${verb.toUpperCase()}", `
    }${
      paramsInPath.length
        ? `(paramsInPath: ${componentName}PathParams) => ${encode}\`${route.replace(/\$\{/g, "${paramsInPath.")}\``
        : `${encode}\`${route}\``
    }, ${
      customPropsEntries.length || paramsInPath.length || verb === "delete"
        ? `{ ${
            customPropsEntries.length
              ? `${customPropsEntries
                  .map(([key, value]) => `${key}:${reactPropsValueToObjectValue(value || "")}`)
                  .join(", ")},`
              : ""
          }${verb === "delete" && pathParametersEncodingMode ? "pathInlineBodyEncode: encodingFn, " : " "}${
            paramsInPath.length ? `pathParams: { ${paramsInPath.join(", ")} },` : ""
          } ...props }`
        : "props"
    });

`;
  }

  // Custom version
  if (customGenerator) {
    output += customGenerator({
      componentName,
      verb,
      route,
      description,
      genericsTypes,
      paramsInPath,
      paramsTypes,
      operation,
    });
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
  const isEmptyInterface = scalar === "{}";
  return `${formatDescription(schema.description)}${
    isEmptyInterface ? "// tslint:disable-next-line:no-empty-interface\n" : ""
  }export interface ${pascal(name)} ${scalar}`;
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
 * Add the version of the spec
 *
 * @param version
 */
export const addVersionMetadata = (version: string) => `export const SPEC_VERSION = "${version}"; \n`;

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
 * Get the url encoding function to be aliased at the module scope.
 * This function is used to encode the path parameters.
 *
 * @param mode Either "uricomponent" or "rfc3986". "rfc3986" mode also encodes
 *             symbols from the `!'()*` range, while "uricomponent" leaves those as is.
 */
const getEncodingFunction = (mode: "uriComponent" | "rfc3986") => {
  if (mode === "uriComponent") return "encodeURIComponent";

  return `(uriComponent: string | number | boolean) => {
  return encodeURIComponent(uriComponent).replace(
      /[!'()*]/g,
      (c: string) => \`%\${c.charCodeAt(0).toString(16)}\`,
  );
};`;
};

/**
 * Main entry of the generator. Generate restful-react component from openAPI.
 *
 * @param options.data raw data of the spec
 * @param options.format format of the spec
 * @param options.transformer custom function to transform your spec
 * @param options.validation validate the spec with ibm-openapi-validator tool
 * @param options.skipReact skip the generation of react components/hooks
 */
const importOpenApi = async ({
  data,
  format,
  transformer,
  validation,
  skipReact,
  customImport,
  customProps,
  customGenerator,
  pathParametersEncodingMode,
}: {
  data: string;
  format: "yaml" | "json";
  transformer?: (specs: OpenAPIObject) => OpenAPIObject;
  validation?: boolean;
  skipReact?: boolean;
  customImport?: AdvancedOptions["customImport"];
  customProps?: AdvancedOptions["customProps"];
  customGenerator?: AdvancedOptions["customGenerator"];
  pathParametersEncodingMode?: "uriComponent" | "rfc3986";
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

  output += addVersionMetadata(specs.info.version);
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
          skipReact,
          pathParametersEncodingMode,
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

  let outputHeaders = "/* Generated by restful-react */\n\n";

  if (!skipReact) {
    outputHeaders += `import React from "react";
import { ${imports.join(", ")} } from "restful-react";
`;
  }

  if (customImport) {
    outputHeaders += `\n${customImport}\n`;
  }

  if (pathParametersEncodingMode) {
    outputHeaders += `${getEncodingFunction(pathParametersEncodingMode)}

    const encodingTagFactory = (encodingFn: typeof encodeURIComponent) => (
      strings: TemplateStringsArray,
      ...params: (string | number | boolean)[]
    ) =>
      strings.reduce(
          (accumulatedPath, pathPart, idx) =>
              \`\${accumulatedPath}\${pathPart}\${
                  idx < params.length ? encodingFn(params[idx]) : ''
              }\`,
          '',
      );

    const encode = encodingTagFactory(encodingFn);

    `;
  }

  return outputHeaders + output;
};

export default importOpenApi;
