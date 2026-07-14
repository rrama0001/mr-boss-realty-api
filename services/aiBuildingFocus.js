const { buildBuildingRef, isBuildingHashRef } = require('./buildingSlug');
const { parseLegacyUnitRef } = require('./unitSlug');
const { getPublicProjectDisplayName } = require('./projectPublicDisplay');
const { formatDeveloperAiLines } = require('./aiDeveloperContext');
const { buildListingDetailPath, projectMatchesUrlSegments } = require('./projectPublicUrl');

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.mrbossrealty.com').replace(/\/$/, '');

const PROPERTY_LISTING_URL_PATTERN = /\/properties\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-f0-9]{8}|\d+)/gi;
const LEGACY_PROPERTY_LISTING_URL_PATTERN = /\/properties\/([a-z0-9-]+)\/([a-f0-9]{8}|\d+)/gi;

function getPublicBuildingUrl(project, buildingRef) {
  if (!project || !buildingRef) return null;
  return `${PUBLIC_SITE_URL}${buildListingDetailPath(project, buildingRef)}`;
}

function getBuildingRef(building) {
  return building.slug || buildBuildingRef(building.id);
}

function flattenWholeBuildingsFromProjects(projects) {
  const entries = [];

  for (const project of projects) {
    for (const building of project.buildings || []) {
      if (!building.is_whole_property_listing) continue;
      entries.push({ project, building });
    }
  }

  return entries;
}

function findBuildingEntry(projects, ref, projectSlug = null, citySlug = null) {
  const value = String(ref || '').trim().toLowerCase();
  if (!value) return null;

  const slug = projectSlug ? String(projectSlug).trim().toLowerCase() : null;
  const city = citySlug ? String(citySlug).trim().toLowerCase() : null;
  const legacyId = parseLegacyUnitRef(value);

  for (const entry of flattenWholeBuildingsFromProjects(projects)) {
    const { project, building } = entry;

    if (city || slug) {
      if (!projectMatchesUrlSegments(project, city || '', slug || '')) {
        if (!slug || String(project.slug || '').toLowerCase() !== slug) {
          continue;
        }
      }
    }

    const buildingRef = getBuildingRef(building).toLowerCase();

    if (buildingRef === value) {
      return entry;
    }

    if (legacyId != null && building.id === legacyId) {
      return entry;
    }
  }

  return null;
}

function extractPropertyListingRefsFromMessage(message) {
  const text = String(message || '');
  const refs = [];

  for (const match of text.matchAll(PROPERTY_LISTING_URL_PATTERN)) {
    refs.push({
      citySlug: match[1].toLowerCase(),
      projectSlug: match[2].toLowerCase(),
      listingRef: match[3].toLowerCase(),
    });
  }

  for (const match of text.matchAll(LEGACY_PROPERTY_LISTING_URL_PATTERN)) {
    refs.push({
      citySlug: null,
      projectSlug: match[1].toLowerCase(),
      listingRef: match[2].toLowerCase(),
    });
  }

  return refs;
}

function buildBuildingDisplayLabel(entry) {
  const { project, building } = entry;
  const parts = [building.building_name || 'Whole Property'];

  parts.push(getPublicProjectDisplayName(project));

  return parts.join(' · ');
}

function collectPrivateRedactionTerms(project = {}) {
  const terms = new Set();

  for (const value of [
    project.project_name,
    project.contact_person,
    project.contact_person_email,
  ]) {
    const trimmed = String(value || '').trim();
    if (trimmed) terms.add(trimmed);
  }

  return [...terms];
}

function collectPrivateRedactionTermsFromProjects(projects) {
  const terms = new Set();

  for (const project of projects) {
    if (!project.is_private_on_website) continue;
    for (const term of collectPrivateRedactionTerms(project)) {
      terms.add(term);
    }
  }

  return [...terms];
}

function formatFocusedBuildingSummary(entry) {
  const { project, building } = entry;
  const buildingRef = getBuildingRef(building);
  const listingPage = getPublicBuildingUrl(project, buildingRef);
  const clientLabel = buildBuildingDisplayLabel(entry);
  const publicProjectName = getPublicProjectDisplayName(project);

  const lines = [
    `Client-facing label: ${clientLabel}`,
    `Internal Listing Ref (never mention to client): ${buildingRef}`,
    `Listing Page: ${listingPage || 'unavailable'}`,
    `Property: ${publicProjectName}`,
    `Property Slug: ${project.slug || 'n/a'}`,
    `Developer: ${project.developer || 'n/a'}`,
    ...formatDeveloperAiLines(project),
    `City: ${project.city || 'n/a'}`,
    `Building: ${building.building_name || 'n/a'}`,
    `Building Type: ${building.building_type || 'n/a'}`,
    `Building Status: ${building.status || 'n/a'}`,
    `Listing Type: ${building.listing_type || 'n/a'}`,
    `Bedrooms: ${building.bedrooms ?? 'n/a'}`,
    `Bathrooms: ${building.bathrooms ?? 'n/a'}`,
    `Number of Floors: ${building.stories ?? 'n/a'}`,
    `Number of Rooms: ${building.number_of_units ?? 'n/a'}`,
    `Total Floor Area: ${building.total_floor_area || 'n/a'}`,
    `Lot Area: ${building.lot_area || 'n/a'}`,
    `Typical Room Area: ${building.typical_room_area || 'n/a'}`,
    `Sale Price: ${building.sale_price != null ? building.sale_price.toLocaleString() : 'n/a'}`,
    `Monthly Rent: ${building.monthly_rent ?? 'n/a'}`,
    `Daily Rent: ${building.daily_rent ?? 'n/a'}`,
    `Hourly Rent: ${building.hourly_rent ?? 'n/a'}`,
    `Payment Terms: ${building.payment_terms || 'n/a'}`,
    `Payment Terms Link: ${building.payment_terms_link || 'n/a'}`,
    `Reservation Fee: ${building.reservation_fee ?? 'n/a'}`,
    `Reservation Deductible: ${building.is_reservation_deductible ?? 'n/a'}`,
    `Monthly Dues: ${building.monthly_dues ?? 'n/a'}`,
    `Monthly Dues Per Sqm: ${building.monthly_dues_per_sqm ?? 'n/a'}`,
    `Parking: ${building.total_parking ?? 'n/a'}`,
    `Available Parking: ${building.total_available_parking ?? 'n/a'}`,
    `Pets Allowed: ${building.is_pet_allowed ?? 'n/a'}`,
    `Allowed Pet Size: ${building.allowed_pet_size || 'n/a'}`,
    `Smoking Allowed: ${building.is_allowed_smoking ?? 'n/a'}`,
    `Freebies: ${building.freebies || 'n/a'}`,
  ];

  if (building.images_videos_link) {
    lines.push(`Images/Videos Link: ${building.images_videos_link}`);
  }

  lines.push(
    'Important: For bedroom, bathroom, floor, and area counts, use the building listing fields above — not the project description.',
  );

  if (project.is_private_on_website) {
    lines.push(
      'Privacy: This is a private property listing. Never mention the owner name or private contact details. Refer to the property only as "Private Property".',
    );
  }

  return lines.join('\n');
}

function resolveConversationBuildingFocus(projects, message, previousFocus = null) {
  const urlRefs = extractPropertyListingRefsFromMessage(message);

  for (let i = urlRefs.length - 1; i >= 0; i -= 1) {
    const { citySlug, projectSlug, listingRef } = urlRefs[i];
    const entry = findBuildingEntry(projects, listingRef, projectSlug, citySlug);
    if (entry) {
      const buildingRef = getBuildingRef(entry.building);
      return {
        buildingRef,
        displayLabel: buildBuildingDisplayLabel(entry),
        summary: formatFocusedBuildingSummary(entry),
        redactNames: entry.project.is_private_on_website
          ? collectPrivateRedactionTerms(entry.project)
          : [],
      };
    }
  }

  const hashPattern = /\b([a-f0-9]{8})\b/gi;
  const hashRefs = [...new Set([...String(message || '').matchAll(hashPattern)].map((m) => m[1].toLowerCase()))];

  for (let i = hashRefs.length - 1; i >= 0; i -= 1) {
    const ref = hashRefs[i];
    if (!isBuildingHashRef(ref)) continue;

    const entry = findBuildingEntry(projects, ref);
    if (entry) {
      const buildingRef = getBuildingRef(entry.building);
      return {
        buildingRef,
        displayLabel: buildBuildingDisplayLabel(entry),
        summary: formatFocusedBuildingSummary(entry),
        redactNames: entry.project.is_private_on_website
          ? collectPrivateRedactionTerms(entry.project)
          : [],
      };
    }
  }

  if (previousFocus?.buildingRef) {
    const entry = findBuildingEntry(projects, previousFocus.buildingRef);
    if (entry) {
      return {
        buildingRef: previousFocus.buildingRef,
        displayLabel: buildBuildingDisplayLabel(entry),
        summary: formatFocusedBuildingSummary(entry),
        redactNames: entry.project.is_private_on_website
          ? collectPrivateRedactionTerms(entry.project)
          : [],
      };
    }
  }

  return null;
}

module.exports = {
  buildBuildingDisplayLabel,
  collectPrivateRedactionTerms,
  collectPrivateRedactionTermsFromProjects,
  extractPropertyListingRefsFromMessage,
  findBuildingEntry,
  formatFocusedBuildingSummary,
  getBuildingRef,
  getPublicBuildingUrl,
  resolveConversationBuildingFocus,
};
