import { describe, expect, it, vi } from "vitest";

import { discoverProductUrls } from "../src/scraper/index.ts";

describe("discoverProductUrls", () => {
  it("walks category BFS, pagination, and deduplicates product pathnames", async () => {
    const pages = new Map([
      [
        "https://example.com/base",
        listingHtml({
          categories: ["/base/parent", "https://outside.example/category"],
          products: ["/base/product/1", "https://outside.example/product/9"],
        }),
      ],
      [
        "https://example.com/base/parent",
        listingHtml({
          categories: ["/base/parent/child"],
          products: ["/base/product/1"],
          maximumPage: 3,
        }),
      ],
      ["https://example.com/base/parent/child", listingHtml({ products: ["/base/product/3"] })],
      ["https://example.com/base/parent?page=2", listingHtml({ products: ["/base/product/2"] })],
      [
        "https://example.com/base/parent?page=3",
        listingHtml({ products: ["/base/product/2?tracking=duplicate"] }),
      ],
    ]);
    const fetchText = vi.fn((url: string) => {
      const html = pages.get(url);

      if (!html) {
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }

      return Promise.resolve(html);
    });

    await expect(discoverProductUrls(fetchText, "https://example.com/base")).resolves.toEqual([
      "https://example.com/base/product/1",
      "https://example.com/base/product/3",
      "https://example.com/base/product/2",
    ]);
    expect(fetchText).toHaveBeenCalledTimes(5);
    expect(fetchText).not.toHaveBeenCalledWith(expect.stringContaining("outside.example"));
  });

  it("treats trailing-slash variants as one product and one listing", async () => {
    const fetchText = vi.fn(() =>
      Promise.resolve(
        `<a class="category-link" href="/base/">Self</a>
         <a class="title" href="/base/product/1">Product</a>
         <a class="title" href="/base/product/1/">Same product</a>`,
      ),
    );

    await expect(discoverProductUrls(fetchText, "https://example.com/base")).resolves.toEqual([
      "https://example.com/base/product/1",
    ]);
    expect(fetchText).toHaveBeenCalledOnce();
  });

  it("rejects an empty catalog", async () => {
    await expect(
      discoverProductUrls(() => Promise.resolve("<html></html>"), "https://example.com/base"),
    ).rejects.toThrow("No products discovered");
  });
});

function listingHtml({ categories = [], products = [], maximumPage = 1 }: ListingFixture): string {
  const categoryLinks = categories
    .map((href) => `<a class="category-link" href="${href}">Category</a>`)
    .join("");
  const productLinks = products
    .map((href) => `<a class="title" href="${href}">Product</a>`)
    .join("");
  const paginationLinks = Array.from(
    { length: maximumPage },
    (_, index) => `<a href="?page=${index + 1}">${index + 1}</a>`,
  ).join("");

  return `${categoryLinks}${productLinks}<div class="pagination">${paginationLinks}</div>`;
}

type ListingFixture = {
  categories?: string[];
  products?: string[];
  maximumPage?: number;
};
