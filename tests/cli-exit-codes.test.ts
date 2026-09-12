import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../src/cli/index.ts";
import { runScraper } from "../src/cli/run.ts";

vi.mock("../src/cli/run.ts", () => ({ runScraper: vi.fn() }));

describe("main", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(runScraper).mockReset();
  });

  it("prints usage to stdout and exits 0 for --help", async () => {
    const standardOutput = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await expect(main(["--help"])).resolves.toBe(0);
    expect(standardOutput).toHaveBeenCalledWith(
      expect.stringContaining("Usage: ecommerce-scraper"),
    );
  });

  it("exits 2 with usage on stderr and nothing on stdout for invalid arguments", async () => {
    const standardOutput = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const standardError = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    await expect(main(["--limit", "5"])).resolves.toBe(2);
    expect(standardOutput).not.toHaveBeenCalled();
    expect(standardError).toHaveBeenCalledWith(expect.stringContaining("Unknown option '--limit'"));
  });

  it("exits 1 without writing JSON to stdout when the scrape fails", async () => {
    const standardOutput = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const standardError = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.mocked(runScraper).mockRejectedValue(new Error("Request failed for /product/7"));

    await expect(main(["--stdout"])).resolves.toBe(1);
    expect(standardOutput).not.toHaveBeenCalled();
    expect(standardError).toHaveBeenCalledWith("Error: Request failed for /product/7\n");
  });

  it("writes only JSON to stdout on success", async () => {
    const standardOutput = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.mocked(runScraper).mockResolvedValue({ results: [], total: 0 });

    await expect(main(["--stdout"])).resolves.toBe(0);
    expect(standardOutput).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(standardOutput.mock.calls[0]?.[0]))).toEqual({
      results: [],
      total: 0,
    });
  });
});
