const DEFAULT_SETTINGS = {
  industry_weight: 0.35,
  geo_weight: 0.2,
  size_weight: 0.2,
  keyword_weight: 0.1,
  revenue_weight: 0.05,
  ebitda_weight: 0.05,
  freshness_weight: 0.05,
  min_match_threshold: 55,
  max_matches_per_listing: 50
};

const INDUSTRY_PARENT_MAP = {
  'home services': ['plumbing', 'hvac', 'electrical', 'roofing', 'painting'],
  healthcare: ['med spa', 'dental', 'physio', 'clinic', 'chiropractic'],
  legal: ['law firm', 'legal'],
  'financial services': ['cpa', 'accounting', 'bookkeeping', 'financial'],
  manufacturing: ['manufacturing', 'fabrication'],
  transportation: ['transport', 'trucking', 'fleet'],
  logistics: ['logistics', 'warehouse', 'distribution'],
  'e-commerce': ['e-commerce', 'ecommerce', 'shopify', 'amazon'],
  retail: ['retail', 'store', 'shop'],
  'saas / technology': ['saas', 'software', 'technology', 'it services'],
  hospitality: ['hospitality', 'restaurant', 'hotel', 'motel'],
  'food & beverage': ['food', 'beverage', 'cafe', 'bakery'],
  automotive: ['automotive', 'auto repair', 'collision'],
  construction: ['construction', 'contracting', 'builder'],
  'business services': ['b2b services', 'business services', 'agency'],
  education: ['education', 'training', 'tutoring'],
  'fitness / wellness': ['fitness', 'wellness', 'gym'],
  franchise: ['franchise', 'franchised'],
  agriculture: ['agriculture', 'farming']
};

const RELATED_PARENT_GROUPS = [
  ['home services', 'construction'],
  ['healthcare', 'fitness / wellness'],
  ['retail', 'e-commerce'],
  ['logistics', 'transportation'],
  ['hospitality', 'food & beverage']
];

const KEYWORD_NORMALIZATION_MAP = {
  recurring: 'recurring revenue',
  recurring_revenue: 'recurring revenue',
  owneroperator: 'owner operator',
  owner_operator: 'owner operator',
  absentee: 'absentee',
  homeservices: 'home services',
  healthcare: 'healthcare',
  manufacturing: 'manufacturing',
  franchise: 'franchise',
  tuckin: 'tuck-in',
  tuck_in: 'tuck-in',
  strategic: 'strategic acquisition',
  platform: 'platform',
  rollup: 'roll-up',
  roll_up: 'roll-up',
  b2b: 'b2b',
  b2c: 'b2c',
  ecommerce: 'e-commerce',
  e_commerce: 'e-commerce',
  servicebusiness: 'service business',
  service_business: 'service business',
  assetlight: 'asset-light',
  asset_light: 'asset-light',
  highmargin: 'high margin',
  high_margin: 'high margin',
  localbusiness: 'local business',
  local_business: 'local business',
  multilocation: 'multi-location',
  multi_location: 'multi-location',
  digitalbusiness: 'digital business',
  digital_business: 'digital business'
};

export function getDefaultMatchSettings() {
  return DEFAULT_SETTINGS;
}

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeTextArray(value = '') {
  return normalizeText(value)
    .split(/[,;|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeKeywordToken(token) {
  const raw = normalizeText(token).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return KEYWORD_NORMALIZATION_MAP[raw] || raw.replace(/_/g, ' ');
}

function normalizeKeywords(value = '') {
  const tokens = normalizeTextArray(value).map(normalizeKeywordToken);
  return [...new Set(tokens)];
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveParentIndustry(value) {
  const industry = normalizeText(value);
  if (!industry) return '';
  for (const [parent, aliases] of Object.entries(INDUSTRY_PARENT_MAP)) {
    if (industry === parent) return parent;
    if (aliases.some((alias) => industry.includes(alias))) return parent;
  }
  return '';
}

function areRelatedParentGroups(parentA, parentB) {
  if (!parentA || !parentB) return false;
  return RELATED_PARENT_GROUPS.some((group) => group.includes(parentA) && group.includes(parentB));
}

function calculateRangeScore(targetValue, minValue, maxValue, noPreferenceDefault = 50) {
  const target = toNumber(targetValue);
  const min = toNumber(minValue);
  const max = toNumber(maxValue);

  if (min == null && max == null) return noPreferenceDefault;
  if (target == null) return 0;
  if ((min == null || target >= min) && (max == null || target <= max)) return 100;

  const base = target < (min ?? target) ? min : max;
  if (base == null || base === 0) return 0;
  const deviation = Math.abs(target - base) / Math.abs(base);
  if (deviation <= 0.2) return 70;
  if (deviation <= 0.4) return 40;
  return 0;
}

export function calculateIndustryScore(listing, buyer) {
  const listingIndustry = normalizeText(listing.industry_normalized || listing.industry || '');
  const buyerIndustries = normalizeTextArray(buyer.normalized_industries || buyer.industry_interest_raw || '');
  if (!listingIndustry || !buyerIndustries.length) return 0;

  if (buyerIndustries.some((industry) => industry === listingIndustry || industry.includes(listingIndustry))) {
    return 100;
  }

  const listingParent = resolveParentIndustry(listingIndustry);
  const buyerParents = buyerIndustries.map(resolveParentIndustry).filter(Boolean);
  if (listingParent && buyerParents.includes(listingParent)) return 75;
  if (listingParent && buyerParents.some((parent) => areRelatedParentGroups(parent, listingParent))) return 50;
  return 0;
}

export function calculateGeoScore(listing, buyer) {
  const listingCity = normalizeText(listing.city);
  const listingState = normalizeText(listing.state_province);
  const listingCountry = normalizeText(listing.country);
  const buyerGeo = normalizeText(buyer.normalized_geographies || buyer.geographic_focus_raw || buyer.geo_normalized || '');

  if (!buyerGeo) return 0;
  if (buyerGeo.includes('anywhere') || buyerGeo.includes('national') || buyerGeo.includes('canada-wide') || buyerGeo.includes('open')) {
    return 70;
  }
  if (listingCity && buyerGeo.includes(listingCity)) return 100;
  if (listingState && buyerGeo.includes(listingState)) return 80;
  if (listingCountry && buyerGeo.includes(listingCountry)) return 60;
  return 0;
}

export function calculateSizeScore(listing, buyer) {
  return calculateRangeScore(listing.asking_price, buyer.deal_size_min, buyer.deal_size_max, 50);
}

export function calculateRevenueScore(listing, buyer) {
  return calculateRangeScore(listing.revenue, buyer.revenue_min, buyer.revenue_max, 50);
}

export function calculateEbitdaScore(listing, buyer) {
  return calculateRangeScore(listing.ebitda, buyer.ebitda_min, buyer.ebitda_max, 50);
}

export function calculateKeywordScore(listing, buyer) {
  const listingKeywords = normalizeKeywords(listing.keywords_normalized || listing.summary || '');
  const buyerKeywords = normalizeKeywords(buyer.normalized_keywords || buyer.acquisition_criteria_raw || '');
  if (!listingKeywords.length || !buyerKeywords.length) return 0;
  const overlap = listingKeywords.filter((token) => buyerKeywords.includes(token));
  if (overlap.length >= 2) return 100;
  if (overlap.length === 1) return 50;
  return 0;
}

export function calculateFreshnessScore(buyer) {
  if (!buyer.last_contact_date) return 10;
  const lastContact = new Date(buyer.last_contact_date);
  if (Number.isNaN(lastContact.getTime())) return 10;
  const days = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 90) return 100;
  if (days <= 180) return 70;
  if (days <= 365) return 40;
  return 10;
}

export function buildMatchExplanation(listing, scores) {
  const parts = [];
  if (scores.industryScore >= 75) {
    parts.push(`strong ${listing.industry || listing.industry_normalized || 'industry'} fit`);
  } else if (scores.industryScore >= 50) {
    parts.push(`related ${listing.industry || 'industry'} category fit`);
  }

  if (scores.geoScore >= 80) {
    parts.push('tight geography match');
  } else if (scores.geoScore >= 60) {
    parts.push('country or region geography fit');
  } else if (scores.geoScore >= 1) {
    parts.push('national or flexible geography');
  }

  if (scores.sizeScore === 100) {
    parts.push('deal size within preferred range');
  } else if (scores.sizeScore >= 40) {
    parts.push('deal size near preferred range');
  }

  if (scores.keywordScore >= 100) {
    parts.push('strong keyword overlap');
  } else if (scores.keywordScore >= 50) {
    parts.push('moderate keyword alignment');
  }

  if (!parts.length) return 'General fit based on weighted criteria.';
  return `${parts.join(', ')}.`;
}

function deriveMatchBucket(overallScore) {
  if (overallScore >= 85) return 'A Match';
  if (overallScore >= 70) return 'B Match';
  if (overallScore >= 55) return 'C Match';
  return 'Ignore';
}

function applyRankForBuyer(matches) {
  const byBuyer = new Map();
  matches.forEach((match) => {
    const rows = byBuyer.get(match.buyer_id) || [];
    rows.push(match);
    byBuyer.set(match.buyer_id, rows);
  });

  byBuyer.forEach((rows) => {
    rows.sort((a, b) => b.overall_score - a.overall_score);
    rows.forEach((row, index) => {
      row.rank_for_buyer = index + 1;
    });
  });
}

export function buildTop50ByListingRows(matches) {
  return matches.map((match) => ({
    listing_id: match.listing_id,
    listing_title: match.listing_title,
    buyer_rank: match.rank_for_listing,
    buyer_id: match.buyer_id,
    buyer_name: match.buyer_name,
    buyer_company: match.buyer_company,
    buyer_email: match.buyer_email,
    buyer_phone: match.buyer_phone,
    overall_score: match.overall_score,
    industry_score: match.industry_score,
    geo_score: match.geo_score,
    size_score: match.size_score,
    keyword_score: match.keyword_score,
    explanation: match.explanation,
    generated_at: match.match_date || new Date().toISOString()
  }));
}

export function computeMatches({ buyers, listings, settings = DEFAULT_SETTINGS, matchRunId = null, matchDate = null }) {
  const activeBuyers = (buyers || []).filter((buyer) => buyer.is_active);
  const activeListings = (listings || []).filter((listing) => listing.is_active);
  const timestamp = matchDate || new Date().toISOString();
  const results = [];

  activeListings.forEach((listing) => {
    const listingMatches = activeBuyers
      .map((buyer) => {
        const industryScore = calculateIndustryScore(listing, buyer);
        const geoScore = calculateGeoScore(listing, buyer);
        const sizeScore = calculateSizeScore(listing, buyer);
        const revenueScore = calculateRevenueScore(listing, buyer);
        const ebitdaScore = calculateEbitdaScore(listing, buyer);
        const keywordScore = calculateKeywordScore(listing, buyer);
        const freshnessScore = calculateFreshnessScore(buyer);

        const overallScore =
          industryScore * settings.industry_weight +
          geoScore * settings.geo_weight +
          sizeScore * settings.size_weight +
          keywordScore * settings.keyword_weight +
          revenueScore * settings.revenue_weight +
          ebitdaScore * settings.ebitda_weight +
          freshnessScore * settings.freshness_weight;

        return {
          match_run_id: matchRunId,
          match_date: timestamp,
          listing_id: listing.id,
          buyer_id: buyer.id,
          buyer_name: buyer.full_name,
          buyer_company: buyer.company,
          buyer_email: buyer.email,
          buyer_phone: buyer.phone,
          listing_title: listing.listing_title,
          overall_score: Math.round(overallScore),
          industry_score: industryScore,
          geo_score: geoScore,
          size_score: sizeScore,
          revenue_score: revenueScore,
          ebitda_score: ebitdaScore,
          keyword_score: keywordScore,
          freshness_score: freshnessScore,
          explanation: buildMatchExplanation(listing, { industryScore, geoScore, sizeScore, keywordScore })
        };
      })
      .filter((match) => match.overall_score >= settings.min_match_threshold)
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, settings.max_matches_per_listing)
      .map((match, index) => ({
        ...match,
        rank_for_listing: index + 1,
        match_bucket: deriveMatchBucket(match.overall_score)
      }));

    results.push(...listingMatches);
  });

  applyRankForBuyer(results);
  return results;
}
