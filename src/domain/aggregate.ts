import { centsToNumber } from "./money.ts";

import type { Product, ProductVariant, ScrapeResult } from "./product.ts";

export function buildScrapeResult(variants: ProductVariant[], uniqueTotal = false): ScrapeResult {
  const orderedVariants = variants.toSorted(compareVariants);
  const priceCentsList = orderedVariants.map((variant) => variant.priceCents);
  const centsToSum = uniqueTotal ? [...new Set(priceCentsList)] : priceCentsList;

  return {
    results: orderedVariants.map(toProduct),
    total: centsToNumber(sumCents(centsToSum)),
  };
}

function sumCents(priceCentsList: number[]): number {
  return priceCentsList.reduce((total, priceCents) => {
    const nextTotal = total + priceCents;

    if (!Number.isSafeInteger(nextTotal)) {
      throw new Error("Scrape total exceeds the supported range");
    }

    return nextTotal;
  }, 0);
}

function compareVariants(left: ProductVariant, right: ProductVariant): number {
  if (left.sourceUrl !== right.sourceUrl) {
    return left.sourceUrl < right.sourceUrl ? -1 : 1;
  }

  return (left.storageValue ?? 0) - (right.storageValue ?? 0);
}

function toProduct(variant: ProductVariant): Product {
  return {
    name: variant.name,
    description: variant.description,
    price: centsToNumber(variant.priceCents),
    ...(variant.colors ? { colors: [...variant.colors] } : {}),
  };
}
