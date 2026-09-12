import { load } from "cheerio";

export function parseListingPage(html: string): ListingPage {
  const $ = load(html);
  const categoryLinks = collectLinks($, "a.category-link, a.subcategory-link");
  const productLinks = collectLinks($, "a.title");
  const pageNumbers = $(".pagination a[href]")
    .toArray()
    .flatMap((element) => {
      const href = $(element).attr("href");

      if (!href) {
        return [];
      }

      const page = new URL(href, "https://example.invalid").searchParams.get("page");
      const pageNumber = Number(page);

      return Number.isInteger(pageNumber) && pageNumber > 0 ? [pageNumber] : [];
    });

  return {
    categoryLinks,
    productLinks,
    maximumPage: Math.max(1, ...pageNumbers),
  };
}

function collectLinks($: ReturnType<typeof load>, selector: string): string[] {
  return $(selector)
    .toArray()
    .flatMap((element) => {
      const href = $(element).attr("href")?.trim();
      return href ? [href] : [];
    });
}

export type ListingPage = {
  categoryLinks: string[];
  productLinks: string[];
  maximumPage: number;
};
