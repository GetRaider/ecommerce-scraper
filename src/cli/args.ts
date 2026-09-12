import { parseArgs } from "node:util";

import { getErrorMessage } from "../lib/errors.ts";

export function parseCliArgs(arguments_: string[]): CliArguments {
  let values: ParsedValues;

  try {
    const parsed = parseArgs({
      args: arguments_,
      allowPositionals: false,
      strict: true,
      options: {
        stdout: { type: "boolean", default: false },
        "unique-total": { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
    values = parsed.values;
  } catch (error) {
    throw new CliUsageError(getErrorMessage(error));
  }

  return {
    stdout: values.stdout ?? false,
    uniqueTotal: values["unique-total"] ?? false,
    verbose: values.verbose ?? false,
    help: values.help ?? false,
  };
}

export function getUsage(): string {
  return `Usage: ecommerce-scraper [options]

Scrape the webscraper.io static e-commerce catalog and write JSON to out.json.

Options:
  --stdout           Write formatted JSON to stdout instead of out.json
  --unique-total     Set total to the sum of unique prices instead of every row
  --verbose          Enable debug diagnostics on stderr (default: false)
  --help             Show this help

Examples:
  ecommerce-scraper
  ecommerce-scraper --stdout
  ecommerce-scraper --unique-total`;
}

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export type CliArguments = {
  stdout: boolean;
  uniqueTotal: boolean;
  verbose: boolean;
  help: boolean;
};

type ParsedValues = {
  stdout?: boolean;
  "unique-total"?: boolean;
  verbose?: boolean;
  help?: boolean;
};
