import { join } from "path";
import importOpenApi, { getArray, getObject, getRef, getScalar, isReference } from "../import-open-api";

describe("scripts/import-open-api", () => {
  it("should parse correctly petstore-expanded.yaml", () => {
    const data = importOpenApi(join(__dirname, "./petstore-expanded.yaml"));
    expect(data).toMatchSnapshot();
  });

  describe("isReference", () => {
    it("should return true if the property is a ref", () => {
      const property = {
        $ref: "#/components/schemas/FieldResponse",
      };
      expect(isReference(property)).toBe(true);
    });
    it("should return false if the property is not a ref", () => {
      const property = {
        type: "string",
      };
      expect(isReference(property)).toBe(false);
    });
  });

  describe("getScalar", () => {
    [
      { item: { type: "integer" }, expected: "number" },
      { item: { type: "long" }, expected: "number" },
      { item: { type: "float" }, expected: "number" },
      { item: { type: "double" }, expected: "number" },
      { item: { type: "boolean" }, expected: "boolean" },
      { item: { type: "array", items: { type: "string" } }, expected: "string[]" },
      { item: { type: "array", items: { type: "integer" } }, expected: "number[]" },
      { item: { type: "array", items: { type: "customType" } }, expected: "any[]" },
      { item: { type: "object", properties: { value: { type: "integer" } } }, expected: "{value?: number}" },
      { item: { type: "object", $ref: "#/components/schemas/Foo" }, expected: "Foo" },
      { item: { type: "string" }, expected: "string" },
      { item: { type: "byte" }, expected: "string" },
      { item: { type: "binary" }, expected: "string" },
      { item: { type: "date" }, expected: "string" },
      { item: { type: "dateTime" }, expected: "string" },
      { item: { type: "password" }, expected: "string" },
      { item: { type: "string", enum: ["foo", "bar"] }, expected: `"foo" | "bar"` },
      { item: { type: "customType" }, expected: "any" },
    ].map(({ item, expected }) =>
      it(`should return ${expected} as type for ${item.type}`, () => {
        expect(getScalar(item)).toEqual(expected);
      }),
    );
  });

  describe("getRef", () => {
    it("should return the name from `#/components/schemas`", () => {
      expect(getRef("#/components/schemas/foo")).toEqual("Foo");
    });
    it("should throw if the ref is not in `#/components/schemas`", () => {
      expect(() => getRef("#/somewhere/schemas/foo")).toThrowError(
        "This library only resolve $ref that are include into `#/components/schemas` for now",
      );
    });
  });

  describe("getArray", () => {
    it("should return an array of number", () => {
      const item = {
        type: "array",
        items: {
          type: "integer",
        },
      };

      expect(getArray(item)).toEqual("number[]");
    });

    it("should return an array of ref", () => {
      const item = {
        type: "array",
        items: {
          $ref: "#/components/schemas/foo",
        },
      };

      expect(getArray(item)).toEqual("Foo[]");
    });
  });

  describe("getObject", () => {
    it("should return the type of a standard object", () => {
      const item = {
        type: "object",
        required: ["name", "age"],
        properties: {
          name: {
            type: "string",
          },
          age: {
            type: "integer",
          },
        },
      };
      expect(getObject(item)).toEqual(`{name: string; age: number}`);
    });

    it("should return the type of an object with optional values", () => {
      const item = {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
          },
          age: {
            type: "integer",
          },
        },
      };
      expect(getObject(item)).toEqual(`{name: string; age?: number}`);
    });

    it("should deal with additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          type: "string",
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: string}`);
    });

    it("should deal with ref additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          $ref: "#/components/schemas/foo",
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: Foo}`);
    });

    it("should deal with ref additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          $ref: "#/components/schemas/foo",
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: Foo}`);
    });

    it("should deal with oneOf additionalProperties", () => {
      const item = {
        type: "object",
        additionalProperties: {
          oneOf: [{ $ref: "#/components/schemas/foo" }, { $ref: "#/components/schemas/bar" }],
        },
      };
      expect(getObject(item)).toEqual(`{[key: string]: Foo | Bar}`);
    });

    it("should deal with allOf", () => {
      const item = {
        type: "object",
        allOf: [
          { $ref: "#/components/schemas/foo" },
          {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
            },
          },
        ],
      };
      expect(getObject(item)).toEqual(`Foo & {name: string}`);
    });
  });
});
