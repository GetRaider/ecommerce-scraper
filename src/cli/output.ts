import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ScrapeResult } from "../domain/index.ts";

export const DEFAULT_OUTPUT_PATH = "out.json";

export function serializeScrapeResult(result: ScrapeResult): string {
  return JSON.stringify(result, undefined, 2);
}

export async function writeScrapeResult(result: ScrapeResult, useStdout: boolean): Promise<void> {
  const serializedResult = `${serializeScrapeResult(result)}\n`;

  if (useStdout) {
    process.stdout.write(serializedResult);
    return;
  }

  const outputPath = resolve(DEFAULT_OUTPUT_PATH);
  await writeFile(outputPath, serializedResult, "utf8");
  process.stderr.write(`[info] Wrote ${outputPath}\n`);
}
