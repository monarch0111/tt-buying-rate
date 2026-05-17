import type { CurrencyConfig } from './types.js';

// Ordered by popularity for Indian forex remittance (1 = most popular).
// Based on RBI remittance survey: Gulf ~30%, US/CA ~23%, UK/EU ~15%, SEA ~10%, ANZ ~5%.
export const CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', name: 'US Dollar',           symbol: '$',   defaultUnit: 1,   popularity: 1 },
  { code: 'AED', name: 'UAE Dirham',           symbol: 'د.إ', defaultUnit: 1,   popularity: 2 },
  { code: 'GBP', name: 'British Pound',        symbol: '£',   defaultUnit: 1,   popularity: 3 },
  { code: 'EUR', name: 'Euro',                 symbol: '€',   defaultUnit: 1,   popularity: 4 },
  { code: 'SAR', name: 'Saudi Riyal',          symbol: '﷼',  defaultUnit: 1,   popularity: 5 },
  { code: 'SGD', name: 'Singapore Dollar',     symbol: 'S$',  defaultUnit: 1,   popularity: 6 },
  { code: 'CAD', name: 'Canadian Dollar',      symbol: 'C$',  defaultUnit: 1,   popularity: 7 },
  { code: 'QAR', name: 'Qatari Riyal',         symbol: '﷼',  defaultUnit: 1,   popularity: 8 },
  { code: 'AUD', name: 'Australian Dollar',    symbol: 'A$',  defaultUnit: 1,   popularity: 9 },
  { code: 'KWD', name: 'Kuwaiti Dinar',        symbol: 'د.ك', defaultUnit: 1,   popularity: 10 },
  { code: 'MYR', name: 'Malaysian Ringgit',    symbol: 'RM',  defaultUnit: 1,   popularity: 11 },
  { code: 'JPY', name: 'Japanese Yen',         symbol: '¥',   defaultUnit: 100, popularity: 12 },
  { code: 'CHF', name: 'Swiss Franc',          symbol: 'Fr',  defaultUnit: 1,   popularity: 13 },
  { code: 'NZD', name: 'New Zealand Dollar',   symbol: 'NZ$', defaultUnit: 1,   popularity: 14 },
  { code: 'HKD', name: 'Hong Kong Dollar',     symbol: 'HK$', defaultUnit: 1,   popularity: 15 },
  { code: 'THB', name: 'Thai Baht',            symbol: '฿',   defaultUnit: 1,   popularity: 16 },
  { code: 'CNY', name: 'Chinese Yuan',         symbol: '¥',   defaultUnit: 1,   popularity: 17 },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
export const CURRENCY_NAME_BY_CODE = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.name])
) as Record<string, string>;
export const CURRENCY_SYMBOL_BY_CODE = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
) as Record<string, string>;
