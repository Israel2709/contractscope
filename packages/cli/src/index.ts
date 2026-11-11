import { Command } from "commander";
import { runAnalyzeCommand } from "./commands/analyze.js";

const program = new Command();

program
  .name("contractscope")
  .description("Detect breaking changes between OpenAPI contract versions")
  .version("0.1.0");

program
  .command("analyze")
  .description("Compare two OpenAPI contracts and report compatibility changes")
  .requiredOption("--before <path>", "Path to the baseline OpenAPI contract")
  .requiredOption("--after <path>", "Path to the candidate OpenAPI contract")
  .option("--format <format>", "Output format: terminal | json", "terminal")
  .option("--output <path>", "Write report to a file instead of stdout")
  .option("--fail-on-breaking", "Exit with code 1 when breaking changes are found", false)
  .action(
    async (options: {
      before: string;
      after: string;
      format: string;
      output?: string;
      failOnBreaking?: boolean;
    }) => {
      const format = options.format === "json" ? "json" : options.format === "terminal" ? "terminal" : null;
      if (!format) {
        process.stderr.write(`Invalid --format "${options.format}". Use "terminal" or "json".\n`);
        process.exitCode = 2;
        return;
      }

      const exitCode = await runAnalyzeCommand({
        before: options.before,
        after: options.after,
        format,
        output: options.output,
        failOnBreaking: Boolean(options.failOnBreaking),
      });
      process.exitCode = exitCode;
    },
  );

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exitCode = 2;
});
