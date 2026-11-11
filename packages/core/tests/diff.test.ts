import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeContracts,
  compareContracts,
  formatJsonReport,
  parseContractDocument,
  parseContractFile,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../../../fixtures");

function minimalContract(paths: Record<string, unknown>) {
  return parseContractDocument({
    openapi: "3.0.3",
    info: { title: "Test", version: "1.0.0" },
    paths,
  });
}

describe("diff engine", () => {
  it("detects added and removed endpoints", () => {
    const before = minimalContract({
      "/a": { get: { responses: { "200": { description: "ok" } } } },
      "/b": { get: { responses: { "200": { description: "ok" } } } },
    });
    const after = minimalContract({
      "/a": { get: { responses: { "200": { description: "ok" } } } },
      "/c": { get: { responses: { "200": { description: "ok" } } } },
    });

    const result = compareContracts(before, after);
    expect(result.changes.some((c) => c.type === "endpoint.removed" && c.path === "/b")).toBe(
      true,
    );
    expect(result.changes.some((c) => c.type === "endpoint.added" && c.path === "/c")).toBe(true);
    expect(result.changes.find((c) => c.type === "endpoint.removed")?.severity).toBe("breaking");
    expect(result.changes.find((c) => c.type === "endpoint.added")?.severity).toBe("non-breaking");
  });

  it("detects parameter requirement changes", () => {
    const before = minimalContract({
      "/users": {
        get: {
          parameters: [
            { name: "status", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    });
    const after = minimalContract({
      "/users": {
        get: {
          parameters: [
            { name: "status", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    });

    const result = compareContracts(before, after);
    const change = result.changes.find((c) => c.type === "parameter.required.changed");
    expect(change?.severity).toBe("breaking");
  });

  it("detects new required request parameters as breaking", () => {
    const before = minimalContract({
      "/users": {
        get: {
          parameters: [],
          responses: { "200": { description: "ok" } },
        },
      },
    });
    const after = minimalContract({
      "/users": {
        get: {
          parameters: [
            { name: "token", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    });

    const result = compareContracts(before, after);
    const change = result.changes.find((c) => c.type === "parameter.added");
    expect(change?.severity).toBe("breaking");
  });

  it("detects removed response properties as breaking", () => {
    const before = minimalContract({
      "/users/{id}": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id", "name"],
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const after = minimalContract({
      "/users/{id}": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id"],
                    properties: {
                      id: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = compareContracts(before, after);
    expect(
      result.changes.some(
        (c) => c.type === "response.property.removed" && c.severity === "breaking",
      ),
    ).toBe(true);
  });

  it("detects response property type changes as breaking", () => {
    const before = minimalContract({
      "/users/{id}": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { createdAt: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const after = minimalContract({
      "/users/{id}": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { createdAt: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = compareContracts(before, after);
    expect(
      result.changes.some(
        (c) => c.type === "response.property.type.changed" && c.severity === "breaking",
      ),
    ).toBe(true);
  });

  it("treats new optional response properties as non-breaking", () => {
    const before = minimalContract({
      "/users/{id}": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { id: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const after = minimalContract({
      "/users/{id}": {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      displayName: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = compareContracts(before, after);
    expect(
      result.changes.some(
        (c) => c.type === "response.property.added" && c.severity === "non-breaking",
      ),
    ).toBe(true);
  });

  it("returns no changes for identical contracts", async () => {
    const a = await parseContractFile(join(fixturesDir, "api-v1.yaml"));
    const b = await parseContractFile(join(fixturesDir, "api-v1.yaml"));
    const result = analyzeContracts({ before: a, after: b });
    expect(result.summary.totalChanges).toBe(0);
    expect(result.changes).toEqual([]);
  });

  it("produces stable analysis output", async () => {
    const before = await parseContractFile(join(fixturesDir, "api-v1.yaml"));
    const after = await parseContractFile(join(fixturesDir, "api-v2.yaml"));
    const first = compareContracts(before, after);
    const second = compareContracts(before, after);
    expect(first).toEqual(second);
    expect(first.summary.breakingChanges).toBeGreaterThan(0);
    expect(first.summary.nonBreakingChanges).toBeGreaterThan(0);
  });

  it("generates valid JSON reports", async () => {
    const before = await parseContractFile(join(fixturesDir, "api-v1.yaml"));
    const after = await parseContractFile(join(fixturesDir, "api-v2.yaml"));
    const result = compareContracts(before, after);
    const json = formatJsonReport(result);
    const parsed = JSON.parse(json) as typeof result;
    expect(parsed.summary.totalChanges).toBe(result.summary.totalChanges);
    expect(Array.isArray(parsed.changes)).toBe(true);
  });
});
