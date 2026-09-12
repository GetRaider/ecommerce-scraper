import { describe, expect, it, vi } from "vitest";

import { parseCliArgs, serializeScrapeResult } from "../src/cli/index.ts";
import { mapWithConcurrency } from "../src/lib/concurrency.ts";
import { createHttpClient } from "../src/scraper/index.ts";

describe("mapWithConcurrency", () => {
  it("respects the concurrency cap and preserves input order", async () => {
    let activeTasks = 0;
    let peakActiveTasks = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      activeTasks += 1;
      peakActiveTasks = Math.max(peakActiveTasks, activeTasks);
      await delay(5);
      activeTasks -= 1;
      return value * 2;
    });

    expect(peakActiveTasks).toBe(2);
    expect(results).toEqual([2, 4, 6, 8]);
  });

  it("propagates mapper failures", async () => {
    await expect(
      mapWithConcurrency([1], 1, () => Promise.reject(new Error("failed"))),
    ).rejects.toThrow("failed");
  });

  it("stops starting work after the first failure", async () => {
    const values = Array.from({ length: 20 }, (_, index) => index);
    let startedTasks = 0;

    await expect(
      mapWithConcurrency(values, 4, async (value) => {
        startedTasks += 1;
        await delay(5);

        if (value === 0) {
          throw new Error("first page failed");
        }

        return value;
      }),
    ).rejects.toThrow("first page failed");

    await delay(50);
    expect(startedTasks).toBeLessThanOrEqual(4);
  });
});

describe("createHttpClient", () => {
  it("retries a transient status and then succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500, statusText: "Server Error" }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(() => Promise.resolve());
    const client = createHttpClient({
      fetcher,
      sleep,
      random: () => 0.5,
      baseDelayMilliseconds: 10,
    });

    await expect(client.fetchText("https://example.com/page")).resolves.toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("honours a numeric Retry-After header", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "retry-after": "2" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(() => Promise.resolve());
    const client = createHttpClient({
      fetcher,
      sleep,
      random: () => 0.5,
      baseDelayMilliseconds: 10,
    });

    await expect(client.fetchText("https://example.com/page")).resolves.toBe("ok");
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("does not retry non-429 client errors", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(new Response("", { status: 404, statusText: "Not Found" })),
    );
    const client = createHttpClient({ fetcher, sleep: vi.fn(() => Promise.resolve()) });

    await expect(client.fetchText("https://example.com/missing")).rejects.toThrow(
      "https://example.com/missing",
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("enforces the request timeout without network access", async () => {
    const fetcher = vi.fn((_url: string, init: RequestInit): Promise<Response> => {
      const signal = init.signal;

      if (!signal) {
        return Promise.reject(new Error("Expected an abort signal"));
      }

      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("Request timed out", { cause: signal.reason })),
          { once: true },
        );
      });
    });
    const client = createHttpClient({
      fetcher,
      timeoutMilliseconds: 5,
      maximumAttempts: 1,
    });

    await expect(client.fetchText("https://example.com/slow")).rejects.toThrow(
      "https://example.com/slow",
    );
  });
});

describe("parseCliArgs", () => {
  it("parses supported options", () => {
    expect(parseCliArgs(["--verbose"])).toEqual({
      stdout: false,
      uniqueTotal: false,
      verbose: true,
      help: false,
    });
  });

  it("enables terminal output explicitly", () => {
    expect(parseCliArgs(["--stdout"]).stdout).toBe(true);
  });

  it("enables unique-price totals explicitly", () => {
    expect(parseCliArgs(["--unique-total"]).uniqueTotal).toBe(true);
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--pretty"])).toThrow("Unknown option '--pretty'");
  });
});

describe("serializeScrapeResult", () => {
  it("always formats JSON with two-space indentation", () => {
    expect(serializeScrapeResult({ results: [], total: 0 })).toBe(
      '{\n  "results": [],\n  "total": 0\n}',
    );
  });
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
