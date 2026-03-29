function asText(value) {
  return value == null ? '' : String(value).trim();
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toBoolean(value, fallback = true) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'active'].includes(normalized);
}

function toDateIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseDealSizeRange(value) {
  const text = asText(value);
  if (!text) return { min: null, max: null };
  const numbers = text.match(/[\d,.]+/g)?.map((part) => Number(part.replace(/,/g, ''))).filter(Number.isFinite) || [];
  if (!numbers.length) return { min: null, max: null };
  if (numbers.length === 1) return { min: numbers[0], max: null };
  return { min: numbers[0], max: numbers[1] };
}

export function normalizeEmail(value) {
  return asText(value).toLowerCase();
}

export function normalizePhone(value) {
  return asText(value).replace(/[^\d+]/g, '');
}

export function mapBuyerRowToDb(row) {
  const firstName = asText(row.first_name || row.raw_first_name || row['First Name']);
  const lastName = asText(row.last_name || row.raw_last_name || row['Last Name']);
  const fullName = asText(row.full_name || row.raw_full_name || row['Full Name']) || `${firstName} ${lastName}`.trim();
  const email = asText(row.email || row.raw_email || row.Email);
  const phone = asText(row.phone || row.raw_phone || row.Phone);

  const parsedDealRange = parseDealSizeRange(row.raw_deal_size || row.deal_size || '');

  return {
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    email: email || null,
    normalized_email: normalizeEmail(email) || null,
    phone: phone || null,
    normalized_phone: normalizePhone(phone) || null,
    company: asText(row.company || row.raw_company || row.Company) || null,
    city: asText(row.city || row.raw_city || row.City) || null,
    state_province: asText(row.state_province || row.raw_state || row.State) || null,
    country: asText(row.country || row.raw_country || row.Country) || null,
    geo_normalized: asText(row.geo_normalized) || null,
    buyer_type: asText(row.buyer_type || row['Buyer Type']) || null,
    strategic_or_financial: asText(row.strategic_or_financial || row['Strategic Or Financial']) || null,
    industry_interest_raw: asText(row.industry_interest_raw || row.raw_industry_interest) || null,
    normalized_industries: asText(row.normalized_industries) || null,
    acquisition_criteria_raw: asText(row.acquisition_criteria_raw || row.raw_acquisition_criteria) || null,
    normalized_keywords: asText(row.normalized_keywords) || null,
    geographic_focus_raw: asText(row.geographic_focus_raw || row.raw_geographic_focus) || null,
    normalized_geographies: asText(row.normalized_geographies) || null,
    deal_size_min: toNumber(row.deal_size_min) ?? parsedDealRange.min,
    deal_size_max: toNumber(row.deal_size_max) ?? parsedDealRange.max,
    revenue_min: toNumber(row.revenue_min),
    revenue_max: toNumber(row.revenue_max),
    ebitda_min: toNumber(row.ebitda_min),
    ebitda_max: toNumber(row.ebitda_max),
    capital_available: toNumber(row.capital_available || row.raw_capital_available),
    last_contact_date: toDateIso(row.last_contact_date || row.raw_last_contact_date),
    tags: asText(row.tags || row.raw_tags) || null,
    notes: asText(row.notes || row.raw_notes) || null,
    is_active: toBoolean(row.is_active, true)
  };
}

export function mapListingRowToDb(row) {
  return {
    listing_title: asText(row.listing_title || row['Listing Title']) || asText(row.company_name || row['Company Name']) || 'Untitled Listing',
    company_name: asText(row.company_name || row['Company Name']) || null,
    source_site: asText(row.source_site || row['Source Site']) || 'import',
    source_url: asText(row.source_url || row['Source URL']) || null,
    source_listing_key: asText(row.source_listing_key || row['Source Listing Key']) || null,
    industry: asText(row.industry || row['Industry']) || null,
    sub_industry: asText(row.sub_industry || row['Sub Industry']) || null,
    industry_normalized: asText(row.industry_normalized) || null,
    keywords_normalized: asText(row.keywords_normalized) || null,
    city: asText(row.city || row['City']) || null,
    state_province: asText(row.state_province || row['State']) || null,
    country: asText(row.country || row['Country']) || null,
    geo_normalized: asText(row.geo_normalized) || null,
    asking_price: toNumber(row.asking_price || row['Asking Price']),
    revenue: toNumber(row.revenue || row['Revenue']),
    ebitda: toNumber(row.ebitda || row['EBITDA']),
    sde_cash_flow: toNumber(row.sde_cash_flow || row['SDE Cash Flow']),
    employees: toNumber(row.employees || row['Employees']),
    established_year: toNumber(row.established_year || row['Established Year']),
    inventory_included: asText(row.inventory_included) || '',
    real_estate_included: asText(row.real_estate_included) || '',
    reason_for_sale: asText(row.reason_for_sale) || '',
    summary: asText(row.summary) || '',
    listing_status: asText(row.listing_status) || 'active',
    is_active: toBoolean(row.is_active, true)
  };
}
