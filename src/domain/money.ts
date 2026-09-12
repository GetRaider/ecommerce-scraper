export function parsePrice(value: string): number {
  const normalizedValue = value.trim().replaceAll(",", "");
  const match = /^\$(\d+)(?:\.(\d{1,2}))?$/.exec(normalizedValue);

  if (!match) {
    throw new Error(`Invalid price: ${JSON.stringify(value)}`);
  }

  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const priceCents = dollars * 100 + cents;

  if (!Number.isSafeInteger(priceCents)) {
    throw new Error(`Price exceeds the supported range: ${JSON.stringify(value)}`);
  }

  return priceCents;
}

export function centsToNumber(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Invalid cent amount: ${cents}`);
  }

  return Number((cents / 100).toFixed(2));
}
