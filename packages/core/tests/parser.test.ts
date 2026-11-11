import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ContractScopeError,
  parseContractDocument,
  parseContractFile,
  parseContractText,
  resolveLocalRefs,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../../../fixtures");

describe("parser", () => {
  it("parses YAML OpenAPI fixtures", async () => {
    const contract = await parseContractFile(join(fixturesDir, "api-v1.yaml"));
    expect(contract.openapi).toBe("3.0.3");
    expect(contract.info.title).toBe("User Management API");
    expect(contract.paths["/users"]).toBeDefined();
    expect(contract.paths["/users"]?.operations.get).toBeDefined();
    expect(contract.paths["/users"]?.operations.post).toBeDefined();
    expect(contract.paths["/users/{id}"]?.operations.delete).toBeDefined();
  });

  it("parses JSON OpenAPI documents", () => {
    const yaml = readFileSync(join(fixturesDir, "api-v1.yaml"), "utf8");
    // Convert via parse then stringify as JSON
    const fromYaml = parseContractText(yaml, "yaml");
    const asJson = JSON.stringify({
      openapi: "3.0.3",
      info: { title: "JSON API", version: "1.0.0" },
      paths: {
        "/ping": {
          get: {
            responses: {
              "200": {
                description: "pong",
                content: {
                  "application/json": {
                    schema: { type: "object", properties: { ok: { type: "boolean" } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const contract = parseContractText(asJson, "json");
    expect(contract.info.title).toBe("JSON API");
    expect(contract.paths["/ping"]?.operations.get).toBeDefined();
    expect(fromYaml.paths["/users"]).toBeDefined();
  });

  it("rejects invalid OpenAPI contracts", () => {
    expect(() => parseContractDocument({ foo: "bar" })).toThrow(ContractScopeError);
    expect(() =>
      parseContractDocument({
        openapi: "2.0",
        info: { title: "Swagger", version: "1" },
        paths: {},
      }),
    ).toThrow(/Unsupported OpenAPI version/);
  });

  it("resolves local $ref references", () => {
    const contract = parseContractDocument({
      openapi: "3.0.3",
      info: { title: "Refs", version: "1.0.0" },
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                description: "ok",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Item" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Item: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    });

    const schema = contract.paths["/items"]?.operations.get?.responses["200"]?.content.schema;
    expect(schema?.type).toBe("object");
    expect(schema?.properties?.id?.type).toBe("string");
    expect(schema?.required).toEqual(["id"]);
  });

  it("detects circular references", () => {
    expect(() =>
      resolveLocalRefs({
        openapi: "3.0.3",
        info: { title: "Cycle", version: "1" },
        paths: {},
        components: {
          schemas: {
            A: { $ref: "#/components/schemas/B" },
            B: { $ref: "#/components/schemas/A" },
          },
        },
      }),
    ).toThrow(/Circular \$ref/);
  });

  it("rejects remote references", () => {
    expect(() =>
      resolveLocalRefs({
        openapi: "3.0.3",
        info: { title: "Remote", version: "1" },
        paths: {},
        components: {
          schemas: {
            A: { $ref: "https://example.com/schemas.json#/A" },
          },
        },
      }),
    ).toThrow(/Remote or external \$ref/);
  });

  it("supports JSON Pointer escaping", () => {
    const resolved = resolveLocalRefs({
      components: {
        schemas: {
          "Foo/Bar": { type: "string" },
          "Foo~Bar": { type: "integer" },
        },
      },
      a: { $ref: "#/components/schemas/Foo~1Bar" },
      b: { $ref: "#/components/schemas/Foo~0Bar" },
    }) as {
      a: { type: string };
      b: { type: string };
    };

    expect(resolved.a.type).toBe("string");
    expect(resolved.b.type).toBe("integer");
  });

  it("merges path-level parameters into operations", async () => {
    const contract = await parseContractFile(join(fixturesDir, "api-v1.yaml"));
    const getUser = contract.paths["/users/{id}"]?.operations.get;
    expect(getUser?.parameters.some((p) => p.in === "path" && p.name === "id")).toBe(true);
  });
});
