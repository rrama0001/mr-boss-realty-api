const { buildUnitRef, isUnitHashRef, parseLegacyUnitRef } = require('./unitSlug');
const { findBuildingEntry, collectPrivateRedactionTerms } = require('./aiBuildingFocus');
const { getPublicProjectDisplayName } = require('./projectPublicDisplay');
const { formatDeveloperAiLines } = require('./aiDeveloperContext');
const { buildListingDetailPath, buildPropertyDetailPath } = require('./projectPublicUrl');

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.mrbossrealty.com').replace(/\/$/, '');

const UNIT_URL_PATTERN = /\/(?:units|properties)\/(?:[a-z0-9-]+\/){1,2}([a-f0-9]{8}|u-\d+|\d+)/gi;
const UNIT_PHRASE_PATTERN = /\bunit\s+([a-f0-9]{8}|u-\d+|\d+)\b/gi;

function getPublicPropertyUrl(project) {
  if (!project) return null;
  return `${PUBLIC_SITE_URL}${buildPropertyDetailPath(project)}`;
}

function getPublicUnitUrl(project, unitRef) {
  if (!project || !unitRef) return null;
  return `${PUBLIC_SITE_URL}${buildListingDetailPath(project, unitRef)}`;
}

function flattenUnitsFromProjects(projects) {
  const entries = [];

  for (const project of projects) {
    for (const building of project.buildings || []) {
      for (const unit of building.units || []) {
        entries.push({ project, building, unit });
      }
    }
  }

  return entries;
}

function getUnitRef(unit) {
  return unit.slug || buildUnitRef(unit.id);
}

function findUnitEntry(projects, ref) {
  const value = String(ref || '').trim().toLowerCase();
  if (!value) return null;

  const legacyId = parseLegacyUnitRef(value);

  for (const entry of flattenUnitsFromProjects(projects)) {
    const unitRef = getUnitRef(entry.unit).toLowerCase();

    if (unitRef === value) {
      return entry;
    }

    if (legacyId != null && entry.unit.id === legacyId) {
      return entry;
    }
  }

  return null;
}

function extractUnitRefsFromMessage(message) {
  const text = String(message || '');
  const refs = [];

  for (const match of text.matchAll(UNIT_URL_PATTERN)) {
    refs.push(match[1].toLowerCase());
  }

  for (const match of text.matchAll(UNIT_PHRASE_PATTERN)) {
    refs.push(match[1].toLowerCase());
  }

  for (const match of text.matchAll(/\b([a-f0-9]{8})\b/gi)) {
    refs.push(match[1].toLowerCase());
  }

  return [...new Set(refs)];
}

function buildUnitDisplayLabel(entry) {
  const { project, building, unit } = entry;
  const parts = [unit.unit_type, `Room ${unit.room_number}`];

  if (building.building_name) {
    parts.push(building.building_name);
  }

  parts.push(getPublicProjectDisplayName(project));

  return parts.join(' · ');
}

function formatFocusedUnitSummary(entry) {
  const { project, building, unit } = entry;
  const unitRef = getUnitRef(unit);
  const unitPage = getPublicUnitUrl(project, unitRef);
  const clientLabel = buildUnitDisplayLabel(entry);
  const publicProjectName = getPublicProjectDisplayName(project);
  const lines = [
    `Client-facing label: ${clientLabel}`,
    `Internal Unit Ref (never mention to client): ${unitRef}`,
    `Unit Page: ${unitPage || 'unavailable'}`,
    `Property: ${publicProjectName}`,
    `Property Slug: ${project.slug || 'n/a'}`,
    `Developer: ${project.developer || 'n/a'}`,
    ...formatDeveloperAiLines(project),
    `City: ${project.city || 'n/a'}`,
    `Building: ${building.building_name || 'n/a'}`,
    `Building Type: ${building.building_type || 'n/a'}`,
    `Building Status: ${building.status || 'n/a'}`,
    `Unit Type: ${unit.unit_type}`,
    `Room Number: ${unit.room_number}`,
    `Floor: ${unit.floor}`,
    `Bedrooms: ${unit.bedrooms ?? 'n/a'}`,
    `Bathrooms: ${unit.bathrooms ?? 'n/a'}`,
    `Area: ${unit.unit_size || 'n/a'}`,
    `Price: ${unit.unit_price != null ? unit.unit_price.toLocaleString() : 'No price'}`,
    `Payment Terms: ${unit.payment_terms || 'n/a'}`,
    `Payment Terms Link: ${unit.payment_terms_link || 'n/a'}`,
    `Reservation Fee: ${unit.reservation_fee ?? 'n/a'}`,
    `Reservation Deductible: ${unit.is_reservation_deductible ?? 'n/a'}`,
    `Monthly Dues: ${unit.monthly_dues ?? 'n/a'}`,
    `Monthly Dues Per Sqm: ${unit.monthly_dues_per_sqm ?? 'n/a'}`,
    `Pets Allowed: ${unit.is_pet_allowed ?? 'n/a'}`,
    `Smoking Allowed: ${unit.is_allowed_smoking ?? 'n/a'}`,
  ];

  if (unit.images_videos_link) {
    lines.push(`Images/Videos Link: ${unit.images_videos_link}`);
  }

  if (unit.ai_notes) {
    lines.push(`Unit Notes (use when relevant): ${unit.ai_notes}`);
  }

  if (project.is_private_on_website) {
    lines.push(
      'Privacy: This is a private property listing. Never mention the owner name or private contact details. Refer to the property only as "Private Property".',
    );
  }

  return lines.join('\n');
}

function resolveConversationUnitFocus(projects, message, previousFocus = null) {
  const refs = extractUnitRefsFromMessage(message);

  for (let i = refs.length - 1; i >= 0; i -= 1) {
    const ref = refs[i];
    if (!isUnitHashRef(ref) && parseLegacyUnitRef(ref) == null) {
      continue;
    }

    if (findBuildingEntry(projects, ref)) {
      continue;
    }

    const entry = findUnitEntry(projects, ref);
    if (entry) {
      const unitRef = getUnitRef(entry.unit);
      return {
        unitRef,
        displayLabel: buildUnitDisplayLabel(entry),
        summary: formatFocusedUnitSummary(entry),
        redactNames: entry.project.is_private_on_website
          ? collectPrivateRedactionTerms(entry.project)
          : [],
      };
    }
  }

  if (previousFocus?.unitRef) {
    const entry = findUnitEntry(projects, previousFocus.unitRef);
    if (entry) {
      return {
        unitRef: previousFocus.unitRef,
        displayLabel: buildUnitDisplayLabel(entry),
        summary: formatFocusedUnitSummary(entry),
        redactNames: entry.project.is_private_on_website
          ? collectPrivateRedactionTerms(entry.project)
          : [],
      };
    }
  }

  return null;
}

function normalizeInterestAcknowledgment(text) {
  let result = String(text || '');

  const replacements = [
    /\bYou(?:'ve| have)?\s+(?:mentioned|expressed|indicated)\s+your\s+interest\s+in\b/gi,
    /\bYou(?:'ve| have)?\s+(?:mentioned|expressed|indicated)\s+(?:that\s+)?you(?:'re| are)\s+interested\s+in\b/gi,
    /\bYou(?:'ve| have)?\s+shown\s+interest\s+in\b/gi,
    /\bI\s+see\s+you(?:'re| are)\s+interested\s+in\b/gi,
    /\bThanks?\s+for\s+(?:sharing|expressing)\s+your\s+interest\s+in\b/gi,
  ];

  for (const pattern of replacements) {
    result = result.replace(pattern, 'You are interested in');
  }

  return result;
}

function normalizeContactFollowUp(text) {
  let result = String(text || '');

  result = result.replace(/\bI will check my schedule,?\s*then I will call you\.?\s*/gi, '');
  result = result.replace(
    /\bPlease provide your contact details,?\s*and I will check my schedule[^.]*\.?/gi,
    '',
  );
  result = result.replace(/\bI will check my schedule[^.]*\.?\s*/gi, '');
  result = result.replace(/\b(?:then\s+)?I will call you\.?\s*/gi, '');
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

function isUnitInterestMessage(message) {
  return /^I am interested in unit [a-f0-9]{8}\.?$/i.test(String(message || '').trim());
}

function stripInterestContactAsk(text) {
  let result = String(text || '');

  const patterns = [
    /\s*Someone from our team will contact you\.?\s*/gi,
    /\s*Please share your name and mobile number\.?/gi,
    /\s*Please provide your contacts?\.?/gi,
    /\s*Please provide your contact details\.?/gi,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }

  return result.replace(/\s{2,}/g, ' ').replace(/\s+([.!?])/g, '$1').trim();
}

function sanitizeClientReply(reply, focus = null, options = {}) {
  let text = normalizeContactFollowUp(normalizeInterestAcknowledgment(reply));
  if (!text) return text;

  const replacements = [];
  const redactNames = [
    ...(focus?.redactNames || []),
    ...(options.redactNames || []),
  ];

  for (const name of redactNames) {
    if (name) {
      text = text.replace(new RegExp(escapeRegExp(name), 'gi'), 'Private Property');
    }
  }

  if (focus?.unitRef) {
    replacements.push(focus.unitRef);
  }

  if (focus?.buildingRef) {
    replacements.push(focus.buildingRef);
  }

  const displayLabel = focus?.displayLabel;
  if (displayLabel) {
    for (const ref of replacements) {
      const refPattern = new RegExp(`\\b(?:unit|listing|property)\\s+${escapeRegExp(ref)}\\b`, 'gi');
      text = text.replace(refPattern, displayLabel);
      text = text.replace(new RegExp(escapeRegExp(ref), 'gi'), displayLabel);
    }
  } else {
    for (const ref of replacements) {
      text = text.replace(new RegExp(`\\b(?:unit|listing)\\s+${escapeRegExp(ref)}\\b`, 'gi'), 'this listing');
      text = text.replace(new RegExp(escapeRegExp(ref), 'gi'), 'this listing');
    }
  }

  text = text.replace(/\b(?:unit|listing)\s+this listing\b/gi, 'this listing');

  if (options.stripInterestContactAsk) {
    text = stripInterestContactAsk(text);
  }

  return text;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  buildUnitDisplayLabel,
  extractUnitRefsFromMessage,
  findUnitEntry,
  formatFocusedUnitSummary,
  getPublicPropertyUrl,
  getPublicUnitUrl,
  getUnitRef,
  isUnitInterestMessage,
  normalizeContactFollowUp,
  normalizeInterestAcknowledgment,
  resolveConversationUnitFocus,
  sanitizeClientReply,
};
