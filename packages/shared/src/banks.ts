import type { BankConfig } from './types.js';

export const BANKS: BankConfig[] = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    url: 'https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/interest-rates/hdfc-bank-treasury-forex-card-rates.pdf',
    enabled: true,
    mode: 'pdf',
    prompt: 'Extract all forex card TT Buying rates from this image of a PDF. Return a JSON object where keys are 3-letter currency codes (USD, EUR, GBP, etc.) and values are objects with "ttBuying" (the TT Buying rate as a number) and "unit" (the number of units the rate applies to: 100 for JPY and THB, 1 for everything else). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values, ignore TT Selling, Bill Buying, Bill Selling columns.',
  },
  {
    id: 'sbi',
    name: 'State Bank of India',
    url: 'https://sbi.bank.in/documents/16012/1400784/FOREX_CARD_RATES.pdf',
    enabled: true,
    mode: 'pdf',
    prompt: 'Extract all forex card TT Buying rates from this image of a PDF. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    url: 'https://pnb.bank.in/downloadprocess.aspx?fid=A+rrvZeJc+PIaxfEqVTIQQ==',
    enabled: true,
    mode: 'pdf',
    prompt: 'Extract all forex card TT Buying rates from this image of a PDF. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    url: 'https://application.axis.bank.in/webforms/corporatecardrate/index.aspx',
    enabled: true,
    mode: 'html',
    prompt: 'Extract all forex card TT Buying rates from this HTML. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    url: 'https://www.icici.bank.in/corporate/global-markets/forex/forex-card-rate',
    enabled: true,
    mode: 'html',
    prompt: 'Extract all forex card TT Buying rates from this HTML. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    url: 'https://www.kotak.com/en/rates/forex-rates.html',
    enabled: true,
    mode: 'llm',
    prompt: 'Extract all forex card TT Buying rates from this screenshot of a bank website. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values, ignore TT Selling, Bill Buying, Bill Selling columns.',
  },
  {
    id: 'wise',
    name: 'Wise',
    url: 'https://api.wise.com/v1/rates',
    enabled: true,
    mode: 'api',
    targetCurrency: 'INR',
  },
];

export const ENABLED_BANKS = BANKS.filter((b) => b.enabled);
export const BANK_NAME_BY_ID = Object.fromEntries(BANKS.map((b) => [b.id, b.name])) as Record<
  string,
  string
>;
