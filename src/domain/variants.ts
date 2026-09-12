import type { ParsedProduct, ProductVariant, SwatchGroup } from "./product.ts";

export function expandStorageVariants(
  product: ParsedProduct,
  onWarning: WarningHandler = () => undefined,
): ProductVariant[] {
  const storageGroup = product.swatchGroups.find((group) =>
    group.label.trim().toLowerCase().startsWith("hdd"),
  );
  const colorGroup = product.swatchGroups.find((group) =>
    ["color", "colour"].includes(normalizeLabel(group.label)),
  );

  warnForUnrecognizedGroups(product.swatchGroups, product.sourceUrl, onWarning);

  const colors = colorGroup?.options
    .filter((option) => option.enabled)
    .map((option) => option.value.trim())
    .filter(Boolean);
  const sharedFields = {
    sourceUrl: product.sourceUrl,
    description: product.description,
    priceCents: product.priceCents,
    ...(colors && colors.length > 1 ? { colors } : {}),
  };

  if (!storageGroup) {
    return [{ ...sharedFields, name: product.name }];
  }

  const storageValues = storageGroup.options
    .filter((option) => option.enabled)
    .map((option) => Number.parseInt(option.value, 10))
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .sort((left, right) => left - right);

  if (storageValues.length === 0) {
    onWarning(`All storage options are disabled or invalid for ${product.sourceUrl}`);
    return [{ ...sharedFields, name: product.name }];
  }

  return storageValues.map((storageValue) => {
    const priceCents = applyStorageSurcharge(product.priceCents, storageValue);

    return {
      ...sharedFields,
      storageValue,
      priceCents,
      name: `${product.name} ${storageValue} GB`,
    };
  });
}

function applyStorageSurcharge(basePriceCents: number, storageValue: number): number {
  const surchargeCents = STORAGE_SURCHARGE_CENTS[storageValue] ?? 0;
  const priceCents = basePriceCents + surchargeCents;

  if (!Number.isSafeInteger(priceCents)) {
    throw new Error(`Storage surcharge overflow for ${storageValue} GB`);
  }

  return priceCents;
}

function warnForUnrecognizedGroups(
  groups: SwatchGroup[],
  sourceUrl: string,
  onWarning: WarningHandler,
): void {
  for (const group of groups) {
    const label = normalizeLabel(group.label);

    if (!label.startsWith("hdd") && !["color", "colour"].includes(label)) {
      onWarning(`Ignoring unrecognized swatch group "${group.label}" on ${sourceUrl}`);
    }
  }
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/:$/, "").toLowerCase();
}

const STORAGE_SURCHARGE_CENTS: Record<number, number> = {
  128: 0,
  256: 2_000,
  512: 4_000,
  1024: 6_000,
};

type WarningHandler = (message: string) => void;
