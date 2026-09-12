import { load } from "cheerio";

import { ParseError, parsePrice } from "../domain/index.ts";
import { getErrorMessage } from "../lib/errors.ts";

import type { ParsedProduct, SwatchGroup } from "../domain/index.ts";

export function parseProductPage(html: string, sourceUrl: string): ParsedProduct {
  const $ = load(html);
  const name = extractRequiredText(
    $("h4[itemprop='name']").first().text() || $(".title").first().text(),
    sourceUrl,
    "name",
  );
  const description = extractRequiredText(
    $("p[itemprop='description']").first().text() || $(".description").first().text(),
    sourceUrl,
    "description",
  );
  const priceText = extractRequiredText(
    $("span[itemprop='price']").first().text() || $(".price").first().text(),
    sourceUrl,
    "price",
  );

  let priceCents: number;

  try {
    priceCents = parsePrice(priceText);
  } catch (error) {
    throw new ParseError(sourceUrl, "price", getErrorMessage(error));
  }

  const buttonGroups = $("label")
    .toArray()
    .flatMap((label): SwatchGroup[] => {
      const swatches = $(label).next("div.swatches");

      if (swatches.length === 0) {
        return [];
      }

      const options = swatches
        .find("button.swatch[value]")
        .toArray()
        .map((button) => ({
          value: ($(button).attr("value") ?? "").trim(),
          enabled: !$(button).is(":disabled"),
        }))
        .filter((option) => option.value.length > 0);

      return [
        {
          label: $(label).text().trim(),
          options,
        },
      ];
    });

  const colorSelectGroups = $('select[aria-label="color"], select[aria-label="colour"]')
    .toArray()
    .flatMap((select): SwatchGroup[] => {
      const options = $(select)
        .find("option[value]")
        .toArray()
        .map((option) => ({
          value: ($(option).attr("value") ?? "").trim(),
          enabled: !$(option).is(":disabled"),
        }))
        .filter((option) => option.value.length > 0);

      if (options.length === 0) {
        return [];
      }

      return [
        {
          label: ($(select).attr("aria-label") ?? "color").trim(),
          options,
        },
      ];
    });

  return {
    sourceUrl,
    name,
    description,
    priceCents,
    swatchGroups: [...buttonGroups, ...colorSelectGroups],
  };
}

function extractRequiredText(value: string, sourceUrl: string, field: string): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new ParseError(sourceUrl, field, "required field is missing");
  }

  return normalizedValue;
}
