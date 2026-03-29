'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractListingsFromParsed(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.listings)) return payload.listings;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

function normalizeParsedListing(parsed) {
  return {
    listing_title: parsed.listing_title || parsed.company_name || 'Untitled Listing',
    company_name: parsed.company_name || null,
    source_site: parsed.source_site || 'manual',
    source_url: parsed.source_url || null,
    source_listing_key: parsed.source_listing_key || null,
    industry: parsed.industry || null,
    sub_industry: parsed.sub_industry || null,
    industry_normalized: parsed.industry_normalized || parsed.industry || null,
    keywords_normalized: parsed.keywords_normalized || null,
    city: parsed.city || null,
    state_province: parsed.state_province || null,
    country: parsed.country || null,
    geo_normalized: parsed.geo_normalized || [parsed.city, parsed.state_province, parsed.country].filter(Boolean).join(', ') || null,
    asking_price: toNumberOrNull(parsed.asking_price),
    revenue: toNumberOrNull(parsed.revenue),
    ebitda: toNumberOrNull(parsed.ebitda),
    sde_cash_flow: toNumberOrNull(parsed.sde_cash_flow),
    employees: toNumberOrNull(parsed.employees),
    established_year: toNumberOrNull(parsed.established_year),
    inventory_included: parsed.inventory_included || '',
    real_estate_included: parsed.real_estate_included || '',
    reason_for_sale: parsed.reason_for_sale || '',
    summary: parsed.summary || '',
    listing_status: 'active',
    is_active: true
  };
}

export default function ListingParserForm() {
  const router = useRouter();
  const [provider, setProvider] = useState('openrouter');
  const [rawText, setRawText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setResult('');

    const parseAndSavePromise = (async () => {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, rawText })
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed.error || 'Failed to parse listing.');

      const listings = extractListingsFromParsed(parsed)
        .filter((item) => item && typeof item === 'object')
        .map(normalizeParsedListing)
        .filter((item) => item.listing_title);

      if (!listings.length) {
        throw new Error('Parser returned no listing records.');
      }

      const saveResponse = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listings)
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error || 'Parsed listing could not be saved.');

      router.refresh();
      setRawText('');
      setResult(JSON.stringify({ parsed_count: listings.length, parsed, saved }, null, 2));
      return { count: saved?.count || listings.length };
    })();

    toast.promise(parseAndSavePromise, {
      loading: 'Parsing and saving listings...',
      success: (data) => `Saved ${data.count} listing(s).`,
      error: (error) => error.message || 'Parse/save failed.'
    });

    try {
      await parseAndSavePromise;
    } catch (error) {
      setResult(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="heading">
        <div>
          <h3>AI listing parser</h3>
          {/* <div className="muted">Use ChatGPT, Gemini, OpenRouter, or OpenClaw-compatible endpoints.</div> */}
        </div>
      </div>
      {/* <select disabled className="select" value={provider} onChange={(e) => setProvider(e.target.value)}>
        <option value="openrouter">OpenRouter</option>
        <option value="chatgpt">ChatGPT</option>
        <option value="gemini">Gemini</option>
        <option value="openclaw">OpenClaw</option>
      </select> */}
      <textarea className="textarea" placeholder="Paste raw listing text here..." value={rawText} onChange={(e) => setRawText(e.target.value)} />
      <button className="button" type="submit" disabled={loading || !rawText.trim()}>
        {loading ? 'Parsing + Saving...' : 'Parse and save listing'}
      </button>
      {result ? <pre className="panel" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{result}</pre> : null}
    </form>
  );
}
