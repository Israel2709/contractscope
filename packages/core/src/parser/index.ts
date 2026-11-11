import type { NormalizedContract } from "../types/index.js";
import { normalizeContract } from "../normalizer/normalize.js";
import { loadContractFile, parseContractContent } from "./load.js";
import { resolveLocalRefs } from "./ref-resolver.js";
import { validateOpenApiDocument } from "./validate.js";

export { loadContractFile, parseContractContent } from "./load.js";
export { resolveLocalRefs } from "./ref-resolver.js";
export { validateOpenApiDocument } from "./validate.js";
export { splitJsonPointer, decodePointerToken, encodePointerToken } from "./json-pointer.js";

/**
 * Load an OpenAPI file from disk, validate, resolve local refs, and normalize.
 */
export async function parseContractFile(filePath: string): Promise<NormalizedContract> {
  const { absolutePath, raw } = await loadContractFile(filePath);
  return parseContractDocument(raw, absolutePath);
}

/**
 * Parse an in-memory OpenAPI document (already deserialized).
 */
export function parseContractDocument(
  raw: unknown,
  sourcePath?: string,
): NormalizedContract {
  const validated = validateOpenApiDocument(raw);
  const resolved = resolveLocalRefs(validated);
  return normalizeContract(resolved, sourcePath);
}

/**
 * Parse raw YAML or JSON text into a normalized contract.
 */
export function parseContractText(
  content: string,
  format: "yaml" | "json",
  sourcePath?: string,
): NormalizedContract {
  const raw = parseContractContent(content, format);
  return parseContractDocument(raw, sourcePath);
}
