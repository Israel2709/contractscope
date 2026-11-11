import type {
  AnalysisResult,
  ContractChange,
  HttpMethod,
  NormalizedContract,
  NormalizedOperation,
  NormalizedParameter,
} from "../types/index.js";
import { HTTP_METHODS } from "../types/index.js";
import { classifyChange } from "../classifier/rules.js";
import { diffObjectSchemas, nextId, resetChangeCounter } from "./schema-diff.js";

function paramKey(parameter: NormalizedParameter): string {
  return `${parameter.in}:${parameter.name}`;
}

function compareParameters(
  path: string,
  method: HttpMethod,
  beforeParams: NormalizedParameter[],
  afterParams: NormalizedParameter[],
): ContractChange[] {
  const changes: ContractChange[] = [];
  const beforeMap = new Map(beforeParams.map((p) => [paramKey(p), p]));
  const afterMap = new Map(afterParams.map((p) => [paramKey(p), p]));
  const keys = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();

  for (const key of keys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);

    if (before && !after) {
      changes.push({
        id: nextId("nb"),
        type: "parameter.removed",
        severity: classifyChange("parameter.removed"),
        path,
        method,
        description: `Removed ${before.required ? "required" : "optional"} ${before.in} parameter "${before.name}"`,
        before,
      });
      continue;
    }

    if (!before && after) {
      const severity = classifyChange("parameter.added", { requiredAfter: after.required });
      changes.push({
        id: nextId(severity === "breaking" ? "brk" : "nb"),
        type: "parameter.added",
        severity,
        path,
        method,
        description: `Added ${after.required ? "required" : "optional"} ${after.in} parameter "${after.name}"`,
        after,
      });
      continue;
    }

    if (before && after) {
      if (before.required !== after.required) {
        const severity = classifyChange("parameter.required.changed", {
          requiredBefore: before.required,
          requiredAfter: after.required,
        });
        changes.push({
          id: nextId(severity === "breaking" ? "brk" : "nb"),
          type: "parameter.required.changed",
          severity,
          path,
          method,
          description: `Parameter "${after.name}" (${after.in}) required flag changed: ${before.required} → ${after.required}`,
          before: before.required,
          after: after.required,
        });
      }

      const beforeType = before.schema?.type;
      const afterType = after.schema?.type;
      const beforeLabel = Array.isArray(beforeType) ? beforeType.join("|") : (beforeType ?? "unknown");
      const afterLabel = Array.isArray(afterType) ? afterType.join("|") : (afterType ?? "unknown");
      if (beforeLabel !== afterLabel) {
        changes.push({
          id: nextId("brk"),
          type: "parameter.type.changed",
          severity: classifyChange("parameter.type.changed"),
          path,
          method,
          description: `Parameter "${after.name}" (${after.in}) type changed: ${beforeLabel} → ${afterLabel}`,
          before: beforeLabel,
          after: afterLabel,
        });
      }
    }
  }

  return changes;
}

function compareOperations(
  path: string,
  method: HttpMethod,
  beforeOp: NormalizedOperation,
  afterOp: NormalizedOperation,
): ContractChange[] {
  const changes: ContractChange[] = [];

  changes.push(...compareParameters(path, method, beforeOp.parameters, afterOp.parameters));

  const beforeBody = beforeOp.requestBody;
  const afterBody = afterOp.requestBody;

  if (beforeBody && afterBody && beforeBody.required !== afterBody.required) {
    const severity = classifyChange("requestBody.required.changed", {
      requiredBefore: beforeBody.required,
      requiredAfter: afterBody.required,
    });
    changes.push({
      id: nextId(severity === "breaking" ? "brk" : "nb"),
      type: "requestBody.required.changed",
      severity,
      path,
      method,
      description: `Request body required flag changed: ${beforeBody.required} → ${afterBody.required}`,
      before: beforeBody.required,
      after: afterBody.required,
    });
  }

  if (beforeBody || afterBody) {
    changes.push(
      ...diffObjectSchemas({
        before: beforeBody?.content.schema,
        after: afterBody?.content.schema,
        path,
        method,
        location: "request",
      }),
    );
  }

  const beforeStatuses = new Set(Object.keys(beforeOp.responses));
  const afterStatuses = new Set(Object.keys(afterOp.responses));
  const statuses = [...new Set([...beforeStatuses, ...afterStatuses])].sort();

  for (const status of statuses) {
    const beforeResponse = beforeOp.responses[status];
    const afterResponse = afterOp.responses[status];

    if (beforeResponse && !afterResponse) {
      changes.push({
        id: nextId("brk"),
        type: "response.removed",
        severity: classifyChange("response.removed"),
        path,
        method,
        description: `Removed response ${status}`,
        before: beforeResponse,
      });
      continue;
    }

    if (!beforeResponse && afterResponse) {
      changes.push({
        id: nextId("nb"),
        type: "response.added",
        severity: classifyChange("response.added"),
        path,
        method,
        description: `Added response ${status}`,
        after: afterResponse,
      });
      continue;
    }

    if (beforeResponse && afterResponse) {
      changes.push(
        ...diffObjectSchemas({
          before: beforeResponse.content.schema,
          after: afterResponse.content.schema,
          path,
          method,
          location: "response",
          propertyPath: "",
          statusCode: status,
        }),
      );
    }
  }

  return changes;
}

function buildSummary(changes: ContractChange[]): AnalysisResult["summary"] {
  return {
    totalChanges: changes.length,
    breakingChanges: changes.filter((c) => c.severity === "breaking").length,
    warnings: changes.filter((c) => c.severity === "warning").length,
    nonBreakingChanges: changes.filter((c) => c.severity === "non-breaking").length,
  };
}

/**
 * Compare two normalized contracts and return a deterministic analysis result.
 * Changes are sorted by path, method, type, then description.
 */
export function compareContracts(
  before: NormalizedContract,
  after: NormalizedContract,
): AnalysisResult {
  resetChangeCounter();
  const changes: ContractChange[] = [];

  const beforePaths = new Set(Object.keys(before.paths));
  const afterPaths = new Set(Object.keys(after.paths));
  const allPaths = [...new Set([...beforePaths, ...afterPaths])].sort();

  for (const path of allPaths) {
    const beforeItem = before.paths[path];
    const afterItem = after.paths[path];

    if (beforeItem && !afterItem) {
      changes.push({
        id: nextId("brk"),
        type: "endpoint.removed",
        severity: classifyChange("endpoint.removed"),
        path,
        description: `Removed endpoint ${path}`,
        before: Object.keys(beforeItem.operations).sort(),
      });
      continue;
    }

    if (!beforeItem && afterItem) {
      changes.push({
        id: nextId("nb"),
        type: "endpoint.added",
        severity: classifyChange("endpoint.added"),
        path,
        description: `Added endpoint ${path}`,
        after: Object.keys(afterItem.operations).sort(),
      });
      continue;
    }

    if (!beforeItem || !afterItem) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const beforeOp = beforeItem.operations[method];
      const afterOp = afterItem.operations[method];

      if (beforeOp && !afterOp) {
        changes.push({
          id: nextId("brk"),
          type: "operation.removed",
          severity: classifyChange("operation.removed"),
          path,
          method,
          description: `Removed operation ${method.toUpperCase()} ${path}`,
        });
        continue;
      }

      if (!beforeOp && afterOp) {
        changes.push({
          id: nextId("nb"),
          type: "operation.added",
          severity: classifyChange("operation.added"),
          path,
          method,
          description: `Added operation ${method.toUpperCase()} ${path}`,
        });
        continue;
      }

      if (beforeOp && afterOp) {
        changes.push(...compareOperations(path, method, beforeOp, afterOp));
      }
    }
  }

  changes.sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;
    const methodCmp = (a.method ?? "").localeCompare(b.method ?? "");
    if (methodCmp !== 0) return methodCmp;
    const typeCmp = a.type.localeCompare(b.type);
    if (typeCmp !== 0) return typeCmp;
    return a.description.localeCompare(b.description);
  });

  // Re-assign deterministic IDs after sort for stable output
  const severityPrefix: Record<ContractChange["severity"], string> = {
    breaking: "brk",
    warning: "warn",
    "non-breaking": "nb",
  };
  const stableChanges = changes.map((change, index) => ({
    ...change,
    id: `${severityPrefix[change.severity]}-${String(index + 1).padStart(3, "0")}`,
  }));

  return {
    summary: buildSummary(stableChanges),
    changes: stableChanges,
  };
}
