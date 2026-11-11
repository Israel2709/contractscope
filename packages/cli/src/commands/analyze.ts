import { writeFile } from "node:fs/promises";
import {
  analyzeFiles,
  ContractScopeError,
  formatJsonReport,
  formatTerminalReport,
} from "@contractscope/core";
import { EXIT_BREAKING, EXIT_ERROR, EXIT_SUCCESS } from "../utils/exit.js";
import { resolveUserPath } from "../utils/paths.js";

export interface AnalyzeCommandOptions {
  before: string;
  after: string;
  format: "terminal" | "json";
  output?: string;
  failOnBreaking?: boolean;
}

export async function runAnalyzeCommand(options: AnalyzeCommandOptions): Promise<number> {
  const beforePath = resolveUserPath(options.before);
  const afterPath = resolveUserPath(options.after);

  try {
    const result = await analyzeFiles({ beforePath, afterPath });

    const report =
      options.format === "json" ? formatJsonReport(result) : formatTerminalReport(result);

    if (options.output) {
      const outputPath = resolveUserPath(options.output);
      await writeFile(outputPath, report, "utf8");
    } else {
      process.stdout.write(report);
    }

    if (options.failOnBreaking && result.summary.breakingChanges > 0) {
      return EXIT_BREAKING;
    }

    return EXIT_SUCCESS;
  } catch (error) {
    if (error instanceof ContractScopeError) {
      process.stderr.write(`Error [${error.code}]: ${error.message}\n`);
      return EXIT_ERROR;
    }

    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Unexpected error: ${message}\n`);
    return EXIT_ERROR;
  }
}
