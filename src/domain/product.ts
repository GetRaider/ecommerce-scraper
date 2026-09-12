export class ParseError extends Error {
  constructor(
    public readonly url: string,
    public readonly field: string,
    message: string,
  ) {
    super(`Failed to parse ${field} from ${url}: ${message}`);
    this.name = "ParseError";
  }
}

export type ParsedProduct = {
  sourceUrl: string;
  name: string;
  description: string;
  priceCents: number;
  swatchGroups: SwatchGroup[];
};

export type SwatchGroup = {
  label: string;
  options: SwatchOption[];
};

export type SwatchOption = {
  value: string;
  enabled: boolean;
};

export type ProductVariant = {
  sourceUrl: string;
  storageValue?: number;
  name: string;
  description: string;
  priceCents: number;
  colors?: string[];
};

export type Product = {
  name: string;
  description: string;
  price: number;
  colors?: string[];
};

export type ScrapeResult = {
  results: Product[];
  total: number;
};
