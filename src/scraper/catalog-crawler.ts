import { parseListingPage } from "./listing-parser.ts";

export const BASE_URL = "https://webscraper.io/test-sites/e-commerce/static";

export async function discoverProductUrls(
  fetchText: FetchText,
  baseUrl = BASE_URL,
): Promise<string[]> {
  const rootUrl = new URL(baseUrl);
  rootUrl.pathname = normalizePathname(rootUrl.pathname);

  const listingQueue = [rootUrl.href];
  const visitedListingUrls = new Set<string>();
  const productUrlsByPathname = new Map<string, string>();

  while (listingQueue.length > 0) {
    const listingUrl = listingQueue.shift();

    if (!listingUrl || visitedListingUrls.has(listingUrl)) {
      continue;
    }

    visitedListingUrls.add(listingUrl);
    const html = await fetchText(listingUrl);
    const listing = parseListingPage(html);

    for (const href of listing.productLinks) {
      const productUrl = resolveAllowedUrl(href, listingUrl, rootUrl);

      if (productUrl && !productUrlsByPathname.has(productUrl.pathname)) {
        productUrlsByPathname.set(
          productUrl.pathname,
          `${productUrl.origin}${productUrl.pathname}`,
        );
      }
    }

    for (const href of listing.categoryLinks) {
      const categoryUrl = resolveAllowedUrl(href, listingUrl, rootUrl);

      if (categoryUrl) {
        categoryUrl.hash = "";
        listingQueue.push(categoryUrl.href);
      }
    }

    for (let pageNumber = 2; pageNumber <= listing.maximumPage; pageNumber += 1) {
      const pageUrl = new URL(listingUrl);
      pageUrl.searchParams.set("page", String(pageNumber));
      pageUrl.hash = "";
      listingQueue.push(pageUrl.href);
    }
  }

  const productUrls = [...productUrlsByPathname.values()];

  if (productUrls.length === 0) {
    throw new Error(`No products discovered under ${rootUrl.pathname}`);
  }

  return productUrls;
}

function resolveAllowedUrl(href: string, currentUrl: string, rootUrl: URL): URL | undefined {
  let resolvedUrl: URL;

  try {
    resolvedUrl = new URL(href, currentUrl);
  } catch {
    return undefined;
  }

  resolvedUrl.pathname = normalizePathname(resolvedUrl.pathname);

  const basePath = rootUrl.pathname === "/" ? "" : rootUrl.pathname;
  const isInsideBasePath =
    resolvedUrl.pathname === basePath || resolvedUrl.pathname.startsWith(`${basePath}/`);

  return resolvedUrl.origin === rootUrl.origin && isInsideBasePath ? resolvedUrl : undefined;
}

// Trailing slashes only: path case is server-significant, so folding it could merge distinct products.
function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export type FetchText = (url: string) => Promise<string>;
