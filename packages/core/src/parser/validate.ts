import { z } from "zod";
import { validationError } from "./errors.js";

const openApiDocumentSchema = z
  .object({
    openapi: z.string().min(1),
    info: z
      .object({
        title: z.string().min(1),
        version: z.string().min(1),
      })
      .passthrough(),
    paths: z.record(z.unknown()).optional().default({}),
  })
  .passthrough();

export type RawOpenApiDocument = z.infer<typeof openApiDocumentSchema>;

export function validateOpenApiDocument(value: unknown): RawOpenApiDocument {
  const result = openApiDocumentSchema.safeParse(value);
  if (!result.success) {
    throw validationError("Document is not a valid OpenAPI contract (basic structure)", {
      issues: result.error.issues,
    });
  }

  const openapi = result.data.openapi;
  if (!openapi.startsWith("3.0") && !openapi.startsWith("3.1")) {
    throw validationError(
      `Unsupported OpenAPI version "${openapi}". Only 3.0.x and 3.1.x are supported.`,
      { openapi },
    );
  }

  return result.data;
}
