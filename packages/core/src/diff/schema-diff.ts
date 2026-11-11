import type { ContractChange, NormalizedSchema } from "../types/index.js";
import { classifyChange } from "../classifier/rules.js";

function schemaTypeLabel(schema: NormalizedSchema | undefined): string {
  if (!schema?.type) {
    return "unknown";
  }
  return Array.isArray(schema.type) ? schema.type.join("|") : schema.type;
}

function typesEqual(a: NormalizedSchema | undefined, b: NormalizedSchema | undefined): boolean {
  return schemaTypeLabel(a) === schemaTypeLabel(b);
}

let changeCounter = 0;

export function resetChangeCounter(): void {
  changeCounter = 0;
}

export function nextId(prefix: string): string {
  changeCounter += 1;
  return `${prefix}-${String(changeCounter).padStart(3, "0")}`;
}

interface DiffSchemaOptions {
  before?: NormalizedSchema;
  after?: NormalizedSchema;
  path: string;
  method: string;
  location: "request" | "response";
  propertyPath?: string;
  statusCode?: string;
  compareRootType?: boolean;
}

/**
 * Compare two object-shaped schemas for property additions, removals, type changes,
 * and required-flag changes. Nested object properties are compared recursively.
 */
export function diffObjectSchemas(options: DiffSchemaOptions): ContractChange[] {
  const {
    before,
    after,
    path,
    method,
    location,
    propertyPath = "",
    statusCode,
    compareRootType = true,
  } = options;
  const changes: ContractChange[] = [];
  const locationLabel =
    location === "response"
      ? statusCode
        ? `response ${statusCode}`
        : "response body"
      : "request body";
  const displayPath = propertyPath || locationLabel;

  if (!before && !after) {
    return changes;
  }

  const beforeUnsupported = before?.unsupportedFeatures ?? [];
  const afterUnsupported = after?.unsupportedFeatures ?? [];
  if (compareRootType && (beforeUnsupported.length > 0 || afterUnsupported.length > 0)) {
    const features = [...new Set([...beforeUnsupported, ...afterUnsupported])].sort();
    changes.push({
      id: nextId("warn"),
      type: location === "response" ? "response.schema.unsupported" : "schema.unsupported",
      severity: classifyChange(
        location === "response" ? "response.schema.unsupported" : "schema.unsupported",
      ),
      path,
      method,
      description: `Schema at ${displayPath} uses unsupported constructs (${features.join(", ")}); compatibility may be incomplete`,
      before: beforeUnsupported,
      after: afterUnsupported,
    });
  }

  if (compareRootType && before && after && !typesEqual(before, after) && !before.properties && !after.properties) {
    const type = location === "response" ? "response.property.type.changed" : "parameter.type.changed";
    changes.push({
      id: nextId("brk"),
      type,
      severity: classifyChange(type),
      path,
      method,
      description: `Schema type changed at ${displayPath}: ${schemaTypeLabel(before)} → ${schemaTypeLabel(after)}`,
      before: schemaTypeLabel(before),
      after: schemaTypeLabel(after),
    });
  }

  const beforeProps = before?.properties ?? {};
  const afterProps = after?.properties ?? {};
  const beforeRequired = new Set(before?.required ?? []);
  const afterRequired = new Set(after?.required ?? []);
  const propNames = [...new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)])].sort();

  const responseScope = statusCode ? `response ${statusCode}` : "response";

  for (const propName of propNames) {
    const beforeProp = beforeProps[propName];
    const afterProp = afterProps[propName];
    const nestedPath = propertyPath ? `${propertyPath}.${propName}` : propName;

    if (beforeProp && !afterProp) {
      if (location === "response") {
        changes.push({
          id: nextId("brk"),
          type: "response.property.removed",
          severity: classifyChange("response.property.removed"),
          path,
          method,
          description: `Removed documented ${responseScope} property "${nestedPath}"`,
          before: beforeProp,
        });
      } else {
        changes.push({
          id: nextId("nb"),
          type: "parameter.removed",
          severity: "non-breaking",
          path,
          method,
          description: `Removed request property "${nestedPath}"`,
          before: beforeProp,
        });
      }
      continue;
    }

    if (!beforeProp && afterProp) {
      const isRequired = afterRequired.has(propName);
      if (location === "response") {
        changes.push({
          id: nextId("nb"),
          type: "response.property.added",
          severity: classifyChange("response.property.added"),
          path,
          method,
          description: `Added ${isRequired ? "required" : "optional"} ${responseScope} property "${nestedPath}"`,
          after: afterProp,
        });
      } else {
        changes.push({
          id: nextId(isRequired ? "brk" : "nb"),
          type: "parameter.added",
          severity: classifyChange("parameter.added", { requiredAfter: isRequired }),
          path,
          method,
          description: `Added ${isRequired ? "required" : "optional"} request property "${nestedPath}"`,
          after: afterProp,
        });
      }
      continue;
    }

    if (beforeProp && afterProp) {
      if (!typesEqual(beforeProp, afterProp)) {
        const type =
          location === "response" ? "response.property.type.changed" : "parameter.type.changed";
        changes.push({
          id: nextId("brk"),
          type,
          severity: classifyChange(type),
          path,
          method,
          description: `${location === "response" ? responseScope : "Request"} property "${nestedPath}" type changed: ${schemaTypeLabel(beforeProp)} → ${schemaTypeLabel(afterProp)}`,
          before: schemaTypeLabel(beforeProp),
          after: schemaTypeLabel(afterProp),
        });
      }

      const wasRequired = beforeRequired.has(propName);
      const isRequired = afterRequired.has(propName);
      if (wasRequired !== isRequired) {
        if (location === "response") {
          changes.push({
            id: nextId("nb"),
            type: "response.property.required.changed",
            severity: classifyChange("response.property.required.changed"),
            path,
            method,
            description: `${responseScope} property "${nestedPath}" required flag changed: ${wasRequired} → ${isRequired}`,
            before: wasRequired,
            after: isRequired,
          });
        } else {
          changes.push({
            id: nextId(wasRequired === false && isRequired ? "brk" : "nb"),
            type: "parameter.required.changed",
            severity: classifyChange("parameter.required.changed", {
              requiredBefore: wasRequired,
              requiredAfter: isRequired,
            }),
            path,
            method,
            description: `Request property "${nestedPath}" required flag changed: ${wasRequired} → ${isRequired}`,
            before: wasRequired,
            after: isRequired,
          });
        }
      }

      if (beforeProp.properties || afterProp.properties) {
        changes.push(
          ...diffObjectSchemas({
            before: beforeProp,
            after: afterProp,
            path,
            method,
            location,
            propertyPath: nestedPath,
            statusCode,
            compareRootType: false,
          }),
        );
      }
    }
  }

  return changes;
}
