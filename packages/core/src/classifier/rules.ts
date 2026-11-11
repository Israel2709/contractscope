import type { Severity } from "../types/index.js";

export type ChangeType =
  | "endpoint.added"
  | "endpoint.removed"
  | "operation.added"
  | "operation.removed"
  | "parameter.added"
  | "parameter.removed"
  | "parameter.required.changed"
  | "parameter.type.changed"
  | "requestBody.required.changed"
  | "requestBody.schema.changed"
  | "response.added"
  | "response.removed"
  | "response.property.added"
  | "response.property.removed"
  | "response.property.required.changed"
  | "response.property.type.changed"
  | "response.schema.unsupported"
  | "schema.unsupported";

/**
 * Classify a change type into a severity.
 * Request changes are judged for request producers (clients).
 * Response changes are judged for response consumers (clients).
 */
export function classifyChange(
  type: ChangeType,
  context?: { requiredAfter?: boolean; requiredBefore?: boolean },
): Severity {
  switch (type) {
    case "endpoint.removed":
    case "operation.removed":
    case "response.property.removed":
    case "response.property.type.changed":
    case "parameter.type.changed":
      return "breaking";

    case "endpoint.added":
    case "operation.added":
    case "response.added":
    case "response.property.added":
      return "non-breaking";

    case "parameter.added":
      // New required request parameter breaks existing clients.
      return context?.requiredAfter === true ? "breaking" : "non-breaking";

    case "parameter.removed":
      // Removing a required parameter is generally non-breaking for clients.
      return "non-breaking";

    case "parameter.required.changed":
      // optional → required is breaking; required → optional is non-breaking
      if (context?.requiredBefore === false && context?.requiredAfter === true) {
        return "breaking";
      }
      return "non-breaking";

    case "requestBody.required.changed":
      if (context?.requiredBefore === false && context?.requiredAfter === true) {
        return "breaking";
      }
      return "non-breaking";

    case "response.removed":
      // Removing a documented response can break clients expecting it.
      return "breaking";

    case "response.property.required.changed":
      // New required response property is non-breaking for consumers
      // (they receive more guaranteed data). Removing required is warning-ish;
      // making optional → we treat as non-breaking for consumers.
      return "non-breaking";

    case "requestBody.schema.changed":
    case "response.schema.unsupported":
    case "schema.unsupported":
      return "warning";

    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
