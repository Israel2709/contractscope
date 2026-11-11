import type { NormalizedSchema } from "../types/index.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UNSUPPORTED_KEYWORDS = [
  "allOf",
  "oneOf",
  "anyOf",
  "not",
  "discriminator",
  "xml",
  "externalDocs",
  "patternProperties",
  "dependentRequired",
  "dependentSchemas",
  "if",
  "then",
  "else",
  "$dynamicRef",
  "$dynamicAnchor",
] as const;

export function normalizeSchema(raw: unknown): NormalizedSchema | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (!isObject(raw)) {
    return { unsupportedFeatures: ["non-object-schema"] };
  }

  const unsupportedFeatures: string[] = [];
  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (keyword in raw) {
      unsupportedFeatures.push(keyword);
    }
  }

  const schema: NormalizedSchema = {};

  if (typeof raw.type === "string") {
    schema.type = raw.type;
  } else if (Array.isArray(raw.type)) {
    schema.type = raw.type.filter((t): t is string => typeof t === "string");
  }

  if (typeof raw.format === "string") {
    schema.format = raw.format;
  }

  if (Array.isArray(raw.enum)) {
    schema.enum = raw.enum;
  }

  if (raw.nullable === true) {
    schema.nullable = true;
  }

  // OpenAPI 3.1 may use type: ["string", "null"]
  if (Array.isArray(schema.type) && schema.type.includes("null")) {
    schema.nullable = true;
  }

  if (Array.isArray(raw.required)) {
    schema.required = raw.required.filter((item): item is string => typeof item === "string").sort();
  }

  if (isObject(raw.properties)) {
    const properties: Record<string, NormalizedSchema> = {};
    for (const [name, prop] of Object.entries(raw.properties).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const normalized = normalizeSchema(prop);
      if (normalized) {
        properties[name] = normalized;
      }
    }
    schema.properties = properties;
  }

  if ("items" in raw) {
    const items = normalizeSchema(raw.items);
    if (items) {
      schema.items = items;
    }
  }

  if (typeof raw.additionalProperties === "boolean") {
    schema.additionalProperties = raw.additionalProperties;
  } else if (isObject(raw.additionalProperties)) {
    const additional = normalizeSchema(raw.additionalProperties);
    if (additional) {
      schema.additionalProperties = additional;
    }
  }

  if (unsupportedFeatures.length > 0) {
    schema.unsupportedFeatures = unsupportedFeatures;
  }

  return schema;
}
