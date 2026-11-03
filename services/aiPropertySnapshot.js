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

    dataText += `\n${buildMediaIndex(projects)}`;

    return dataText;
}

function buildSystemContent(aiPrompt, dataText, focusSummaries = {}) {
    const { buildingSummary = '', unitSummary = '', companyContact = null } = focusSummaries;

    const buildingFocusBlock = buildingSummary
        ? `Active whole-property listing focus for this conversation (use this as the primary listing unless the user switches):
${buildingSummary}

`
        : '';

    const unitFocusBlock = unitSummary
        ? `Active unit focus for this conversation (use this as the primary unit unless the user switches to another unit):
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

    return `${aiPrompt}

${buildingFocusBlock}${unitFocusBlock}${companyContactBlock}You have access to the following database information:
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
- You may answer any inventory question using fields present in the snapshot or active focus. Be complete and specific.
- If a requested detail is missing from the snapshot, say it is not available yet — never invent values.
- When asked for Google Earth / Maps / map location, share the exact Google Earth and Google Maps URLs from the snapshot (or active focus). Prefer markdown links with friendly text (example: [Open in Google Earth](url)).
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
    formatDeveloperAiLines,
};
