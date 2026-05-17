export interface RateEntry {
  ttBuying: number;
  unit: number;
}

export interface RateSnapshot {
  meta: {
    scrapedAt: string;
    bank: string;
    bankDisplay: string;
    sourceUrl: string;
    version: string;
  };
  rates: Record<string, RateEntry>;
}

export interface BankRates {
  lastUpdated: string;
  rates: Record<string, RateEntry>;
}

export interface AggregatedLatest {
  updatedAt: string;
  banks: Record<string, BankRates>;
}

export interface BankConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  mode: 'html' | 'pdf' | 'llm' | 'api';
  prompt?: string;
  targetCurrency?: string;
}

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  defaultUnit: number;
  /** Lower = more popular for Indian remittances (1 = most popular) */
  popularity: number;
}
