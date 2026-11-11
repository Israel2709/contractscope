import type { AnalysisResult } from "../types/index.js";

export function formatJsonReport(result: AnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
