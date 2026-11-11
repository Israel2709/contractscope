import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAnalyzeCommand } from "../src/commands/analyze.js";
import { EXIT_BREAKING, EXIT_ERROR, EXIT_SUCCESS } from "../src/utils/exit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../../../fixtures");

describe("CLI analyze command", () => {
  it("exits successfully for terminal analysis without fail-on-breaking", async () => {
    const code = await runAnalyzeCommand({
      before: join(fixturesDir, "api-v1.yaml"),
      after: join(fixturesDir, "api-v2.yaml"),
      format: "terminal",
      failOnBreaking: false,
    });
    expect(code).toBe(EXIT_SUCCESS);
  });

  it("exits with breaking code when fail-on-breaking is set", async () => {
    const code = await runAnalyzeCommand({
      before: join(fixturesDir, "api-v1.yaml"),
      after: join(fixturesDir, "api-v2.yaml"),
      format: "json",
      failOnBreaking: true,
    });
    expect(code).toBe(EXIT_BREAKING);
  });

  it("writes JSON output to a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contractscope-"));
    const output = join(dir, "report.json");

    const code = await runAnalyzeCommand({
      before: join(fixturesDir, "api-v1.yaml"),
      after: join(fixturesDir, "api-v2.yaml"),
      format: "json",
      output,
      failOnBreaking: false,
    });

    expect(code).toBe(EXIT_SUCCESS);
    const content = await readFile(output, "utf8");
    const parsed = JSON.parse(content) as {
      summary: { breakingChanges: number };
      changes: unknown[];
    };
    expect(parsed.summary.breakingChanges).toBeGreaterThan(0);
    expect(Array.isArray(parsed.changes)).toBe(true);
  });

  it("exits with error code for missing files", async () => {
    const code = await runAnalyzeCommand({
      before: join(fixturesDir, "does-not-exist.yaml"),
      after: join(fixturesDir, "api-v2.yaml"),
      format: "terminal",
    });
    expect(code).toBe(EXIT_ERROR);
  });

  it("exits successfully for identical contracts even with fail-on-breaking", async () => {
    const code = await runAnalyzeCommand({
      before: join(fixturesDir, "api-v1.yaml"),
      after: join(fixturesDir, "api-v1.yaml"),
      format: "json",
      failOnBreaking: true,
    });
    expect(code).toBe(EXIT_SUCCESS);
  });

  it("rejects invalid OpenAPI content via error exit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "contractscope-invalid-"));
    const bad = join(dir, "bad.yaml");
    await writeFile(bad, "not: valid: openapi: true\n", "utf8");

    const code = await runAnalyzeCommand({
      before: bad,
      after: join(fixturesDir, "api-v1.yaml"),
      format: "terminal",
    });
    expect(code).toBe(EXIT_ERROR);
  });
});
