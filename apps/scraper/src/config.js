export const BANKS = {
  hdfc: {
    id: 'hdfc',
    name: 'HDFC Bank',
    url: 'https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/interest-rates/hdfc-bank-treasury-forex-card-rates.pdf',
    mode: 'pdf',
    prompt: 'Extract all forex card TT Buying rates from this image of a PDF. Return a JSON object where keys are 3-letter currency codes (USD, EUR, GBP, etc.) and values are objects with "ttBuying" (the TT Buying rate as a number) and "unit" (the number of units the rate applies to: 100 for JPY and THB, 1 for everything else). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values, ignore TT Selling, Bill Buying, Bill Selling columns.',
  },
  axis: {
    id: 'axis',
    name: 'Axis Bank',
    url: 'https://application.axis.bank.in/webforms/corporatecardrate/index.aspx',
    mode: 'html',
    prompt: 'Extract all forex card TT Buying rates from this HTML. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  icici: {
    id: 'icici',
    name: 'ICICI Bank',
    url: 'https://www.icici.bank.in/corporate/global-markets/forex/forex-card-rate',
    mode: 'html',
    prompt: 'Extract all forex card TT Buying rates from this HTML. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  kotak: {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    url: 'https://www.kotak.com/en/rates/forex-rates.html',
    mode: 'llm',
    prompt: 'Extract all forex card TT Buying rates from this screenshot of a bank website. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values, ignore TT Selling, Bill Buying, Bill Selling columns.',
  },
  pnb: {
    id: 'pnb',
    name: 'Punjab National Bank',
    url: 'https://pnb.bank.in/downloadprocess.aspx?fid=A+rrvZeJc+PIaxfEqVTIQQ==',
    mode: 'pdf',
    prompt: 'Extract all forex card TT Buying rates from this image of a PDF. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  sbi: {
    id: 'sbi',
    name: 'State Bank of India',
    url: 'https://sbi.bank.in/documents/16012/1400784/FOREX_CARD_RATES.pdf',
    mode: 'pdf',
    prompt: 'Extract all forex card TT Buying rates from this image of a PDF. Return a JSON object where keys are 3-letter currency codes and values are objects with "ttBuying" (number) and "unit" (1 for most, 100 for JPY/THB if rate is per 100 units). Pay close attention to whether the rate is per 1 unit or per 100 units and set "unit" accordingly. Only include TT Buying column values.',
  },
  wise: {
    id: 'wise',
    name: 'Wise',
    url: 'https://api.wise.com/v1/rates',
    mode: 'api',
    targetCurrency: 'INR',
  },
};

export const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD', 'SAR', 'QAR', 'KWD',
  'JPY', 'CHF', 'NZD', 'HKD', 'MYR', 'THB', 'CNY',
];

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
export const WISE_API_KEY = process.env.WISE_API_KEY || (() => { throw new Error('WISE_API_KEY environment variable is required') })();
export const R2_ENDPOINT = process.env.R2_ENDPOINT || (() => { throw new Error('R2_ENDPOINT environment variable is required') })();
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || (() => { throw new Error('R2_ACCESS_KEY_ID environment variable is required') })();
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || (() => { throw new Error('R2_SECRET_ACCESS_KEY environment variable is required') })();
export const R2_BUCKET = process.env.R2_BUCKET || 'forex-rates';