import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runScraper, writeScrapeResult } from "../src/cli/index.ts";

vi.mock("node:fs/promises", () => ({ writeFile: vi.fn(() => Promise.resolve()) }));

const BASE_PATH = "https://webscraper.io/test-sites/e-commerce/static";

describe("runScraper", () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scrapes the discovered catalog through the injected fetcher", async () => {
    const result = await runScraper({
      verbose: false,
      fetcher: createFetcher(),
    });

    expect(result).toEqual({
      results: [
        {
          name: "Dell Latitude 5580 128 GB",
          description: 'Dell Latitude 5580, 15.6" FHD',
          price: 10,
        },
        {
          name: "Dell Latitude 5580 256 GB",
          description: 'Dell Latitude 5580, 15.6" FHD',
          price: 30,
        },
        {
          name: "Samsung Galaxy",
          description: "5 mpx. Android 5.0",
          price: 5.5,
          colors: ["Gold", "White", "Black"],
        },
      ],
      total: 45.5,
    });
  });

  it("aborts the whole run when a product page keeps failing", async () => {
    const fetcher = createFetcher({ failingUrl: `${BASE_PATH}/product/2` });

    await expect(runScraper({ verbose: false, fetcher })).rejects.toThrow(`${BASE_PATH}/product/2`);
  });
});

describe("writeScrapeResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes JSON to the default file and reports the path on stderr", async () => {
    const standardError = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const standardOutput = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await writeScrapeResult({ results: [], total: 0 }, false);

    expect(writeFile).toHaveBeenCalledWith(
      resolve("out.json"),
      '{\n  "results": [],\n  "total": 0\n}\n',
      "utf8",
    );
    expect(standardOutput).not.toHaveBeenCalled();
    expect(standardError).toHaveBeenCalledWith(expect.stringContaining("out.json"));
  });

  it("writes JSON to stdout when requested", async () => {
    const standardOutput = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await writeScrapeResult({ results: [], total: 0 }, true);

    expect(standardOutput).toHaveBeenCalledWith('{\n  "results": [],\n  "total": 0\n}\n');
  });
});

function createFetcher({ failingUrl }: FetcherOptions = {}) {
  const pages = new Map([
    [
      BASE_PATH,
      `<a class="title" href="/test-sites/e-commerce/static/product/1">One</a>
       <a class="title" href="/test-sites/e-commerce/static/product/2">Two</a>`,
    ],
    [
      `${BASE_PATH}/product/1`,
      `<h4 itemprop="name">Dell Latitude 5580</h4>
       <span itemprop="price">$10.00</span>
       <p itemprop="description">Dell Latitude 5580, 15.6&quot; FHD</p>
       <label class="memory">HDD:</label>
       <div class="swatches">
         <button class="swatch" value="128">128</button>
         <button class="swatch" value="256">256</button>
         <button class="swatch" value="1024" disabled>1024</button>
       </div>`,
    ],
    [
      `${BASE_PATH}/product/2`,
      `<h4 itemprop="name">Samsung Galaxy</h4>
       <span itemprop="price">$5.50</span>
       <p itemprop="description">5 mpx. Android 5.0</p>
       <select aria-label="color">
         <option value="">Select color</option>
         <option value="Gold">Gold</option>
         <option value="White">White</option>
         <option value="Black">Black</option>
       </select>`,
    ],
  ]);

  return (url: string): Promise<Response> => {
    if (url === failingUrl) {
      return Promise.resolve(new Response("", { status: 404, statusText: "Not Found" }));
    }

    const html = pages.get(url);

    return html === undefined
      ? Promise.resolve(new Response("", { status: 404, statusText: "Not Found" }))
      : Promise.resolve(new Response(html, { status: 200 }));
  };
}

type FetcherOptions = {
  failingUrl?: string;
};
