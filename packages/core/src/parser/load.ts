import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseError } from "./errors.js";

export async function loadContractFile(filePath: string): Promise<{
  absolutePath: string;
  raw: unknown;
}> {
  const absolutePath = resolve(filePath);

  let content: string;
  try {
    content = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw parseError(`Failed to read contract file: ${absolutePath}`, { cause: error });
  }

  const extension = extname(absolutePath).toLowerCase();

  try {
    if (extension === ".json") {
      return { absolutePath, raw: JSON.parse(content) as unknown };
    }

    if (extension === ".yaml" || extension === ".yml" || extension === "") {
      return { absolutePath, raw: parseYaml(content) as unknown };
    }

    // Fall back: try JSON then YAML for unknown extensions
    try {
      return { absolutePath, raw: JSON.parse(content) as unknown };
    } catch {
      return { absolutePath, raw: parseYaml(content) as unknown };
    }
  } catch (error) {
    throw parseError(`Failed to parse contract file as YAML/JSON: ${absolutePath}`, {
      cause: error,
    });
  }
}

export function parseContractContent(
  content: string,
  format: "yaml" | "json",
): unknown {
  try {
    if (format === "json") {
      return JSON.parse(content) as unknown;
    }
    return parseYaml(content) as unknown;
  } catch (error) {
    throw parseError(`Failed to parse ${format} content`, { cause: error });
  }
}
