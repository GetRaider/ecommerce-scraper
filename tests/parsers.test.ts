import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import { ParseError, expandStorageVariants } from "../src/domain/index.ts";
import { parseListingPage, parseProductPage } from "../src/scraper/index.ts";

describe("parseProductPage", () => {
  let laptopHtml: string;
  let phoneHtml: string;
  let colorHtml: string;

  beforeAll(async () => {
    [laptopHtml, phoneHtml, colorHtml] = await Promise.all([
      readFixture("laptop.html"),
      readFixture("phone.html"),
      readFixture("color.html"),
    ]);
  });

  it("extracts required fields, decodes entities, and captures disabled storage", () => {
    const product = parseProductPage(laptopHtml, "https://example.com/product/1");

    expect(product).toMatchObject({
      name: "Dell Latitude 5580",
      description: 'Dell Latitude 5580, 15.6" FHD, Core i5-7200U',
      priceCents: 117_819,
    });
    expect(product.swatchGroups[0]?.options).toEqual([
      { value: "128", enabled: true },
      { value: "256", enabled: true },
      { value: "512", enabled: true },
      { value: "1024", enabled: false },
    ]);
  });

  it("parses the live colour select on phones", () => {
    const product = parseProductPage(phoneHtml, "https://example.com/product/2");

    expect(product.swatchGroups).toEqual([
      {
        label: "color",
        options: [
          { value: "Gold", enabled: true },
          { value: "White", enabled: true },
          { value: "Black", enabled: true },
        ],
      },
    ]);
    expect(expandStorageVariants(product)[0]?.colors).toEqual(["Gold", "White", "Black"]);
  });

  it("parses synthetic colors and excludes disabled colors during expansion", () => {
    const product = parseProductPage(colorHtml, "https://example.com/product/3");

    expect(expandStorageVariants(product)[0]?.colors).toEqual(["gold", "white", "black"]);
  });

  it("falls back to class selectors when microdata is absent", async () => {
    const product = parseProductPage(
      await readFixture("legacy-classes.html"),
      "https://example.com/product/4",
    );

    expect(product).toMatchObject({
      name: "Asus VivoBook 15",
      description: 'Asus VivoBook 15, 15.6" FHD, Core i3-8130U',
      priceCents: 123_549,
    });
    expect(expandStorageVariants(product).map((variant) => variant.name)).toEqual([
      "Asus VivoBook 15 128 GB",
      "Asus VivoBook 15 256 GB",
    ]);
  });

  it("throws a field-specific ParseError for malformed pages", () => {
    expect(() =>
      parseProductPage(
        "<h4 itemprop='name'>Name</h4><p itemprop='description'>Description</p>",
        "https://example.com/product/broken",
      ),
    ).toThrow(ParseError);
    expect(() =>
      parseProductPage(
        "<h4 itemprop='name'>Name</h4><p itemprop='description'>Description</p>",
        "https://example.com/product/broken",
      ),
    ).toThrow("price");
  });
});

describe("parseListingPage", () => {
  it("extracts categories, products, and the maximum page", async () => {
    const listing = parseListingPage(await readFixture("listing.html"));

    expect(listing.categoryLinks).toEqual([
      "/test-sites/e-commerce/static/computers",
      "/test-sites/e-commerce/static/computers/laptops",
      "https://outside.example/catalog",
    ]);
    expect(listing.productLinks).toEqual([
      "/test-sites/e-commerce/static/product/1",
      "/test-sites/e-commerce/static/product/2",
    ]);
    expect(listing.maximumPage).toBe(4);
  });

  it("defaults to one page without pagination", () => {
    expect(parseListingPage("<a class='title' href='/product/1'>One</a>").maximumPage).toBe(1);
  });
});

async function readFixture(name: string): Promise<string> {
  return readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8");
}
