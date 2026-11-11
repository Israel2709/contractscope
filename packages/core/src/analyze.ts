import { compareContracts } from "./diff/compare.js";
import { parseContractFile } from "./parser/index.js";
import type { AnalysisResult, NormalizedContract } from "./types/index.js";

export interface AnalyzeOptions {
  beforePath: string;
  afterPath: string;
}

export interface AnalyzeContractsOptions {
  before: NormalizedContract;
  after: NormalizedContract;
}

/**
 * High-level API: load two contract files and return an analysis result.
 */
export async function analyzeFiles(options: AnalyzeOptions): Promise<AnalysisResult> {
  const before = await parseContractFile(options.beforePath);
  const after = await parseContractFile(options.afterPath);
  return compareContracts(before, after);
}

/**
 * Analyze two already-normalized contracts.
 */
export function analyzeContracts(options: AnalyzeContractsOptions): AnalysisResult {
  return compareContracts(options.before, options.after);
}
