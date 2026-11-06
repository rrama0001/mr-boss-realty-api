const { getPublicPropertyUrl, getPublicUnitUrl, getUnitRef } = require('./aiUnitFocus');
const { getBuildingRef, getPublicBuildingUrl } = require('./aiBuildingFocus');
const { appendDeveloperAiContext, formatDeveloperAiLines } = require('./aiDeveloperContext');
const { getPublicProjectDisplayName } = require('./projectPublicDisplay');
const { formatMapLinksForAi } = require('./mapLinks');

const BLOCKED_MEDIA_HOST =
    /(?:^|\.)((?:chatgpt|chat\.openai|openai)\.com|oaiusercontent\.com|files\.oaiusercontent\.com|ngrok\.com)$/i;

const PLACEHOLDER_MEDIA = /^(x+|xxx+|yyyy+|aaaa+|test|n\/a|none|todo|tbd)$/i;

function isShareableMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;

    const trimmed = url.trim();
    if (!trimmed || PLACEHOLDER_MEDIA.test(trimmed)) return false;
    if (!/^https?:\/\//i.test(trimmed)) return false;

    try {
        const { hostname, protocol } = new URL(trimmed);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !BLOCKED_MEDIA_HOST.test(hostname.replace(/^www\./, ''));
    } catch {
        return false;
    }
}

function formatMediaLinks({ imagesVideosLink, assets = [], coverImageUrl = null }) {
    const links = [];
    const { normalizeStoredUploadUrl } = require('./uploadUrls');

    for (const candidate of [coverImageUrl, imagesVideosLink]) {
        if (isShareableMediaUrl(candidate)) {
            const normalized = normalizeStoredUploadUrl(candidate.trim());
            if (!links.includes(normalized)) links.push(normalized);
        }
    }

    for (const asset of assets) {
        for (const field of ['image_link', 'video_link', 'document_link']) {
            const value = asset?.[field];
            if (isShareableMediaUrl(value) && !links.includes(normalizeStoredUploadUrl(value.trim()))) {
                links.push(normalizeStoredUploadUrl(value.trim()));
            }
        }
    }

    return links;
}

function formatMoney(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString();
}

function formatDateValue(value) {
    if (!value) return null;
    try {
        return new Date(value).toISOString().slice(0, 10);
    } catch {
        return String(value);
    }
}

function pushField(parts, label, value, { money = false, date = false } = {}) {
    if (value == null || value === '') return;
    let formatted = value;
    if (money) formatted = formatMoney(value);
    if (date) formatted = formatDateValue(value);
    if (formatted == null || formatted === '') return;
    parts.push(`${label}: ${formatted}`);
}

function formatDeliverables(deliverables = []) {
    return (deliverables || [])
        .filter((item) => item && (item.item || item.name))
        .map((item) => {
            const label = item.item || item.name || 'Deliverable';
            const type = item.item_type || item.description || '';
            return type ? `${label} (${type})` : label;
        });
}

function formatBuildingInventoryFields(building, { indent = '          ' } = {}) {
    const lines = [];
    const add = (label, value, opts) => {
        const parts = [];
        pushField(parts, label, value, opts);
        if (parts.length) lines.push(`${indent}${parts[0]}`);
    };

    add('Building Type', building.building_type);
    add('Status', building.status);
    add('Listing Type', building.listing_type);
    add('Number of Units', building.number_of_units);
    add('Total Available Units', building.total_available_units);
    add('Bedrooms', building.bedrooms);
    add('Bathrooms', building.bathrooms);
    add('Number of Floors / Stories', building.stories);
    add('Total Floor Area', building.total_floor_area);
    add('Typical Room Area', building.typical_room_area);
    add('Lot Area', building.lot_area);
    add('Sale Price', building.sale_price, { money: true });
    add('Monthly Rent', building.monthly_rent, { money: true });
    add('Daily Rent', building.daily_rent, { money: true });
    add('Hourly Rent', building.hourly_rent, { money: true });
    add('Payment Terms', building.payment_terms);
    add('Payment Terms Link', building.payment_terms_link);
    add('Reservation Fee', building.reservation_fee, { money: true });
    add('Reservation Deductible', building.is_reservation_deductible);
    add('Monthly Dues', building.monthly_dues, { money: true });
    add('Monthly Dues Per Sqm', building.monthly_dues_per_sqm, { money: true });
    add('Total Parking', building.total_parking);
    add('Total Available Parking', building.total_available_parking);
    add('LTS Completion Date', building.lts_completion_date, { date: true });
    add('CTS Completion Date', building.cts_completion_date, { date: true });
    add('Pets Allowed', building.is_pet_allowed);
    add('Allowed Pet Size', building.allowed_pet_size);
    add('Smoking Allowed', building.is_allowed_smoking);
    add('Freebies', building.freebies);

    const deliverables = formatDeliverables(building.deliverables);
    if (deliverables.length) {
        lines.push(`${indent}Deliverables: ${deliverables.join('; ')}`);
    }

    return lines;
}

function formatUnitInventoryInline(unit) {
    const parts = [];
    const add = (label, value, opts) => pushField(parts, label, value, opts);

    add('Room Number', unit.room_number);
    add('Floor', unit.floor);
    add('Unit Type', unit.unit_type);
    add('Area', unit.unit_size);
    add('Bedrooms', unit.bedrooms);
    add('Bathrooms', unit.bathrooms);
    add('Listing Type', unit.listing_type || 'sale');
    add('Sale Price', unit.unit_price, { money: true });
    add('Monthly Rent', unit.monthly_rent, { money: true });
    add('Daily Rent', unit.daily_rent, { money: true });
    add('Hourly Rent', unit.hourly_rent, { money: true });
    add('Payment Terms', unit.payment_terms);
    add('Payment Terms Link', unit.payment_terms_link);
    add('Reservation Fee', unit.reservation_fee, { money: true });
    add('Reservation Deductible', unit.is_reservation_deductible);
    add('Monthly Dues', unit.monthly_dues, { money: true });
    add('Monthly Dues Per Sqm', unit.monthly_dues_per_sqm, { money: true });
    add('Pets Allowed', unit.is_pet_allowed);
    add('Allowed Pet Size', unit.allowed_pet_size);
    add('Smoking Allowed', unit.is_allowed_smoking);
    add('Unit Notes', unit.ai_notes);

    const deliverables = formatDeliverables(unit.deliverables);
    if (deliverables.length) {
        parts.push(`Deliverables: ${deliverables.join('; ')}`);
    }

    if (
        unit.unit_price == null
        && unit.monthly_rent == null
        && unit.daily_rent == null
        && unit.hourly_rent == null
    ) {
        parts.push('Price: No price');
    }

    return parts.join(', ');
}

function appendWholeBuildingListing(dataText, project, building) {
    const buildingRef = getBuildingRef(building);
    const listingPage = getPublicBuildingUrl(project, buildingRef);
    const publicName = getPublicProjectDisplayName(project);

    dataText += `     - ${building.building_name || 'Whole Property'} (whole-property listing)\n`;
    dataText += `          Internal Listing Ref (never mention to client): ${buildingRef}\n`;
    if (listingPage) dataText += `          Listing Page: ${listingPage}\n`;
    dataText += `          Property: ${publicName}\n`;
    dataText += `${formatBuildingInventoryFields(building).join('\n')}\n`;

    const buildingMedia = formatMediaLinks({
        imagesVideosLink: building.images_videos_link,
        assets: building.assets || [],
    });
    if (buildingMedia.length) {
        dataText += `          Listing media URLs: ${buildingMedia.join(' | ')}\n`;
    }

    return dataText;
}

function buildMediaIndex(projects) {
    const entries = [];

    for (const project of projects) {
        const publicName = getPublicProjectDisplayName(project);
        const projectMedia = formatMediaLinks({
            imagesVideosLink: project.images_videos_link,
            assets: project.assets || [],
        });

        for (const url of projectMedia) {
            entries.push(`${publicName} (project): ${url}`);
        }

        for (const building of project.buildings || []) {
            if (building.is_whole_property_listing) {
                const buildingRef = getBuildingRef(building);
                const buildingMedia = formatMediaLinks({
                    imagesVideosLink: building.images_videos_link,
                    assets: building.assets || [],
                });

                for (const url of buildingMedia) {
                    entries.push(
                        `${publicName} / ${building.building_name || 'Whole Property'} / Listing Ref ${buildingRef}: ${url}`,
                    );
                }
            }

            for (const unit of building.units || []) {
                const unitMedia = formatMediaLinks({
                    imagesVideosLink: unit.images_videos_link,
                    assets: unit.assets || [],
                });

                for (const url of unitMedia) {
                    const unitRef = getUnitRef(unit);
                    entries.push(
                        `${publicName} / ${building.building_name || 'Building'} / ${unit.unit_type} / Room ${unit.room_number} / Unit Ref ${unitRef}: ${url}`,
                    );
                }
            }
        }
    }

    if (!entries.length) {
        return 'Shareable unit/project media index:\n(none)\n';
    }

    return `Shareable unit/project media index:\n${entries.map((entry) => `- ${entry}`).join('\n')}\n`;
}

function isStudioUnitType(unitType) {
    return /\bstudio\b/i.test(String(unitType || ''));
}

function collectComparableUnits(projects) {
    const entries = [];

    for (const project of projects || []) {
        const publicName = getPublicProjectDisplayName(project);
        const isPrivate = Boolean(project.is_private_on_website);
        const buildings = (project.buildings || []).filter((building) => !building.deleted_at);

        for (const building of buildings) {
            if (building.is_whole_property_listing) continue;

            const units = (building.units || []).filter((unit) => !unit.deleted_at);
            for (const unit of units) {
                entries.push({
                    projectName: publicName,
                    buildingName: building.building_name || 'Building',
                    unitType: unit.unit_type || 'Unit',
                    roomNumber: unit.room_number || null,
                    listingType: String(unit.listing_type || 'sale').toLowerCase(),
                    salePrice: Number(unit.unit_price),
                    monthlyRent: Number(unit.monthly_rent),
                    bedrooms: unit.bedrooms == null ? null : Number(unit.bedrooms),
                    petsAllowed: unit.is_pet_allowed === true,
                    unitRef: getUnitRef(unit),
                    unitPage: getPublicUnitUrl(project, getUnitRef(unit)),
                    isStudio: isStudioUnitType(unit.unit_type),
                    city: String(project.city || '').trim(),
                    developer: isPrivate ? null : String(project.developer || '').trim() || null,
                    address: String(project.location || '').trim() || null,
                });
            }
        }
    }

    return entries;
}

function formatRankedUnitLine(entry, priceLabel, priceValue) {
    const room = entry.roomNumber ? `Room ${entry.roomNumber}` : 'Room n/a';
    const city = entry.city ? ` | City: ${entry.city}` : '';
    const developer = entry.developer ? ` | Developer: ${entry.developer}` : '';
    const address = entry.address ? ` | Address: ${entry.address}` : '';
    const page = entry.unitPage ? ` | Unit Page: ${entry.unitPage}` : '';
    return `- ${entry.unitType} | ${room} | ${entry.buildingName} | ${entry.projectName}${city}${developer}${address} | ${priceLabel}: ${formatMoney(priceValue)} | Unit Ref (internal): ${entry.unitRef}${page}`;
}

function unitMatchesBedrooms(entry, bedrooms) {
    if (bedrooms == null || !Number.isFinite(Number(bedrooms))) return true;
    const target = Number(bedrooms);

    if (target === 0) {
        // Number(null) === 0 in JS — only treat explicit 0 / studio as studio.
        return entry.isStudio === true || entry.bedrooms === 0;
    }

    // Studio unit types are never 1BR/2BR even if bedrooms is mis-tagged in DB.
    if (entry.isStudio) return false;

    if (entry.bedrooms != null && entry.bedrooms !== '' && Number.isFinite(Number(entry.bedrooms))) {
        return Number(entry.bedrooms) === target;
    }

    const unitType = String(entry.unitType || '');
    if (new RegExp(`\\b${target}\\s*[- ]?br\\b`, 'i').test(unitType)) return true;
    if (new RegExp(`\\b${target}\\s*bed(?:room)?s?\\b`, 'i').test(unitType)) return true;
    return false;
}

function unitMatchesUnitTypeName(entry, unitTypeName) {
    if (!unitTypeName) return true;
    const needle = normalizePlaceName(unitTypeName);
    const haystack = normalizePlaceName(entry.unitType);
    if (!needle || !haystack) return false;
    return haystack === needle || haystack.includes(needle) || needle.includes(haystack);
}

function inferBedroomCount(entry) {
    if (entry.isStudio || entry.bedrooms === 0) return 0;
    if (entry.bedrooms != null && Number.isFinite(Number(entry.bedrooms))) {
        return Number(entry.bedrooms);
    }
    const match = String(entry.unitType || '').match(/\b(\d+)\s*[- ]?(?:br|bed(?:room)?s?)\b/i);
    if (match) return Number(match[1]);
    return null;
}

function collectDistinctBedroomCounts(units) {
    return [...new Set(
        (units || [])
            .map((entry) => inferBedroomCount(entry))
            .filter((value) => value != null && Number.isFinite(value)),
    )].sort((a, b) => a - b);
}

function collectDistinctUnitTypes(units) {
    return [...new Set(
        (units || [])
            .map((entry) => String(entry.unitType || '').trim())
            .filter(Boolean),
    )].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function extractBedroomFilter(message, preferences = {}) {
    const text = String(message || '');
    const prefs = preferences || {};

    if (/\bstudio\b/i.test(text)) {
        return { wantStudio: true, bedrooms: 0 };
    }

    const bedroomMatch = text.match(/\b(\d+)\s*[- ]?(?:br|bed(?:room)?s?)\b/i);
    if (bedroomMatch) {
        const bedrooms = Number(bedroomMatch[1]);
        if (Number.isFinite(bedrooms)) {
            return {
                wantStudio: bedrooms === 0,
                bedrooms,
            };
        }
    }

    if (/studio/i.test(String(prefs.unitType || '')) || Number(prefs.bedrooms) === 0) {
        return { wantStudio: true, bedrooms: 0 };
    }

    if (prefs.bedrooms != null && Number.isFinite(Number(prefs.bedrooms))) {
        const bedrooms = Number(prefs.bedrooms);
        return {
            wantStudio: bedrooms === 0,
            bedrooms,
        };
    }

    return { wantStudio: false, bedrooms: null };
}

function extractUnitTypeNameFilter(message, unitTypes = [], preferences = {}) {
    const text = normalizePlaceName(message);
    if (!text) {
        return preferences.unitType ? String(preferences.unitType).trim() : null;
    }

    // Bedroom/studio wording is handled separately — don't also pin a conflicting type name.
    if (/\bstudio\b/.test(text) || /\b\d+\s*(?:br|bed(?:room)?s?)\b/.test(text)) {
        return null;
    }

    const sortedTypes = [...unitTypes]
        .filter(Boolean)
        .sort((a, b) => normalizePlaceName(b).length - normalizePlaceName(a).length);

    // Prefer an exact/full unit-type phrase when the client names it.
    for (const unitType of sortedTypes) {
        const needle = normalizePlaceName(unitType);
        if (needle.length < 3) continue;
        if (text.includes(needle)) return unitType;
    }

    // Otherwise match a distinctive family token (soho, suite, penthouse, loft, etc.)
    // so "most expensive SOHO" includes all SOHO variants.
    const skipTokens = new Set([
        'bedroom', 'bedrooms', 'studio', 'unit', 'type', 'room', 'with', 'from',
    ]);
    const inventoryTokens = new Set();
    for (const unitType of sortedTypes) {
        for (const token of normalizePlaceName(unitType).split(' ')) {
            if (token.length >= 4 && !skipTokens.has(token) && !/^\d+$/.test(token)) {
                inventoryTokens.add(token);
            }
        }
    }

    const matchedToken = [...inventoryTokens]
        .filter((token) => text.includes(token))
        .sort((a, b) => b.length - a.length)[0];
    if (matchedToken) return matchedToken;

    if (preferences.unitType) {
        return String(preferences.unitType).trim();
    }

    return null;
}

function extractUnitFilter(message, units = [], preferences = {}) {
    const bedroomFilter = extractBedroomFilter(message, preferences);
    if (bedroomFilter.wantStudio || bedroomFilter.bedrooms != null) {
        return {
            ...bedroomFilter,
            unitTypeName: null,
        };
    }

    const unitTypeName = extractUnitTypeNameFilter(
        message,
        collectDistinctUnitTypes(units),
        preferences,
    );

    return {
        wantStudio: false,
        bedrooms: null,
        unitTypeName,
    };
}

function unitMatchesFilter(entry, filter = {}) {
    if (filter.wantStudio || filter.bedrooms != null) {
        return unitMatchesBedrooms(entry, filter.wantStudio ? 0 : filter.bedrooms);
    }
    if (filter.unitTypeName) {
        return unitMatchesUnitTypeName(entry, filter.unitTypeName);
    }
    return true;
}

function rankedSaleByFilter(units, filter) {
    return units
        .filter((entry) => (
            entry.listingType === 'sale'
            && Number.isFinite(entry.salePrice)
            && entry.salePrice > 0
            && unitMatchesFilter(entry, filter)
        ))
        .sort((a, b) => b.salePrice - a.salePrice);
}

function rankedRentByFilter(units, filter) {
    return units
        .filter((entry) => (
            entry.listingType === 'rent'
            && Number.isFinite(entry.monthlyRent)
            && entry.monthlyRent > 0
            && unitMatchesFilter(entry, filter)
        ))
        .sort((a, b) => b.monthlyRent - a.monthlyRent);
}

function bedroomLabel(bedrooms) {
    if (bedrooms === 0) return 'Studio';
    return `${bedrooms} BR`;
}

function filterLabel(filter = {}) {
    if (filter.wantStudio || filter.bedrooms === 0) return 'Studio';
    if (filter.bedrooms != null) return bedroomLabel(filter.bedrooms);
    if (filter.unitTypeName) return filter.unitTypeName;
    return 'All types';
}

function appendRankedSection(lines, title, entries, priceLabel, priceValueFn) {
    lines.push(title);
    if (!entries.length) {
        lines.push('- (none)');
        return;
    }
    lines.push(
        ...entries.map((entry) => formatRankedUnitLine(entry, priceLabel, priceValueFn(entry))),
    );
}

function buildPriceComparisonIndex(projects, { limit = 6 } = {}) {
    // Keep this compact — ranking questions use Ground-truth blocks.
    // A huge index crowds out normal property details in the model context.
    const units = collectComparableUnits(projects);
    const bedroomCounts = collectDistinctBedroomCounts(units);

    const saleUnits = units
        .filter((entry) => entry.listingType === 'sale' && Number.isFinite(entry.salePrice) && entry.salePrice > 0)
        .sort((a, b) => b.salePrice - a.salePrice)
        .slice(0, limit);

    const rentUnits = units
        .filter((entry) => entry.listingType === 'rent' && Number.isFinite(entry.monthlyRent) && entry.monthlyRent > 0)
        .sort((a, b) => b.monthlyRent - a.monthlyRent)
        .slice(0, limit);

    const lines = [
        'Price comparison index (compact backup — Ground-truth inventory answer wins when present):',
    ];

    appendRankedSection(
        lines,
        'All sale units by Sale Price (highest first):',
        saleUnits,
        'Sale Price',
        (entry) => entry.salePrice,
    );
    appendRankedSection(
        lines,
        'All rent units by Monthly Rent (highest first):',
        rentUnits,
        'Monthly Rent',
        (entry) => entry.monthlyRent,
    );

    for (const bedrooms of bedroomCounts) {
        const filter = { wantStudio: bedrooms === 0, bedrooms, unitTypeName: null };
        const label = filterLabel(filter);
        appendRankedSection(
            lines,
            `${label} sale top prices:`,
            rankedSaleByFilter(units, filter).slice(0, 3),
            'Sale Price',
            (entry) => entry.salePrice,
        );
    }

    lines.push(
        'Notes: For ranking questions, prefer Ground-truth. Match ANY unit type/bedroom count from the latest question. Never substitute another city or type.',
    );

    return `${lines.join('\n')}\n`;
}

function isInventoryComparisonQuestion(message, projectsOrUnits = null) {
    const text = String(message || '').trim();
    if (!text) return false;

    const hasRankWord = /\b(most|least|highest|lowest|cheapest|priciest|expensive)\b/i.test(text);
    if (!hasRankWord) return false;

    if (/\b(price|priced|expensive|cheap|cost|studio|unit|bedroom|br|rent|sale|type|loft|suite|penthouse|soho|condo|apartment|townhouse|house)\b/i.test(text)) {
        return true;
    }

    const units = Array.isArray(projectsOrUnits) && projectsOrUnits[0]?.buildings
        ? collectComparableUnits(projectsOrUnits)
        : (Array.isArray(projectsOrUnits) ? projectsOrUnits : []);
    const unitTypes = collectDistinctUnitTypes(units);
    return Boolean(extractUnitTypeNameFilter(text, unitTypes, {}));
}

/**
 * Broad inventory / discovery questions should search the full snapshot,
 * not get trapped by an earlier unit/building focus.
 */
function shouldIgnoreListingFocus(message, projects = []) {
    const text = String(message || '').trim();
    if (!text) return false;

    if (isInventoryComparisonQuestion(text, projects)) return true;

    if (/\b(this|that)\s+(unit|listing|property|building|room)\b/i.test(text)) {
        return false;
    }

    return (
        /\b(available|do you have|what (?:units|properties|listings)|which (?:units|properties|listings)|show me|list (?:units|properties|listings)|across (?:units|properties|listings|inventory)|inventory|pet[- ]?friendly)\b/i.test(text)
        || /\b(?:units?|properties|listings|condos?|apartments?)\s+(?:in|within|around)\s+/i.test(text)
        || /\b(?:in|within|around)\s+(?:cebu|pasay|makati|taguig|manila|quezon|bgc|ortigas)\b/i.test(text)
    );
}

function normalizePlaceName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function extractCityFilter(message, cities = []) {
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
                || text.includes(`${shortName} only`)
                || text.includes(`preferably ${shortName}`)
                || text.includes(`preferably within ${shortName}`)
            )
        ) {
            return city;
        }
    }

    return null;
}

function resolveInventoryComparisonGroundTruth(projects, message, preferences = {}) {
    const units = collectComparableUnits(projects);
    if (!isInventoryComparisonQuestion(message, units)) return null;

    const text = String(message || '');
    const prefs = preferences || {};
    const cities = [...new Set(units.map((entry) => entry.city).filter(Boolean))];
    const cityFilter = extractCityFilter(text, cities) || prefs.city || null;
    const unitFilter = extractUnitFilter(text, units, prefs);
    const wantStudio = unitFilter.wantStudio;
    const bedrooms = unitFilter.bedrooms;
    const unitTypeName = unitFilter.unitTypeName;
    let wantRent = /\brent\b/i.test(text) && !/\b(for sale|sale price|to buy|buying)\b/i.test(text);
    if (prefs.listingType === 'rent' && !/\b(for sale|sale price|to buy|buying)\b/i.test(text)) {
        wantRent = true;
    }
    if (prefs.listingType === 'sale' && !/\brent\b/i.test(text)) {
        wantRent = false;
    }
    const wantLowest = /\b(least|lowest|cheapest)\b/i.test(text);
    const wantPets = prefs.pets === true
        || (/\bpets?\b/i.test(text) && /\b(friendly|allow|allowed)\b/i.test(text));

    let candidates = [...units];
    if (cityFilter) {
        candidates = candidates.filter(
            (entry) => normalizePlaceName(entry.city) === normalizePlaceName(cityFilter),
        );
    }
    candidates = candidates.filter((entry) => unitMatchesFilter(entry, unitFilter));
    if (wantPets) {
        candidates = candidates.filter((entry) => entry.petsAllowed);
    }

    let priceLabel = 'Sale Price';
    if (wantRent) {
        priceLabel = 'Monthly Rent';
        candidates = candidates.filter(
            (entry) => entry.listingType === 'rent' && Number.isFinite(entry.monthlyRent) && entry.monthlyRent > 0,
        );
        if (prefs.budgetMax != null) {
            candidates = candidates.filter((entry) => entry.monthlyRent <= Number(prefs.budgetMax));
        }
        candidates.sort((a, b) => (
            wantLowest ? a.monthlyRent - b.monthlyRent : b.monthlyRent - a.monthlyRent
        ));
    } else {
        candidates = candidates.filter(
            (entry) => entry.listingType === 'sale' && Number.isFinite(entry.salePrice) && entry.salePrice > 0,
        );
        if (prefs.budgetMax != null) {
            candidates = candidates.filter((entry) => entry.salePrice <= Number(prefs.budgetMax));
        }
        candidates.sort((a, b) => (
            wantLowest ? a.salePrice - b.salePrice : b.salePrice - a.salePrice
        ));
    }

    const winner = candidates[0] || null;
    if (!winner) {
        return {
            found: false,
            cityFilter,
            wantStudio,
            bedrooms,
            unitTypeName,
            wantRent,
            wantLowest,
            wantPets,
        };
    }

    return {
        found: true,
        cityFilter,
        wantStudio,
        bedrooms,
        unitTypeName,
        wantRent,
        wantLowest,
        wantPets,
        priceLabel,
        priceValue: wantRent ? winner.monthlyRent : winner.salePrice,
        entry: winner,
    };
}

function formatComparisonGroundTruth(truth) {
    if (!truth) return '';

    const typeScope = truth.wantStudio || truth.bedrooms === 0
        ? 'studio'
        : (truth.bedrooms != null
            ? bedroomLabel(truth.bedrooms)
            : (truth.unitTypeName || null));

    if (!truth.found) {
        const scope = [
            typeScope,
            truth.wantRent ? 'rent' : 'sale',
            truth.wantPets ? 'pet-friendly' : null,
            truth.cityFilter ? `in ${truth.cityFilter}` : null,
        ].filter(Boolean).join(' ');

        return `Ground-truth inventory answer (authoritative):
No matching ${scope || 'unit'} was found in the current inventory.
Tell the client clearly that nothing matches those filters. Do not substitute a unit from another city or type.

`;
    }

    const { entry, priceLabel, priceValue, cityFilter } = truth;
    const room = entry.roomNumber ? `Room ${entry.roomNumber}` : 'Room n/a';
    const filters = [
        cityFilter ? `city = ${cityFilter}` : 'all cities',
        typeScope ? `${typeScope} units only` : null,
        truth.wantPets ? 'pet-friendly only' : null,
        truth.wantLowest ? 'lowest price' : 'highest price',
    ].filter(Boolean).join(', ');

    return `Ground-truth inventory answer (authoritative — use these exact facts; do not pick a different unit):
- Filter applied: ${filters}
- Unit type: ${entry.unitType}
- Room: ${room}
- Building: ${entry.buildingName}
- Project / Property: ${entry.projectName}
- City: ${entry.city || 'n/a'}
- Developer: ${entry.developer || 'n/a'}
- Address: ${entry.address || 'n/a'}
- Pets allowed: ${entry.petsAllowed ? 'yes' : 'no'}
- ${priceLabel}: ${formatMoney(priceValue)}
- Unit Page: ${entry.unitPage || 'n/a'}
Present this in natural language for the client. Include project, city, developer, address (if available), building, room, unit type, exact price, and the Unit Page as a markdown link. Never mention Unit Ref.

`;
}

function buildPropertySnapshot(projects) {
    let dataText = 'Mr. Boss Realty Property Database Snapshot:\n\n';

    for (const project of projects) {
        const publicName = getPublicProjectDisplayName(project);
        const isPrivate = Boolean(project.is_private_on_website);

        dataText += `Project or Property: ${publicName}\n`;
        if (project.slug) {
            dataText += `   Property Slug: ${project.slug}\n`;
            dataText += `   Property Page: ${getPublicPropertyUrl(project)}\n`;
        }
        if (isPrivate) {
            dataText += '   Privacy: Private property — never mention the owner name or private contact details to clients.\n';
        }
        if (!isPrivate && project.developer) {
            dataText += `   Developer: ${project.developer}\n`;
        }
        dataText = appendDeveloperAiContext(project, dataText);
        if (project.city) dataText += `   City: ${project.city}\n`;
        if (project.location) dataText += `   Address: ${project.location}\n`;
        for (const mapLine of formatMapLinksForAi(project)) {
            dataText += `   ${mapLine}\n`;
        }
        if (project.description && !isPrivate) {
            dataText += `   Description: ${project.description}\n`;
        } else if (project.description && isPrivate) {
            dataText += '   Description: (public teaser only — do not quote the full private description)\n';
        }
        if (project.status) dataText += `   Status: ${project.status}\n`;
        if (project.amenities) dataText += `   Amenities: ${project.amenities}\n`;
        if (!isPrivate && project.loan_type) dataText += `   Loan Type: ${project.loan_type}\n`;
        if (!isPrivate && project.reservation_requirements) {
            dataText += `   Reservation Requirements: ${project.reservation_requirements}\n`;
        }
        if (project.showroom_location) dataText += `   Showroom Location: ${project.showroom_location}\n`;

        const projectMedia = formatMediaLinks({
            imagesVideosLink: project.images_videos_link,
            coverImageUrl: project.cover_image_url,
            assets: project.assets || [],
        });
        if (projectMedia.length) {
            dataText += `   Project media URLs: ${projectMedia.slice(0, 3).join(' | ')}\n`;
        }

        const activeBuildings = (project.buildings || []).filter((building) => !building.deleted_at);
        if (activeBuildings.length) {
            dataText += '   Buildings:\n';
            for (const building of activeBuildings) {
                if (building.is_whole_property_listing) {
                    dataText = appendWholeBuildingListing(dataText, project, building);
                    continue;
                }

                dataText += `     - ${building.building_name || 'Building'}\n`;
                const buildingFields = formatBuildingInventoryFields(building);
                if (buildingFields.length) {
                    dataText += `${buildingFields.join('\n')}\n`;
                }

                const activeUnits = (building.units || []).filter((unit) => !unit.deleted_at);
                dataText += '          Available Units:\n';
                if (activeUnits.length) {
                    for (const unit of activeUnits) {
                        const unitRef = getUnitRef(unit);
                        const unitPage = getPublicUnitUrl(project, unitRef);
                        dataText += `             • ${unit.unit_type || 'Unit'}`;
                        dataText += ` | Unit Ref (internal, never mention to client): ${unitRef}`;
                        if (unitPage) dataText += ` | Unit Page: ${unitPage}`;
                        dataText += ` | Property: ${publicName}`;
                        dataText += ` | Building: ${building.building_name || 'N/A'}`;
                        dataText += ` | ${formatUnitInventoryInline(unit)}`;

                        const unitMedia = formatMediaLinks({
                            imagesVideosLink: unit.images_videos_link,
                            coverImageUrl: unit.cover_image_url,
                            assets: unit.assets || [],
                        });
                        if (unitMedia.length) {
                            dataText += ` | Unit media URLs: ${unitMedia.join(' | ')}`;
                        } else {
                            dataText += ' | Unit media URLs: none available';
                        }

                        dataText += '\n';
                    }
                } else {
                    dataText += '             • (no active units)\n';
                }
            }
        }

        const projectDeliverables = formatDeliverables(
            (project.deliverables || []).filter((item) => !item.building_id && !item.unit_id),
        );
        if (projectDeliverables.length) {
            dataText += '   Project Deliverables:\n';
            for (const item of projectDeliverables) {
                dataText += `     • ${item}\n`;
            }
        }

        dataText += '\n';
    }

    dataText += `\n${buildPriceComparisonIndex(projects)}`;
    dataText += `\n${buildMediaIndex(projects)}`;

    return dataText;
}

function buildSystemContent(aiPrompt, dataText, focusSummaries = {}) {
    const {
        buildingSummary = '',
        unitSummary = '',
        companyContact = null,
        comparisonGroundTruth = '',
        preferencesBlock = '',
    } = focusSummaries;

    const buildingFocusBlock = buildingSummary
        ? `Active whole-property listing focus (use for follow-ups about THIS listing only — not for broad inventory/ranking questions):
${buildingSummary}

`
        : '';

    const unitFocusBlock = unitSummary
        ? `Active unit focus (use for follow-ups about THIS unit only — not for broad inventory/ranking questions):
${unitSummary}

`
        : '';

    const companyPhone = String(companyContact?.phone || '').trim();
    const companyEmail = String(companyContact?.email || '').trim();
    const companyContactBlock = (companyPhone || companyEmail)
        ? `Company contact info (Mr. Boss Realty public contact — share when inviting the client to reach you):
${companyPhone ? `- Phone: ${companyPhone}` : ''}
${companyEmail ? `- Email: ${companyEmail}` : ''}

`
        : '';

    const comparisonGroundTruthBlock = comparisonGroundTruth
        ? `${comparisonGroundTruth}`
        : '';

    const clientPreferencesBlock = preferencesBlock || '';

    return `${aiPrompt}

${buildingFocusBlock}${unitFocusBlock}${clientPreferencesBlock}${comparisonGroundTruthBlock}${companyContactBlock}You have access to the following database information:
${dataText}
Whole-property listing rules:
- Each whole-property listing has an internal 8-character Listing Ref and a Listing Page URL (example: /properties/{slug}/{ref}). The Listing Ref is for internal matching only.
- NEVER mention the Listing Ref, hashed listing code, or internal building ID in replies to the client.
- When the user shares a /properties/{slug}/{ref} URL or asks about a whole-property listing, treat that listing as their focus for follow-up questions.
- Answer bedroom, bathroom, price, size, and availability questions from the building listing fields in the active focus block or snapshot — not from project descriptions.
Unit reference rules:
- Each unit has an internal 8-character Unit Ref (example: 54c14d49) and a Unit Page URL in the snapshot. The Unit Ref is for internal matching only.
- NEVER mention the Unit Ref, hashed unit code, or internal unit ID in replies to the client.
- When talking to the client, refer to the unit naturally: unit type, room number, building name, and property name (example: "the 2 BR Suite, Room 201 in Tower B at City Clou").
- When the user says they are interested in a unit, mentions a Unit Ref, says "unit" followed by an 8-character code, or shares a /properties/... or /units/... URL, treat that unit as their unit of interest for the rest of the conversation.
- When acknowledging unit interest, speak directly to the client: "You are interested in [unit label]..." — never say "You've mentioned your interest in", "You mentioned your interest in", "I see you're interested in", or similar meta phrasing.
- When acknowledging unit interest only, stop after confirming the unit. Do not ask for contact details unless the client explicitly asks to be contacted, requests a callback, or asks for a site visit.
- When confirming that the team will reach out, arrange a visit, or follow up after the client shares their name/contact, also invite them to call or email Mr. Boss Realty (use Company contact info phone/email when available). Example: "Someone from our team will reach out shortly. You may also call us or send us an email."
- Answer follow-up questions from ANY unit/property fields present in the active focus or snapshot (price, rent, size, floor, room number, payment terms, reservation, dues, pets, smoking, freebies, deliverables, completion dates, parking, amenities, media, maps, and more) unless the client clearly switches listing.
- Pet policy is per unit (and per whole-property listing). When asked which units allow pets / are pet-friendly, use Pets Allowed and Allowed Pet Size from the snapshot. Do not invent a building-wide pet policy unless every unit shares the same value.
- If the user asks about "this unit" or "that unit" and an active unit focus exists, use the active unit focus.
- When sharing a unit link, use the exact Unit Page URL from the snapshot with friendly link text (example: [view unit details](url)). Do not put the Unit Ref in the link label or reply text.
Media rules:
- When the user asks for unit photos, images, videos, PDFs, or documents, use the "Shareable unit/project media index" first.
- Match project, building, room, and unit type before sharing media.
- If no matching URL exists in the index, say that media is not available yet for that unit.
- For image URLs, include markdown image syntax on its own line:
  ![Studio room 201](https://example.com/photo.jpg)
- For PDFs, videos, and other files, include the exact URL on its own line.
- Never use ChatGPT, OpenAI, oaiusercontent, ngrok, or placeholder links.
Inventory answering rules:
- Be as helpful as the old Facebook Page assistant: answer ANY property question using the FULL database snapshot whenever the client is asking broadly (availability, rankings, cities, locations, amenities, prices, unit types, maps, media, payment terms, etc.).
- Active unit/building focus is ONLY for follow-ups about that same listing ("this unit", "that building", "its rent"). Never let focus block or narrow a broad inventory answer.
- You may answer with any fields present in the snapshot: price, rent, unit type, bedrooms, bathrooms, size, floor, room number, city, address/location, developer, amenities, parking, pets, smoking, freebies, payment terms, reservation, dues, completion dates, maps, media, and listing links. Be complete and specific.
- If a requested detail is missing from the snapshot, say it is not available yet — never invent values.
- For most/least expensive, cheapest, highest/lowest priced, or similar ranking questions: if a Ground-truth inventory answer is present, use it exactly. Otherwise use the Price comparison index. Do NOT answer ranking questions from Active unit focus alone.
- Support ANY unit type in inventory: studio, 1BR/2BR/3BR+, SOHO, Suite, Penthouse, loft, named types, etc. Treat "SOHO - Studio" / types containing "Studio" as studio (0 bedrooms). Treat "1BR", "1 BR", and "1 bedroom" as the same 1-bedroom filter; same pattern for every bedroom count.
- When the client names a bedroom count or unit type in a ranking question, filter to that exact type before choosing the winner. Do not substitute a different bedroom count or unit type.
- If the client specifies a city (examples: "Cebu City only", "in Cebu", "preferably within Cebu City"), filter to that city. Never return a unit from another city.
- Reuse Known client preferences across turns. If they switch city/type/budget ("actually", "instead", "switch to"), follow the latest message and stop using old conflicting preferences.
- When giving ranking or unit answers, always include: unit type, bedrooms (if known), room number, building, project/property name, city, developer (if available), address/location (if available), exact Sale Price or rent, and the Unit Page link.
- When asked for location, address, Google Earth / Maps / map location, share the exact address and Google Earth / Google Maps URLs from the snapshot (or active focus). Prefer markdown links with friendly text (example: [Open in Google Earth](url)).
- Never reveal private owner/landlord identity or private owner contact numbers/emails. Use Mr. Boss Realty company contact instead when outreach is needed.
- For private properties, keep using the public display name ("Private Property") and never expose owner identity.
- Do NOT tell the client that OTP or privacy verification is required — the website handles that separately after a question limit.
Developer context rules:
- When Developer Website or Developer Notes appear in the snapshot or active focus block, treat them as internal notes that help the AI answer questions about that property.
- Developer Notes may include sample computations, payment illustrations, or external links — use them when relevant. Present sample math as illustrative unless the notes clearly state it is official.
- You may share the Developer Website URL when helpful; use markdown link syntax with friendly text (example: [developer website](url)).
- Do NOT claim you browsed or live-scraped the developer website — only use Developer Notes and offer the URL for the client to visit.
Chat usage rules:
- The public website chat may require OTP after a configured number of free questions. Do not implement or announce that limit yourself.
- Facebook Messenger chats do not use this OTP question limit.
- Treat verified contacts as real leads and continue helping normally after verification.`;
}

module.exports = {
    isShareableMediaUrl,
    buildPropertySnapshot,
    buildSystemContent,
    buildPriceComparisonIndex,
    isInventoryComparisonQuestion,
    shouldIgnoreListingFocus,
    extractBedroomFilter,
    extractUnitFilter,
    unitMatchesBedrooms,
    unitMatchesFilter,
    resolveInventoryComparisonGroundTruth,
    formatComparisonGroundTruth,
    formatDeveloperAiLines,
};
