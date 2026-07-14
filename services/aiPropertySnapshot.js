const { getPublicPropertyUrl, getPublicUnitUrl, getUnitRef } = require('./aiUnitFocus');
const { getBuildingRef, getPublicBuildingUrl } = require('./aiBuildingFocus');
const { appendDeveloperAiContext, formatDeveloperAiLines } = require('./aiDeveloperContext');
const { getPublicProjectDisplayName } = require('./projectPublicDisplay');

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

function formatMediaLinks({ imagesVideosLink, assets = [] }) {
    const links = [];
    const { normalizeStoredUploadUrl } = require('./uploadUrls');

    if (isShareableMediaUrl(imagesVideosLink)) {
        links.push(normalizeStoredUploadUrl(imagesVideosLink.trim()));
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

function appendWholeBuildingListing(dataText, project, building) {
    const buildingRef = getBuildingRef(building);
    const listingPage = getPublicBuildingUrl(project, buildingRef);
    const publicName = getPublicProjectDisplayName(project);

    dataText += `     - ${building.building_name || 'Whole Property'} (whole-property listing)\n`;
    dataText += `          Internal Listing Ref (never mention to client): ${buildingRef}\n`;
    if (listingPage) dataText += `          Listing Page: ${listingPage}\n`;
    dataText += `          Property: ${publicName}\n`;
    if (building.building_type) dataText += `          Building Type: ${building.building_type}\n`;
    if (building.status) dataText += `          Status: ${building.status}\n`;
    if (building.listing_type) dataText += `          Listing Type: ${building.listing_type}\n`;
    if (building.bedrooms != null) dataText += `          Bedrooms: ${building.bedrooms}\n`;
    if (building.bathrooms != null) dataText += `          Bathrooms: ${building.bathrooms}\n`;
    if (building.stories != null) dataText += `          Number of Floors: ${building.stories}\n`;
    if (building.number_of_units != null) dataText += `          Number of Rooms: ${building.number_of_units}\n`;
    if (building.total_floor_area) dataText += `          Total Floor Area: ${building.total_floor_area}\n`;
    if (building.typical_room_area) dataText += `          Typical Room Area: ${building.typical_room_area}\n`;
    if (building.sale_price != null) dataText += `          Sale Price: ${building.sale_price.toLocaleString()}\n`;
    if (building.monthly_rent != null) dataText += `          Monthly Rent: ${building.monthly_rent}\n`;
    if (building.total_parking != null) dataText += `          Total Parking: ${building.total_parking}\n`;
    if (building.total_available_parking != null) {
        dataText += `          Total Available Parking: ${building.total_available_parking}\n`;
    }
    if (building.is_pet_allowed != null) dataText += `          Pets Allowed: ${building.is_pet_allowed}\n`;
    if (building.allowed_pet_size) dataText += `          Allowed Pet Size: ${building.allowed_pet_size}\n`;
    if (building.is_allowed_smoking != null) dataText += `          Smoking Allowed: ${building.is_allowed_smoking}\n`;
    if (building.freebies) dataText += `          Freebies: ${building.freebies}\n`;

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
        if (project.description && !isPrivate) {
            dataText += `   Description: ${project.description}\n`;
        } else if (project.description && isPrivate) {
            dataText += '   Description: (public teaser only — do not quote the full private description)\n';
        }
        if (project.status) dataText += `   Status: ${project.status}\n`;
        if (project.amenities) dataText += `   Amenities: ${project.amenities}\n`;

        const projectMedia = formatMediaLinks({
            imagesVideosLink: project.images_videos_link,
            assets: project.assets || [],
        });
        if (projectMedia.length) {
            dataText += `   Project media URLs: ${projectMedia.slice(0, 1).join(' | ')}\n`;
        }

        if (project.buildings?.length) {
            dataText += '   Buildings:\n';
            for (const building of project.buildings) {
                if (building.is_whole_property_listing) {
                    dataText = appendWholeBuildingListing(dataText, project, building);
                    continue;
                }

                dataText += `     - ${building.building_name} \n`;
                if (building.building_type) dataText += `          Building Type:  ${building.building_type}\n`;
                if (building.status) dataText += `          Status:  ${building.status}\n`;
                if (building.number_of_units) dataText += `          Number of Units:  ${building.number_of_units}\n`;
                if (building.total_available_units) {
                    dataText += `          Total Available Units:  ${building.total_available_units}\n`;
                }
                if (building.lts_completion_date) {
                    dataText += `          LTS Completion Date:  ${building.lts_completion_date}\n`;
                }
                if (building.cts_completion_date) {
                    dataText += `          CTS Completion Date:  ${building.cts_completion_date}\n`;
                }
                if (building.total_parking) dataText += `          Total Parking:  ${building.total_parking}\n`;
                if (building.total_available_parking) {
                    dataText += `          Total Available Parking:  ${building.total_available_parking}\n`;
                }
                if (building.freebies) dataText += `          Freebies:  ${building.freebies}\n`;

                dataText += '          Available Units: \n';
                if (building.units?.length) {
                    for (const unit of building.units) {
                        const unitRef = getUnitRef(unit);
                        const unitPage = getPublicUnitUrl(project, unitRef);
                        dataText += `             • ${unit.unit_type} -`;
                        dataText += ` Unit Ref (internal, never mention to client): ${unitRef},`;
                        if (unitPage) dataText += ` Unit Page: ${unitPage},`;
                        dataText += ` Project: ${publicName},`;
                        dataText += ` Building: ${building.building_name || 'N/A'},`;
                        dataText += `${unit.unit_size ? ` Area: ${unit.unit_size},` : ''}`;
                        dataText += `${unit.bedrooms != null ? ` Bedrooms: ${unit.bedrooms},` : ''}`;
                        dataText += `${unit.bathrooms != null ? ` Bathrooms: ${unit.bathrooms},` : ''}`;
                        dataText += `${unit.unit_price ? ` Price: ${unit.unit_price.toLocaleString()},` : ' Price: No price'}`;

                        const unitMedia = formatMediaLinks({
                            imagesVideosLink: unit.images_videos_link,
                            assets: unit.assets || [],
                        });
                        if (unitMedia.length) {
                            dataText += ` Unit media URLs: ${unitMedia.slice(0, 1).join(' | ')},`;
                        } else {
                            dataText += ' Unit media URLs: none available,';
                        }

                        dataText += '\n';
                    }
                }
            }
        }

        if (project.deliverables?.length) {
            dataText += '   Deliverables:\n';
            for (const d of project.deliverables) {
                dataText += `     • ${d.name || 'Deliverable'} - ${d.description || ''}\n`;
            }
        }

        dataText += '\n';
    }

    dataText += `\n${buildMediaIndex(projects)}`;

    return dataText;
}

function buildSystemContent(aiPrompt, dataText, focusSummaries = {}) {
    const { buildingSummary = '', unitSummary = '' } = focusSummaries;

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

    return `${aiPrompt}

${buildingFocusBlock}${unitFocusBlock}You have access to the following database information:
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
- Answer follow-up questions about price, size, photos, payment terms, reservation, and availability in the context of the active unit focus unless they clearly switch to another unit or property.
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
Public listing visibility rules:
- Only discuss fields that appear on the public website: city, price, bedrooms, bathrooms, unit/building type, status, amenities, and one hero image.
- NEVER share street address, barangay, room number, floor, payment terms, reservation details, owner identity, or direct contact details unless the client completed mobile OTP verification.
- When a client asks for gated details, the website will show consent and mobile OTP verification — do not answer from hidden database fields.
Developer context rules:
- When Developer Website or Developer Notes appear in the snapshot or active focus block, treat them as internal notes that help the AI answer questions about that property.
- Developer Notes may include sample computations, payment illustrations, or external links — use them when relevant. Present sample math as illustrative unless the notes clearly state it is official.
- You may share the Developer Website URL when helpful; use markdown link syntax with friendly text (example: [developer website](url)).
- Do NOT claim you browsed or live-scraped the developer website — only use Developer Notes and offer the URL for the client to visit.
- Developer Notes may include details beyond the public listing, but still follow OTP gating for restricted fields (street address, owner identity, private contact details, room number, floor).
Chat usage rules:
- Website visitors have a limited number of free AI messages per session. When they reach the limit, the website asks for mobile OTP verification before continuing.
- Treat verified contacts as real leads. Be helpful after verification, but still follow the public vs gated field rules above.`;
}

module.exports = {
    isShareableMediaUrl,
    buildPropertySnapshot,
    buildSystemContent,
    formatDeveloperAiLines,
};
