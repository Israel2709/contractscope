import type {
  HttpMethod,
  NormalizedContract,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedPathItem,
  NormalizedRequestBody,
  NormalizedResponse,
  ParameterLocation,
} from "../types/index.js";
import { HTTP_METHODS } from "../types/index.js";
import { normalizeSchema } from "./schema.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMediaContent(content: unknown): {
  contentTypes: string[];
  schema?: ReturnType<typeof normalizeSchema>;
} {
  if (!isObject(content)) {
    return { contentTypes: [] };
  }

  const contentTypes = Object.keys(content).sort();
  // Prefer application/json when present; otherwise first sorted content type.
  const preferred =
    contentTypes.find((type) => type === "application/json") ?? contentTypes[0];

  if (!preferred) {
    return { contentTypes };
  }

  const media = content[preferred];
  const schema = isObject(media) ? normalizeSchema(media.schema) : undefined;
  return { contentTypes, schema: schema ?? undefined };
}

function normalizeParameters(raw: unknown): NormalizedParameter[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parameters: NormalizedParameter[] = [];
  for (const item of raw) {
    if (!isObject(item)) {
      continue;
    }
    if (typeof item.name !== "string" || typeof item.in !== "string") {
      continue;
    }

    const location = item.in as ParameterLocation;
    if (!["query", "header", "path", "cookie"].includes(location)) {
      continue;
    }

    const required =
      location === "path" ? true : item.required === true;

    parameters.push({
      name: item.name,
      in: location,
      required,
      schema: normalizeSchema(item.schema),
      description: typeof item.description === "string" ? item.description : undefined,
    });
  }

  return parameters.sort((a, b) => {
    const keyA = `${a.in}:${a.name}`;
    const keyB = `${b.in}:${b.name}`;
    return keyA.localeCompare(keyB);
  });
}

function normalizeRequestBody(raw: unknown): NormalizedRequestBody | undefined {
  if (!isObject(raw)) {
    return undefined;
  }
  const content = normalizeMediaContent(raw.content);
  return {
    required: raw.required === true,
    content,
  };
}

function normalizeResponses(raw: unknown): Record<string, NormalizedResponse> {
  if (!isObject(raw)) {
    return {};
  }

  const responses: Record<string, NormalizedResponse> = {};
  for (const [statusCode, response] of Object.entries(raw).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!isObject(response)) {
      continue;
    }
    responses[statusCode] = {
      statusCode,
      description: typeof response.description === "string" ? response.description : undefined,
      content: normalizeMediaContent(response.content),
    };
  }
  return responses;
}

function normalizeOperation(
  method: HttpMethod,
  raw: unknown,
): NormalizedOperation | undefined {
  if (!isObject(raw)) {
    return undefined;
  }

  return {
    method,
    operationId: typeof raw.operationId === "string" ? raw.operationId : undefined,
    summary: typeof raw.summary === "string" ? raw.summary : undefined,
    parameters: normalizeParameters(raw.parameters),
    requestBody: normalizeRequestBody(raw.requestBody),
    responses: normalizeResponses(raw.responses),
  };
}

export function normalizeContract(
  document: unknown,
  sourcePath?: string,
): NormalizedContract {
  if (!isObject(document)) {
    throw new Error("Cannot normalize non-object OpenAPI document");
  }

  const info = isObject(document.info) ? document.info : {};
  const pathsRaw = isObject(document.paths) ? document.paths : {};
  const paths: Record<string, NormalizedPathItem> = {};

  for (const pathKey of Object.keys(pathsRaw).sort()) {
    const pathItemRaw = pathsRaw[pathKey];
    if (!isObject(pathItemRaw)) {
      continue;
    }

    const pathLevelParameters = normalizeParameters(pathItemRaw.parameters);

    const operations: Partial<Record<HttpMethod, NormalizedOperation>> = {};
    for (const method of HTTP_METHODS) {
      if (method in pathItemRaw) {
        const operation = normalizeOperation(method, pathItemRaw[method]);
        if (operation) {
          // Path-level parameters apply to all operations; operation params override by in:name.
          const merged = new Map<string, (typeof operation.parameters)[number]>();
          for (const parameter of pathLevelParameters) {
            merged.set(`${parameter.in}:${parameter.name}`, parameter);
          }
          for (const parameter of operation.parameters) {
            merged.set(`${parameter.in}:${parameter.name}`, parameter);
          }
          operation.parameters = [...merged.values()].sort((a, b) =>
            `${a.in}:${a.name}`.localeCompare(`${b.in}:${b.name}`),
          );
          operations[method] = operation;
        }
      }
    }

    paths[pathKey] = {
      path: pathKey,
      operations,
    };
  }

  return {
    openapi: String(document.openapi ?? ""),
    info: {
      title: String(info.title ?? ""),
      version: String(info.version ?? ""),
    },
    paths,
    sourcePath,
  };
}
