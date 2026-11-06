const EMPTY_PREFERENCES = Object.freeze({
  city: null,
  listingType: null,
  unitType: null,
  bedrooms: null,
  budgetMin: null,
  budgetMax: null,
  pets: null,
});

function toNullableNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePreferences(raw = {}) {
  return {
    city: raw.city ? String(raw.city).trim() : null,
    listingType: raw.listingType === 'rent' || raw.listingType === 'sale' ? raw.listingType : null,
    unitType: raw.unitType ? String(raw.unitType).trim() : null,
    bedrooms: toNullableNumber(raw.bedrooms),
    budgetMin: toNullableNumber(raw.budgetMin),
    budgetMax: toNullableNumber(raw.budgetMax),
    pets: typeof raw.pets === 'boolean' ? raw.pets : null,
  };
}

function hasAnyPreference(prefs = {}) {
  const value = normalizePreferences(prefs);
  return Object.values(value).some((entry) => entry != null);
}

function normalizePlaceName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractCityFromMessage(message, cities = []) {
  const text = normalizePlaceName(message);
  if (!text || !cities.length) return null;

  const sortedCities = [...cities]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const city of sortedCities) {
    const needle = normalizePlaceName(city);
    if (!needle) continue;
    if (text.includes(needle)) return city;

    const shortName = needle.replace(/\s+city$/, '');
    if (
      shortName.length >= 4
      && (
        text.includes(` in ${shortName}`)
        || text.includes(` within ${shortName}`)
        || text.includes(`preferably ${shortName}`)
        || text.includes(`preferably within ${shortName}`)
        || text.includes(`${shortName} only`)
      )
    ) {
      return city;
    }
  }

  return null;
}

function parseBudgetAmount(rawNumber, rawScale = '') {
  const amount = Number(String(rawNumber || '').replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const scale = String(rawScale || '').toLowerCase();
  if (scale.startsWith('m') || scale === 'million' || scale === 'millions') {
    return amount * 1_000_000;
  }
  if (scale.startsWith('k') || scale === 'thousand' || scale === 'thousands') {
    return amount * 1_000;
  }
  return amount;
}

function detectPreferenceSwitch(message) {
  const text = String(message || '');
  return /\b(actually|instead|switch(?:ing)?(?:\s+to)?|change(?:\s+to)?|rather|never\s*mind|forget\s+that|new\s+search)\b/i.test(text)
    || /\b(not\s+in|no\s+longer|different\s+city|another\s+city)\b/i.test(text);
}

function extractPreferencesFromMessage(message, { cities = [], previous = {} } = {}) {
  const text = String(message || '');
  const next = normalizePreferences(previous);
  const hardSwitch = detectPreferenceSwitch(text);
  let changed = false;

  if (hardSwitch) {
    // Keep nothing conflicting when client clearly changes direction;
    // extracted values below will refill what they specify now.
    Object.assign(next, EMPTY_PREFERENCES);
    changed = true;
  }

  const city = extractCityFromMessage(text, cities);
  if (city && city !== next.city) {
    next.city = city;
    changed = true;
  }

  if (/\b(for\s+rent|to\s+rent|rental|monthly\s+rent)\b/i.test(text)) {
    if (next.listingType !== 'rent') {
      next.listingType = 'rent';
      changed = true;
    }
  } else if (/\b(for\s+sale|to\s+buy|buying|purchase|sale\s+price)\b/i.test(text)) {
    if (next.listingType !== 'sale') {
      next.listingType = 'sale';
      changed = true;
    }
  }

  if (/\bstudio\b/i.test(text)) {
    if (next.unitType !== 'Studio') {
      next.unitType = 'Studio';
      next.bedrooms = 0;
      changed = true;
    }
  } else {
    const bedroomMatch = text.match(/\b(\d+)\s*[- ]?(?:br|bed(?:room)?s?)\b/i);
    if (bedroomMatch) {
      const bedrooms = Number(bedroomMatch[1]);
      if (Number.isFinite(bedrooms) && next.bedrooms !== bedrooms) {
        next.bedrooms = bedrooms;
        next.unitType = bedrooms === 0 ? 'Studio' : `${bedrooms} BR`;
        changed = true;
      }
    }
  }

  const underMatch = text.match(
    /\b(?:under|below|max(?:imum)?|up\s+to|budget(?:\s+of)?)\s*(?:₱|php|p)?\s*([\d,.]+)\s*(k|m|thousand|million|millions)?\b/i,
  );
  if (underMatch) {
    const budgetMax = parseBudgetAmount(underMatch[1], underMatch[2]);
    if (budgetMax != null && next.budgetMax !== budgetMax) {
      next.budgetMax = budgetMax;
      changed = true;
    }
  }

  const aroundMatch = text.match(
    /\b(?:around|about|near)\s*(?:₱|php|p)?\s*([\d,.]+)\s*(k|m|thousand|million|millions)?\b/i,
  );
  if (aroundMatch && next.budgetMax == null) {
    const mid = parseBudgetAmount(aroundMatch[1], aroundMatch[2]);
    if (mid != null) {
      next.budgetMin = Math.round(mid * 0.85);
      next.budgetMax = Math.round(mid * 1.15);
      changed = true;
    }
  }

  if (/\b(pet[- ]?friendly|allow(?:s)?\s+pets?|with\s+pets?)\b/i.test(text)) {
    if (next.pets !== true) {
      next.pets = true;
      changed = true;
    }
  } else if (/\b(no\s+pets?|without\s+pets?)\b/i.test(text)) {
    if (next.pets !== false) {
      next.pets = false;
      changed = true;
    }
  }

  return {
    preferences: next,
    changed,
    hardSwitch,
  };
}

function formatMoneyPref(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString('en-PH');
}

function formatPreferencesBlock(preferences = {}) {
  const prefs = normalizePreferences(preferences);
  if (!hasAnyPreference(prefs)) return '';

  const lines = [];
  if (prefs.city) lines.push(`- Preferred city: ${prefs.city}`);
  if (prefs.listingType) lines.push(`- Listing type: ${prefs.listingType}`);
  if (prefs.unitType) lines.push(`- Unit type: ${prefs.unitType}`);
  if (prefs.bedrooms != null) lines.push(`- Bedrooms: ${prefs.bedrooms}`);
  if (prefs.budgetMin != null || prefs.budgetMax != null) {
    const min = prefs.budgetMin != null ? `₱${formatMoneyPref(prefs.budgetMin)}` : null;
    const max = prefs.budgetMax != null ? `₱${formatMoneyPref(prefs.budgetMax)}` : null;
    if (min && max) lines.push(`- Budget range: ${min} to ${max}`);
    else if (max) lines.push(`- Budget max: ${max}`);
    else lines.push(`- Budget min: ${min}`);
  }
  if (prefs.pets === true) lines.push('- Pets: required / preferred');
  if (prefs.pets === false) lines.push('- Pets: not wanted');

  return `Known client preferences for this conversation (reuse unless the client clearly changes them):
${lines.join('\n')}
- Do not re-ask for preferences already listed above.
- If the client switches city/type/budget, update your understanding from their latest message.

`;
}

function buildConversationSummary({ preferences = {}, focus = {}, recentMessages = [] } = {}) {
  const prefs = normalizePreferences(preferences);
  const parts = [];

  if (prefs.city) parts.push(`City: ${prefs.city}`);
  if (prefs.listingType) parts.push(`Listing: ${prefs.listingType}`);
  if (prefs.unitType) parts.push(`Type: ${prefs.unitType}`);
  if (prefs.bedrooms != null) parts.push(`Bedrooms: ${prefs.bedrooms}`);
  if (prefs.budgetMax != null) parts.push(`Budget max: ₱${formatMoneyPref(prefs.budgetMax)}`);
  if (prefs.pets === true) parts.push('Pets: yes');
  if (prefs.pets === false) parts.push('Pets: no');
  if (focus.unitRef) parts.push(`Unit focus: ${focus.unitRef}`);
  if (focus.buildingRef) parts.push(`Building focus: ${focus.buildingRef}`);
  if (focus.projectSlug) parts.push(`Project: ${focus.projectSlug}`);

  const lastUser = [...recentMessages]
    .reverse()
    .find((message) => message.role === 'user' && String(message.content || '').trim());
  if (lastUser) {
    const snippet = String(lastUser.content).replace(/\s+/g, ' ').trim().slice(0, 180);
    parts.push(`Last question: ${snippet}`);
  }

  return parts.join(' | ').slice(0, 1000);
}

module.exports = {
  EMPTY_PREFERENCES,
  normalizePreferences,
  hasAnyPreference,
  extractCityFromMessage,
  extractPreferencesFromMessage,
  detectPreferenceSwitch,
  formatPreferencesBlock,
  buildConversationSummary,
};
