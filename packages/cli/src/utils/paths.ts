import { resolve } from "node:path";

export function resolveUserPath(input: string): string {
  return resolve(input);
}
