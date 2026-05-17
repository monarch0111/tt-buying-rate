import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from './config.js';

const SYSTEM_PROMPT = `You are a forex rate data extractor. You will be given content from an Indian bank website or PDF showing foreign exchange rates. The content may be raw HTML or an image of a PDF.

Your task: Extract ONLY the TT Buying (Telegraphic Transfer Buying) rate for each currency.

Return a JSON object with this exact format:
{
  "USD": {"ttBuying": 83.45, "unit": 1},
  "EUR": {"ttBuying": 90.12, "unit": 1},
  "JPY": {"ttBuying": 55.46, "unit": 100}
}

Rules:
- Keys must be 3-letter ISO currency codes (USD, EUR, GBP, AUD, CAD, CHF, JPY, SGD, AED, SAR, NZD, HKD, THB, MYR, CNY, KWD, QAR)
- ttBuying must be a number (not a string)
- unit is the number of units the rate applies to: 1 for most currencies, 100 for JPY/THB if rate is per 100 units
- IMPORTANT: Check whether rates like JPY and THB are quoted per 1 unit or per 100 units. If JPY shows ~0.57, unit is 1. If JPY shows ~58.59, unit is 100.
- Only extract TT Buying rates, ignore TT Selling, Bill Buying, Bill Selling, Card Rates columns
- If a currency appears but the TT Buying rate is blank or N/A, skip it
- Return ONLY the JSON object, no markdown, no explanation`;

export async function extractRatesWithLLMImage(base64Image, userPrompt) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const body = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt || 'Extract the TT Buying forex rates from this image.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  if (OPENROUTER_MODEL.includes('gpt-5') || OPENROUTER_MODEL.includes('o1') || OPENROUTER_MODEL.includes('o3')) {
    body.reasoning = { effort: 'high' };
  }

  return callLLM(body);
}

export async function extractRatesWithLLMText(html, userPrompt) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const body = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${userPrompt || 'Extract the TT Buying forex rates from this HTML.'}\n\n--- HTML CONTENT ---\n${html}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  if (OPENROUTER_MODEL.includes('gpt-5') || OPENROUTER_MODEL.includes('o1') || OPENROUTER_MODEL.includes('o3')) {
    body.reasoning = { effort: 'high' };
  }

  return callLLM(body);
}

async function callLLM(body) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://example.com',
      'X-Title': 'Indian Forex Rate Tracker',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(`[LLM] Model: ${OPENROUTER_MODEL}, Usage: ${JSON.stringify(result.usage || 'N/A')}`);

  if (!result.choices?.[0]?.message?.content) {
    console.error(`[LLM] Full response: ${JSON.stringify(result).substring(0, 500)}`);
    throw new Error('No response from LLM');
  }

  const rawContent = result.choices[0].message.content;
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM did not return valid JSON. Response: ${rawContent}`);
  }

  try {
    const rates = JSON.parse(jsonMatch[0]);

    for (const [currency, data] of Object.entries(rates)) {
      if (typeof data.ttBuying !== 'number' || data.ttBuying <= 0) {
        throw new Error(`Invalid rate for ${currency}: ${JSON.stringify(data)}`);
      }
      if (!data.unit) {
        data.unit = currency === 'JPY' || currency === 'THB' ? 100 : 1;
      }
    }

    return rates;
  } catch (e) {
    if (e.message.startsWith('Invalid rate')) throw e;
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}\nRaw: ${rawContent}`);
  }
}