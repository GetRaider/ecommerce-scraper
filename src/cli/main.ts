import { getErrorMessage } from "../lib/errors.ts";
import { CliUsageError, getUsage, parseCliArgs } from "./args.ts";
import { writeScrapeResult } from "./output.ts";
import { runScraper } from "./run.ts";

export async function main(arguments_ = process.argv.slice(2)): Promise<number> {
  let options;

  try {
    options = parseCliArgs(arguments_);
  } catch (error) {
    if (error instanceof CliUsageError) {
      process.stderr.write(`Error: ${error.message}\n\n${getUsage()}\n`);
      return 2;
    }

    throw error;
  }

  if (options.help) {
    process.stdout.write(`${getUsage()}\n`);
    return 0;
  }

  try {
    const result = await runScraper(options);
    await writeScrapeResult(result, options.stdout);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${getErrorMessage(error)}\n`);

    if (options.verbose && error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }

    return 1;
  }
}
