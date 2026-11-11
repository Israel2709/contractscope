import { refError } from "./errors.js";
import { splitJsonPointer } from "./json-pointer.js";

const REF_KEY = "$ref";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRemoteRef(ref: string): boolean {
  if (ref.startsWith("#")) {
    return false;
  }
  // absolute URI or relative file path outside this document
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref) || !ref.startsWith("#");
}

function getByPointer(document: unknown, pointer: string): unknown {
  const tokens = splitJsonPointer(pointer);
  let current: unknown = document;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw refError(`Unresolved JSON Pointer: ${pointer}`, { token });
      }
      current = current[index];
      continue;
    }
    if (!isObject(current) || !(token in current)) {
      throw refError(`Unresolved JSON Pointer: ${pointer}`, { token });
    }
    current = current[token];
  }
  return current;
}

/**
 * Resolve local `$ref` values in-place on a deep clone of the document.
 * Detects circular references and rejects remote refs.
 */
export function resolveLocalRefs(document: unknown): unknown {
  const root = structuredClone(document);
  const resolving = new Set<string>();

  function resolve(node: unknown, trail: string[]): unknown {
    if (Array.isArray(node)) {
      return node.map((item, index) => resolve(item, [...trail, String(index)]));
    }

    if (!isObject(node)) {
      return node;
    }

    if (REF_KEY in node) {
      const refValue = node[REF_KEY];
      if (typeof refValue !== "string") {
        throw refError("$ref must be a string", { path: trail.join(".") });
      }

      if (isRemoteRef(refValue)) {
        throw refError(
          `Remote or external $ref is not supported: ${refValue}. Only local document references (#/...) are supported.`,
          { ref: refValue },
        );
      }

      const pointer = refValue.startsWith("#") ? refValue : `#${refValue}`;
      if (resolving.has(pointer)) {
        throw refError(`Circular $ref detected: ${[...resolving, pointer].join(" → ")}`, {
          cycle: [...resolving, pointer],
        });
      }

      resolving.add(pointer);
      try {
        const target = getByPointer(root, pointer);
        const resolved = resolve(target, trail);
        // Preserve sibling keys alongside $ref (OpenAPI 3.1 allows them; we merge shallowly).
        const { [REF_KEY]: _ignored, ...siblings } = node;
        if (Object.keys(siblings).length === 0) {
          return resolved;
        }
        if (isObject(resolved)) {
          return { ...resolved, ...siblings };
        }
        return resolved;
      } finally {
        resolving.delete(pointer);
      }
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = resolve(value, [...trail, key]);
    }
    return result;
  }

  return resolve(root, []);
}
