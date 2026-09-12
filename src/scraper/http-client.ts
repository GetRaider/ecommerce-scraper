import { getErrorMessage } from "../lib/errors.ts";

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 10_000;
  const maximumAttempts = options.maximumAttempts ?? 3;
  const baseDelayMilliseconds = options.baseDelayMilliseconds ?? 250;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? delay;

  return {
    async fetchText(url: string): Promise<string> {
      let lastError: unknown;

      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        let retryAfterMilliseconds: number | undefined;

        try {
          const response = await fetcher(url, {
            headers: {
              "User-Agent":
                "ecommerce-scraper/1.0 (+https://webscraper.io/test-sites/e-commerce/static)",
              Accept: "text/html,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(timeoutMilliseconds),
          });

          if (response.ok) {
            return await response.text();
          }

          const statusError = new Error(`HTTP ${response.status} ${response.statusText}`.trim());

          if (!isRetryableStatus(response.status)) {
            throw new HttpRequestError(url, statusError);
          }

          lastError = statusError;
          retryAfterMilliseconds = parseRetryAfter(response.headers.get("retry-after"));
        } catch (error) {
          if (error instanceof HttpRequestError) {
            throw error;
          }

          lastError = error;
        }

        if (attempt < maximumAttempts) {
          const backoffMilliseconds =
            retryAfterMilliseconds ??
            exponentialBackoffMilliseconds(baseDelayMilliseconds, attempt, random);
          options.onRetry?.(url, attempt, backoffMilliseconds, lastError);
          await sleep(backoffMilliseconds);
        }
      }

      throw new HttpRequestError(url, lastError);
    },
  };
}

function exponentialBackoffMilliseconds(
  baseDelayMilliseconds: number,
  attempt: number,
  random: () => number,
): number {
  const exponentialFactor = 2 ** (attempt - 1);
  const jitterFactor = 0.5 + random();

  return baseDelayMilliseconds * exponentialFactor * jitterFactor;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class HttpRequestError extends Error {
  constructor(
    public readonly url: string,
    public override readonly cause: unknown,
  ) {
    super(`Request failed for ${url}: ${getErrorMessage(cause)}`, { cause });
    this.name = "HttpRequestError";
  }
}

export type HttpClient = {
  fetchText(url: string): Promise<string>;
};

export type HttpClientOptions = {
  fetcher?: Fetcher;
  timeoutMilliseconds?: number;
  maximumAttempts?: number;
  baseDelayMilliseconds?: number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onRetry?: (url: string, attempt: number, delayMilliseconds: number, error: unknown) => void;
};

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
