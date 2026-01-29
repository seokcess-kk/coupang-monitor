export interface ScrapeResult {
  option_key: string;
  price: number | null;
  status_code: string;
  raw_price_text?: string;
  product_name?: string;
}

export interface JobResponse {
  jobId: string;
  itemId: string;
  url: string;
  name: string | null;
  variantCursor: number;
  variantsPerRun: number;
  pageTimeoutMs: number;
}

export interface ScrapingResponse {
  results: ScrapeResult[];
  productName: string | null;
  pageStatusCode: string;
}

export interface ContentScriptResponse {
  results: ScrapeResult[];
  variantCursor: number;
  pageStatusCode: string;
  productName?: string | null;
}
