import type { AnalysisResult, ContractChange, Severity } from "../types/index.js";

const SEVERITY_LABEL: Record<Severity, string> = {
  breaking: "BREAKING",
  warning: "WARNING",
  "non-breaking": "NON-BREAKING",
};

function formatChange(change: ContractChange): string {
  const location = change.method
    ? `${change.method.toUpperCase()} ${change.path}`
    : change.path;
  return `  [${SEVERITY_LABEL[change.severity]}] ${change.type}\n    ${location}\n    ${change.description}`;
}

export function formatTerminalReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("ContractScope Analysis Report");
  lines.push("=".repeat(32));
  lines.push("");
  lines.push(`Total changes:        ${result.summary.totalChanges}`);
  lines.push(`Breaking changes:     ${result.summary.breakingChanges}`);
  lines.push(`Warnings:             ${result.summary.warnings}`);
  lines.push(`Non-breaking changes: ${result.summary.nonBreakingChanges}`);
  lines.push("");

  if (result.changes.length === 0) {
    lines.push("No differences detected between the contracts.");
    return lines.join("\n");
  }

  const groups: Severity[] = ["breaking", "warning", "non-breaking"];
  for (const severity of groups) {
    const group = result.changes.filter((c) => c.severity === severity);
    if (group.length === 0) {
      continue;
    }
    lines.push(`${SEVERITY_LABEL[severity]} (${group.length})`);
    lines.push("-".repeat(40));
    for (const change of group) {
      lines.push(formatChange(change));
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
