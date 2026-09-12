import { describe, expect, it } from "vitest";

import { buildScrapeResult, expandStorageVariants, parsePrice } from "../src/domain/index.ts";

import type { ParsedProduct, ProductVariant } from "../src/domain/index.ts";

describe("money", () => {
  it.each([
    ["$1178.19", 117_819],
    ["$1143.4", 114_340],
    [" $1,178.19 ", 117_819],
    ["$10.00", 1_000],
  ])("parses %s into exact cents", (value, expected) => {
    expect(parsePrice(value)).toBe(expected);
  });

  it("rejects malformed prices", () => {
    expect(() => parsePrice("1178.19")).toThrow("Invalid price");
    expect(() => parsePrice("$12.123")).toThrow("Invalid price");
  });
});

describe("expandStorageVariants", () => {
  it("expands enabled storage options in ascending order", () => {
    const variants = expandStorageVariants({
      ...createProduct(),
      swatchGroups: [
        {
          label: "HDD:",
          options: [
            { value: "512", enabled: true },
            { value: "1024", enabled: false },
            { value: "128", enabled: true },
            { value: "256", enabled: true },
          ],
        },
      ],
    });

    expect(variants.map((variant) => variant.name)).toEqual([
      "Laptop 128 GB",
      "Laptop 256 GB",
      "Laptop 512 GB",
    ]);
    expect(variants.map((variant) => variant.priceCents)).toEqual([100, 2_100, 4_100]);
  });

  it("applies the app.js HDD surcharge to the SSR base price", () => {
    const variants = expandStorageVariants({
      ...createProduct(),
      priceCents: 110_266,
      swatchGroups: [
        {
          label: "HDD:",
          options: [
            { value: "128", enabled: true },
            { value: "256", enabled: true },
            { value: "512", enabled: true },
            { value: "1024", enabled: false },
          ],
        },
      ],
    });

    expect(variants.map((variant) => variant.priceCents)).toEqual([110_266, 112_266, 114_266]);
  });

  it("keeps one base product when storage is absent", () => {
    expect(expandStorageVariants(createProduct())).toHaveLength(1);
    expect(expandStorageVariants(createProduct())[0]?.name).toBe("Laptop");
  });

  it("includes multiple enabled colors and omits a single color", () => {
    const multipleColors = expandStorageVariants({
      ...createProduct(),
      swatchGroups: [
        {
          label: "Colour:",
          options: [
            { value: "black", enabled: true },
            { value: "white", enabled: true },
            { value: "retired", enabled: false },
          ],
        },
      ],
    });
    const singleColor = expandStorageVariants({
      ...createProduct(),
      swatchGroups: [{ label: "Color:", options: [{ value: "black", enabled: true }] }],
    });

    expect(multipleColors[0]?.colors).toEqual(["black", "white"]);
    expect(singleColor[0]).not.toHaveProperty("colors");
  });

  it("falls back to the base name when every storage option is disabled", () => {
    const warnings: string[] = [];
    const variants = expandStorageVariants(
      {
        ...createProduct(),
        swatchGroups: [{ label: "HDD:", options: [{ value: "1024", enabled: false }] }],
      },
      (message) => warnings.push(message),
    );

    expect(variants).toHaveLength(1);
    expect(variants[0]?.name).toBe("Laptop");
    expect(warnings).toEqual([
      "All storage options are disabled or invalid for https://example.com/product/1",
    ]);
  });

  it("warns and ignores unrecognized swatch groups", () => {
    const warnings: string[] = [];
    const variants = expandStorageVariants(
      {
        ...createProduct(),
        swatchGroups: [{ label: "Size:", options: [{ value: "L", enabled: true }] }],
      },
      (message) => warnings.push(message),
    );

    expect(variants).toHaveLength(1);
    expect(variants[0]?.name).toBe("Laptop");
    expect(warnings).toEqual([
      'Ignoring unrecognized swatch group "Size:" on https://example.com/product/1',
    ]);
  });
});

describe("buildScrapeResult", () => {
  it("sorts deterministically and sums every row in cents", () => {
    const variants: ProductVariant[] = [
      createVariant("/product/2", "Same", 20),
      createVariant("/product/1", "Same", 10, "First description"),
      createVariant("/product/1", "Same", 10, "Second description", 256),
    ];

    expect(buildScrapeResult(variants)).toEqual({
      results: [
        { name: "Same", description: "First description", price: 0.1 },
        { name: "Same", description: "Second description", price: 0.1 },
        { name: "Same", description: "Description", price: 0.2 },
      ],
      total: 0.4,
    });
  });

  it("preserves same-named and description-distinct products", () => {
    const result = buildScrapeResult([
      createVariant("/product/1", "Duplicate name", 100, "One"),
      createVariant("/product/2", "Duplicate name", 200, "Two"),
      createVariant("/product/3", "Duplicate name", 200, "Three"),
    ]);

    expect(result.results).toHaveLength(3);
    expect(result.total).toBe(5);
  });

  it("sums each unique price once when uniqueTotal is set", () => {
    const result = buildScrapeResult(
      [
        createVariant("/product/1", "Same", 10, "First description"),
        createVariant("/product/1", "Same", 10, "Second description", 256),
        createVariant("/product/2", "Same", 20),
      ],
      true,
    );

    expect(result.results).toHaveLength(3);
    expect(result.total).toBe(0.3);
  });
});

function createProduct(): ParsedProduct {
  return {
    sourceUrl: "https://example.com/product/1",
    name: "Laptop",
    description: "Description",
    priceCents: 100,
    swatchGroups: [],
  };
}

function createVariant(
  sourceUrl: string,
  name: string,
  priceCents: number,
  description = "Description",
  storageValue?: number,
): ProductVariant {
  return {
    sourceUrl,
    name,
    description,
    priceCents,
    ...(storageValue === undefined ? {} : { storageValue }),
  };
}
