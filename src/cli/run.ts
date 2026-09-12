import { buildScrapeResult, expandStorageVariants } from "../domain/index.ts";
import { mapWithConcurrency } from "../lib/concurrency.ts";
import { getErrorMessage } from "../lib/errors.ts";
import { createLogger } from "../lib/logger.ts";
import { createHttpClient, discoverProductUrls, parseProductPage } from "../scraper/index.ts";

import type { ScrapeResult } from "../domain/index.ts";
import type { HttpClientOptions } from "../scraper/index.ts";

const PRODUCT_FETCH_CONCURRENCY = 8;

export async function runScraper(options: ScraperOptions): Promise<ScrapeResult> {
  const logger = createLogger(options.verbose);
  const httpClient = createHttpClient({
    onRetry: (url, attempt, delayMilliseconds, error) =>
      logger.warn(
        `Retrying ${url} after attempt ${attempt} in ${Math.round(delayMilliseconds)}ms: ${getErrorMessage(error)}`,
      ),
    ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
  });
  const fetchText = async (url: string): Promise<string> => {
    logger.debug(`Fetching ${url}`);
    return httpClient.fetchText(url);
  };

  logger.info("Discovering catalog");
  const productUrls = await discoverProductUrls(fetchText);
  logger.info(`Discovered ${productUrls.length} products`);

  let completedProducts = 0;
  const variantsByProduct = await mapWithConcurrency(
    productUrls,
    PRODUCT_FETCH_CONCURRENCY,
    async (productUrl) => {
      const html = await fetchText(productUrl);
      const product = parseProductPage(html, productUrl);
      const variants = expandStorageVariants(product, (message) => logger.warn(message));
      completedProducts += 1;

      if (completedProducts % 10 === 0 || completedProducts === productUrls.length) {
        logger.info(`Scraped ${completedProducts}/${productUrls.length} products`);
      }

      return variants;
    },
  );

  return buildScrapeResult(variantsByProduct.flat(), options.uniqueTotal);
}

export type ScraperOptions = {
  verbose: boolean;
  uniqueTotal?: boolean;
  fetcher?: HttpClientOptions["fetcher"];
};
