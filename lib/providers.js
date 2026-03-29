import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const LISTING_PROMPT = `Parse the input into listing records and return ONLY valid JSON.
Return a JSON array where each item is one listing object with these keys only:
listing_title, company_name, industry, sub_industry, city, state_province, country, asking_price, revenue, ebitda, sde_cash_flow, employees, established_year, inventory_included, real_estate_included, reason_for_sale, summary, keywords_normalized, source_url.
If only one listing is found, still return an array with one object.
Use null for unknown numeric values and empty strings for unknown text values.
Do not include markdown or commentary.`;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const OPENROUTER_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free';
const OPENROUTER_MODEL_FALLBACKS = (process.env.OPENROUTER_MODEL_FALLBACKS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const OPENROUTER_MAX_RETRIES = Number(process.env.OPENROUTER_MAX_RETRIES || 2);

class ProviderError extends Error {
  constructor(message, status = 500, code = 'PROVIDER_ERROR') {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
  }
}

function isGeminiQuotaError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('429') || message.includes('quota exceeded') || message.includes('too many requests');
}

function parseJsonFromModelText(text) {
  const normalized = String(text || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(normalized);
  } catch {
    const arrStart = normalized.indexOf('[');
    const arrEnd = normalized.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
      return JSON.parse(normalized.slice(arrStart, arrEnd + 1));
    }

    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(normalized.slice(start, end + 1));
    }
    throw new ProviderError('Model response was not valid JSON.', 502, 'INVALID_MODEL_JSON');
  }
}

function attachMeta(parsed, meta) {
  if (Array.isArray(parsed)) {
    return parsed.map((row) => (row && typeof row === 'object' ? { ...row, _meta: { ...(row._meta || {}), ...meta } } : row));
  }
  if (parsed && typeof parsed === 'object') {
    return { ...parsed, _meta: { ...(parsed._meta || {}), ...meta } };
  }
  return parsed;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(retryAfterHeader, attempt) {
  const retrySeconds = Number(retryAfterHeader);
  if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
    return retrySeconds * 1000;
  }
  // Exponential backoff fallback when Retry-After is missing.
  return Math.min(30000, 1000 * Math.pow(2, attempt));
}

function isOpenRouterModelSelectionError(status, details) {
  if (status !== 400) return false;
  const normalized = String(details || '').toLowerCase();
  return (
    normalized.includes('model') ||
    normalized.includes('provider') ||
    normalized.includes('not found') ||
    normalized.includes('unsupported')
  );
}

async function parseWithChatGPT(rawText) {
  if (!process.env.OPENAI_API_KEY) {
    throw new ProviderError('OPENAI_API_KEY is not configured.', 400, 'OPENAI_MISSING_KEY');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: 'system', content: LISTING_PROMPT },
      { role: 'user', content: rawText }
    ]
  });
  return parseJsonFromModelText(response.output_text);
}

async function parseWithGemini(rawText) {
  if (!process.env.GEMINI_API_KEY) {
    throw new ProviderError('GEMINI_API_KEY is not configured.', 400, 'GEMINI_MISSING_KEY');
  }

  try {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });
    const response = await model.generateContent(`${LISTING_PROMPT}\n\n${rawText}`);
    return parseJsonFromModelText(response.response.text());
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      throw new ProviderError(
        'Gemini quota exceeded (429). Add billing for Gemini or configure OPENAI_API_KEY to enable fallback.',
        429,
        'GEMINI_QUOTA_EXCEEDED'
      );
    }
    throw error;
  }
}

async function parseWithOpenRouter(rawText) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new ProviderError('OPENROUTER_API_KEY is not configured.', 400, 'OPENROUTER_MISSING_KEY');
  }

  const modelCandidates = [OPENROUTER_MODEL, ...OPENROUTER_MODEL_FALLBACKS].filter(
    (model, index, list) => list.indexOf(model) === index
  );
  let lastRateLimitDetails = '';
  let lastModelError = '';

  for (const modelCandidate of modelCandidates) {
    for (let attempt = 0; attempt <= OPENROUTER_MAX_RETRIES; attempt += 1) {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'Dealio App'
        },
        body: JSON.stringify({
          model: modelCandidate,
          messages: [
            { role: 'system', content: LISTING_PROMPT },
            { role: 'user', content: rawText }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        const text = Array.isArray(content)
          ? content.map((item) => (typeof item === 'string' ? item : item?.text || '')).join('\n')
          : content;

        if (!text) {
          throw new ProviderError('OpenRouter returned an empty response.', 502, 'OPENROUTER_EMPTY_RESPONSE');
        }

        const parsed = parseJsonFromModelText(text);
        return attachMeta(parsed, { openrouterModel: modelCandidate });
      }

      let details = '';
      try {
        const errorBody = await response.json();
        details = errorBody?.error?.message ? ` ${errorBody.error.message}` : '';
      } catch {
        try {
          const rawBody = await response.text();
          details = rawBody ? ` ${rawBody}` : '';
        } catch {
          details = '';
        }
      }

      if (response.status === 429) {
        lastRateLimitDetails = details;
        if (attempt < OPENROUTER_MAX_RETRIES) {
          const waitMs = getRetryDelayMs(response.headers.get('retry-after'), attempt);
          await delay(waitMs);
          continue;
        }
        // Move to next candidate model when current one keeps getting rate-limited.
        continue;
      }

      if (isOpenRouterModelSelectionError(response.status, details)) {
        lastModelError = details;
        // Try next candidate model when this one is invalid/unavailable.
        break;
      }

      throw new ProviderError(`OpenRouter request failed (${response.status}).${details}`, response.status, 'OPENROUTER_REQUEST_FAILED');
    }
  }

  if (lastModelError) {
    throw new ProviderError(
      `OpenRouter model selection failed (400).${lastModelError} Check OPENROUTER_MODEL and OPENROUTER_MODEL_FALLBACKS.`,
      400,
      'OPENROUTER_MODEL_INVALID'
    );
  }

  throw new ProviderError(
    `OpenRouter rate limit exceeded (429) across configured models.${lastRateLimitDetails}`,
    429,
    'OPENROUTER_RATE_LIMIT'
  );
}

async function parseWithOpenClaw(rawText) {
  if (!process.env.OPENCLAW_API_URL || !process.env.OPENCLAW_API_KEY) {
    throw new ProviderError('OpenClaw is not configured.', 400, 'OPENCLAW_MISSING_CONFIG');
  }

  const response = await fetch(process.env.OPENCLAW_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENCLAW_API_KEY}`
    },
    body: JSON.stringify({ prompt: LISTING_PROMPT, input: rawText })
  });
  if (!response.ok) throw new ProviderError('OpenClaw request failed.', response.status, 'OPENCLAW_REQUEST_FAILED');
  return response.json();
}

async function parseWithSingleProvider(provider, rawText) {
  if (provider === 'chatgpt') return parseWithChatGPT(rawText);
  if (provider === 'gemini') return parseWithGemini(rawText);
  if (provider === 'openrouter') return parseWithOpenRouter(rawText);
  if (provider === 'openclaw') return parseWithOpenClaw(rawText);
  throw new ProviderError('Unsupported provider.', 400, 'UNSUPPORTED_PROVIDER');
}

export async function parseListingWithProvider({ provider, rawText }) {
  try {
    return await parseWithSingleProvider(provider, rawText);
  } catch (error) {
    const fallbackProviders = [];
    if (error?.code === 'GEMINI_QUOTA_EXCEEDED') fallbackProviders.push('chatgpt', 'openrouter');
    if (error?.code === 'OPENROUTER_RATE_LIMIT') fallbackProviders.push('chatgpt', 'gemini');
    for (const fallbackProvider of fallbackProviders) {
      if (fallbackProvider === provider) continue;
      try {
        const data = await parseWithSingleProvider(fallbackProvider, rawText);
        return attachMeta(data, { fallbackUsed: true, provider: fallbackProvider });
      } catch {
        continue;
      }
    }
    throw error;
  }
}
