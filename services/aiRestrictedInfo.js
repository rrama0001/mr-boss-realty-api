const RESTRICTED_TOPICS = {
  address: {
    label: 'street address or exact location',
    patterns: [
      /\b(?:street|exact|full|complete|specific|precise|actual|real)\s+address\b/i,
      /\b(?:exact|full|complete|specific|precise|actual|real)\s+location\b/i,
      /\b(?:what|where)\s+is\s+(?:the\s+)?(?:exact\s+)?address\b/i,
      /\b(?:what|where)\s+is\s+(?:the\s+)?(?:exact\s+)?location\b/i,
      /\baddress\s+of\s+(?:this|the)\b/i,
      /\blocation\s+of\s+(?:this|the)\s+(?:property|unit|listing|house|room|building|home)\b/i,
      /\b(?:located|situated)\s+at\b/i,
      /\bwhere\s+(?:is|are|exactly\s+is)\s+(?:this|the)\s+(?:property|unit|listing|house|room|building|home)\b/i,
      /\bwhere\s+(?:is|are)\s+(?:this|the)\s+(?:property|unit|listing|house|room|building|home)\s+(?:located|situated)\b/i,
      /\b(?:barangay|sitio|subdivision|village|neighborhood)\b/i,
      /\b(?:map|gps|coordinates|pin|directions?\s+to)\b/i,
    ],
  },
  owner: {
    label: 'owner or landlord identity',
    patterns: [
      /\bowner(?:'?s)?\s+(?:name|contact|details|info|number|email)\b/i,
      /\bwho\s+owns\b/i,
      /\blandlord\b/i,
      /\bproperty\s+owner\b/i,
    ],
  },
  contact: {
    label: 'private contact details',
    patterns: [
      /\b(?:contact|phone|mobile|cell|email)\s+(?:number|details|info)\b/i,
      /\b(?:call|text|message|email)\s+(?:the\s+)?(?:owner|seller|landlord)\b/i,
      /\bhow\s+(?:can|do)\s+i\s+(?:reach|contact)\s+(?:the\s+)?(?:owner|seller|landlord)\b/i,
    ],
  },
};

const VERIFICATION_CONSENT_REPLY =
  'You are asking for additional information that is not shown on our public listing pages. Under our data privacy policy, we need to verify that you are a real person before we can share those details.\n\n' +
  'You are allowing us to keep your contact privately. We will use it for OTP verification and to contact you if we need to follow up on your inquiry.\n\n' +
  'If you agree, click **Agree** or **Cancel**.';

const QUOTA_CONSENT_REPLY =
  'You have reached the free AI chat limit for this session. To continue asking about our listings—and to help us prevent automated abuse—we need to verify your mobile number with a one-time password (OTP).\n\n' +
  'You are allowing us to keep your contact privately. We will use it for OTP verification and to follow up on your inquiry if needed.\n\n' +
  'If you agree, click **Agree** or **Cancel**.';

const QUOTA_VERIFIED_REPLY =
  'Thank you for verifying your contact. You can continue chatting with Mr. Boss AI about our listings. How else can I help you?';

const VERIFICATION_CONTACT_REPLY =
  'Thank you. Please provide your mobile number so we can send you a one-time password (OTP) for verification.';

const VERIFICATION_OTP_SENT_REPLY =
  'We sent a one-time password (OTP) to your mobile number. Please enter the 6-digit code here to continue.';

const VERIFICATION_OTP_DEV_REPLY =
  'SMS delivery is not configured on this server yet, so the OTP could not be texted. For local testing, use the development code shown below.';

const VERIFICATION_CANCEL_REPLY =
  'Understood. I will not collect your contact details. I can still help with information that is publicly listed, such as city, price, bedrooms, and amenities.';

const VERIFICATION_DECLINED_REPLY =
  'No problem. Let me know if you have other questions about publicly listed details.';

const VERIFICATION_SUCCESS_REPLY =
  'Thank you for verifying your contact. Here is the information you requested:\n\n';

function detectRestrictedLocationQuestion(message) {
  const text = String(message || '').trim();
  if (!text) return false;

  const hasLocationIntent = /\b(location|address|where\s+is|where\s+are|located|situated|directions?|coordinates|gps|map|pin)\b/i.test(text);
  const hasRestrictedQualifier = /\b(exact|specific|precise|full|complete|street|private|actual|real|specific)\b/i.test(text);
  const hasPropertyContext = /\b(this|the)\s+(property|unit|listing|house|home|building|room)\b/i.test(text);

  if (!hasLocationIntent) return false;

  if (/\b(city|area|region|province)\s+only\b/i.test(text)) {
    return false;
  }

  return hasRestrictedQualifier || hasPropertyContext || /\baddress\b/i.test(text);
}

function detectRestrictedInfoRequest(message) {
  const text = String(message || '').trim();
  if (!text) return null;

  for (const [topic, config] of Object.entries(RESTRICTED_TOPICS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        return { topic, label: config.label };
      }
    }
  }

  if (detectRestrictedLocationQuestion(text)) {
    return { topic: 'address', label: RESTRICTED_TOPICS.address.label };
  }

  return null;
}

function isVerificationConsentReply(text) {
  const reply = String(text || '');
  if (!reply) return false;

  const hasActions = /\bAgree\b/i.test(reply) && /\bCancel\b/i.test(reply);
  if (!hasActions) return false;

  return (
    reply.includes('Under our data privacy policy')
    || reply.includes('free AI chat limit')
  );
}

function isAiPrivacyRefusalReply(text) {
  const reply = String(text || '');
  if (!reply) return false;

  const refuses = /\b(can'?t|cannot|unable to|won'?t)\s+(?:provide|share|give|disclose|tell you)\b/i.test(reply);
  const privacyContext = /\b(privacy|private|policy|exact location|street address|address|location)\b/i.test(reply);

  return refuses && privacyContext;
}

function buildVerificationConsentReply(topic = 'restricted') {
  if (topic === 'chat_quota') {
    return QUOTA_CONSENT_REPLY;
  }

  return VERIFICATION_CONSENT_REPLY;
}

function buildQuotaVerifiedReply() {
  return QUOTA_VERIFIED_REPLY;
}

function buildVerificationContactReply() {
  return VERIFICATION_CONTACT_REPLY;
}

function buildVerificationOtpSentReply() {
  return VERIFICATION_OTP_SENT_REPLY;
}

function buildVerificationCancelReply() {
  return VERIFICATION_CANCEL_REPLY;
}

function buildVerificationDeclinedReply() {
  return VERIFICATION_DECLINED_REPLY;
}

function collectLocationRedactionTermsFromProjects(projects) {
  const terms = new Set();

  for (const project of projects) {
    const location = String(project.location || '').trim();
    if (location) {
      terms.add(location);
      for (const part of location.split(/[,·]/)) {
        const trimmed = part.trim();
        if (trimmed.length > 3) {
          terms.add(trimmed);
        }
      }
    }
  }

  return [...terms];
}

function buildVerifiedRestrictedReply(topic, activeFocus, projects, options = {}) {
  const entry = resolveFocusEntry(activeFocus, projects, options);
  if (!entry) {
    return `${VERIFICATION_SUCCESS_REPLY}We could not locate the listing details for your request. Please share the property or unit link again.`;
  }

  const { project } = entry;

  if (topic === 'address') {
    const location = String(project.location || '').trim();
    const city = String(project.city || '').trim();
    if (location) {
      return `${VERIFICATION_SUCCESS_REPLY}**Address:** ${location}${city && !location.toLowerCase().includes(city.toLowerCase()) ? `, ${city}` : ''}`;
    }
    if (city) {
      return `${VERIFICATION_SUCCESS_REPLY}We only have the city on file: **${city}**. Our team can follow up if you need the exact address.`;
    }
    return `${VERIFICATION_SUCCESS_REPLY}We do not have a street address on file for this listing. Our team will follow up with you.`;
  }

  if (topic === 'owner') {
    const name = String(project.project_name || '').trim();
    if (project.is_private_on_website && name) {
      return `${VERIFICATION_SUCCESS_REPLY}The registered property name on file is **${name}**. For privacy, our team will coordinate any direct owner contact with you.`;
    }
    return `${VERIFICATION_SUCCESS_REPLY}Owner details are handled by our team. We will follow up using your verified contact.`;
  }

  if (topic === 'contact') {
    const parts = [
      project.contact_person ? `Contact person: ${project.contact_person}` : null,
      project.contact_person_number ? `Phone: ${project.contact_person_number}` : null,
      project.contact_person_email ? `Email: ${project.contact_person_email}` : null,
    ].filter(Boolean);

    if (parts.length) {
      return `${VERIFICATION_SUCCESS_REPLY}${parts.join('\n')}`;
    }
    return `${VERIFICATION_SUCCESS_REPLY}We do not have direct contact details on file. Our team will reach out to you shortly.`;
  }

  if (topic === 'chat_quota') {
    return buildQuotaVerifiedReply();
  }

  return `${VERIFICATION_SUCCESS_REPLY}Our team will follow up with the details you requested.`;
}

function mergeListingRefs(base = {}, extra = {}) {
  return {
    buildingRef: base.buildingRef || extra.buildingRef || null,
    unitRef: base.unitRef || extra.unitRef || null,
    projectSlug: base.projectSlug || extra.projectSlug || null,
  };
}

function extractListingRefsFromText(text) {
  const { extractPropertyListingRefsFromMessage } = require('./aiBuildingFocus');
  const { extractUnitRefsFromMessage } = require('./aiUnitFocus');

  const propertyRefs = extractPropertyListingRefsFromMessage(text);
  const lastProperty = propertyRefs[propertyRefs.length - 1];

  if (lastProperty) {
    return {
      buildingRef: lastProperty.listingRef,
      projectSlug: lastProperty.projectSlug,
      unitRef: null,
    };
  }

  const unitRefs = extractUnitRefsFromMessage(text);
  const lastUnitRef = unitRefs[unitRefs.length - 1];

  if (lastUnitRef) {
    return {
      buildingRef: null,
      projectSlug: null,
      unitRef: lastUnitRef,
    };
  }

  return null;
}

function extractListingRefsFromChatMessages(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;

    const refs = extractListingRefsFromText(message.content);
    if (refs?.buildingRef || refs?.unitRef) {
      return refs;
    }
  }

  return null;
}

function resolveListingRefs(activeFocus = {}, options = {}) {
  const focus = activeFocus || {};
  const { pendingMessage, userKey, chatMessages, pageUrl } = options;
  let refs = {
    buildingRef: focus.buildingRef || null,
    unitRef: focus.unitRef || null,
    projectSlug: focus.projectSlug || null,
  };

  if (userKey) {
    const { getListingFocus } = require('./aiConversationState');
    refs = mergeListingRefs(refs, getListingFocus(userKey) || {});
  }

  if (pageUrl) {
    refs = mergeListingRefs(refs, extractListingRefsFromText(pageUrl) || {});
  }

  if (pendingMessage) {
    refs = mergeListingRefs(refs, extractListingRefsFromText(pendingMessage) || {});
  }

  if (Array.isArray(chatMessages) && chatMessages.length) {
    refs = mergeListingRefs(refs, extractListingRefsFromChatMessages(chatMessages) || {});
  }

  return refs;
}

function resolveFocusEntry(activeFocus, projects, options = {}) {
  const refs = resolveListingRefs(activeFocus, options);

  if (refs.buildingRef) {
    const { findBuildingEntry } = require('./aiBuildingFocus');
    const entry = findBuildingEntry(projects, refs.buildingRef, refs.projectSlug);
    if (entry) return entry;
  }

  if (refs.unitRef) {
    const { findBuildingEntry } = require('./aiBuildingFocus');
    const buildingEntry = findBuildingEntry(projects, refs.unitRef);
    if (buildingEntry) {
      return buildingEntry;
    }

    const { findUnitEntry } = require('./aiUnitFocus');
    const entry = findUnitEntry(projects, refs.unitRef);
    if (entry) return entry;
  }

  return null;
}

function buildVerificationOtpDevReply() {
  return VERIFICATION_OTP_DEV_REPLY;
}

function normalizeMobileNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('63') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`;
  }

  return null;
}

function isValidMobile(value) {
  return normalizeMobileNumber(value) != null;
}

function isValidEmail(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isValidContactValue(value) {
  return isValidMobile(value);
}

module.exports = {
  RESTRICTED_TOPICS,
  buildVerificationCancelReply,
  buildVerificationConsentReply,
  buildVerificationContactReply,
  buildVerificationDeclinedReply,
  buildVerificationOtpSentReply,
  buildVerificationOtpDevReply,
  buildVerifiedRestrictedReply,
  buildQuotaVerifiedReply,
  collectLocationRedactionTermsFromProjects,
  detectRestrictedInfoRequest,
  isAiPrivacyRefusalReply,
  isValidContactValue,
  isValidEmail,
  isValidMobile,
  isVerificationConsentReply,
  normalizeMobileNumber,
  resolveListingRefs,
};
