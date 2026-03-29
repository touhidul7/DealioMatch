const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export async function fetchGhlContacts({ limit = 100, locationId } = {}) {
  const apiKey = process.env.GHL_API_KEY;
  const finalLocationId = locationId || process.env.GHL_LOCATION_ID;

  if (!apiKey || !finalLocationId) {
    throw new Error('Missing GHL API key or location ID.');
  }

  const response = await fetch(`${GHL_BASE_URL}/contacts/?locationId=${finalLocationId}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28',
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL sync failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  return json.contacts || [];
}

export function mapGhlContactToBuyer(contact) {
  const customFields = Array.isArray(contact.customFields) ? contact.customFields : [];
  const getField = (name) => customFields.find((item) => (item.key || item.name || '').toLowerCase().includes(name.toLowerCase()))?.value || '';

  return {
    ghl_contact_id: contact.id,
    first_name: contact.firstName || '',
    last_name: contact.lastName || '',
    full_name: [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim(),
    email: contact.email || '',
    normalized_email: normalizeEmail(contact.email || ''),
    phone: contact.phone || '',
    normalized_phone: normalizePhone(contact.phone || ''),
    company: contact.companyName || '',
    city: contact.address1 || contact.city || '',
    state_province: contact.state || '',
    country: contact.country || '',
    geo_normalized: [contact.city, contact.state, contact.country].filter(Boolean).join(', '),
    industry_interest_raw: getField('industry'),
    acquisition_criteria_raw: getField('acquisition') || getField('criteria'),
    geographic_focus_raw: getField('geographic') || getField('geo'),
    deal_size_min: parseMoney(getField('deal size min')),
    deal_size_max: parseMoney(getField('deal size max')),
    revenue_min: parseMoney(getField('revenue min')),
    revenue_max: parseMoney(getField('revenue max')),
    ebitda_min: parseMoney(getField('ebitda min')),
    ebitda_max: parseMoney(getField('ebitda max')),
    capital_available: parseMoney(getField('capital')),
    last_contact_date: contact.dateUpdated || new Date().toISOString(),
    tags: (contact.tags || []).join(', '),
    notes: contact.notes || '',
    source_subaccount_id: contact.locationId || process.env.GHL_LOCATION_ID,
    is_active: true
  };
}

export function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

export function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

export function parseMoney(value = '') {
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  return cleaned ? Number(cleaned) : null;
}
