/**
 * Decode a JSON Pointer token per RFC 6901.
 * "~1" → "/", "~0" → "~"
 */
export function decodePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Encode a JSON Pointer token per RFC 6901.
 */
export function encodePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Split a JSON Pointer into decoded tokens.
 * Accepts pointers with or without a leading "#".
 */
export function splitJsonPointer(pointer: string): string[] {
  let value = pointer;
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  if (value === "" || value === "/") {
    return [];
  }
  if (!value.startsWith("/")) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }
  return value
    .slice(1)
    .split("/")
    .map((token) => decodePointerToken(token));
}
