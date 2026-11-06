const {
  conversations,
  conversationBuildingFocus,
  conversationUnitFocus,
  setListingFocus,
  getListingFocus,
  getChatMessages,
} = require('./aiConversationState');
const {
  normalizePreferences,
  hasAnyPreference,
  buildConversationSummary,
} = require('./aiClientPreferences');

const MAX_REHYDRATED_MESSAGES = 40;
const clientPreferencesByUser = new Map();

function getClientPreferences(userKey) {
  return normalizePreferences(clientPreferencesByUser.get(userKey) || {});
}

function setClientPreferences(userKey, preferences = {}) {
  if (!userKey) return null;
  const next = normalizePreferences(preferences);
  clientPreferencesByUser.set(userKey, next);
  return next;
}

function clearClientPreferences(userKey) {
  clientPreferencesByUser.delete(userKey);
}

async function ensureChatSession(prisma, sessionKey, { source = 'website' } = {}) {
  const key = String(sessionKey || '').trim();
  if (!key) return null;

  const existing = await prisma.ai_chat_sessions.findUnique({
    where: { session_key: key },
  });
  if (existing) return existing;

  return prisma.ai_chat_sessions.create({
    data: {
      session_key: key,
      source: String(source || 'website'),
    },
  });
}

async function hydrateConversationFromDb(prisma, userKey) {
  const key = String(userKey || '').trim();
  if (!key || conversations.has(key)) {
    return {
      hydrated: false,
      preferences: getClientPreferences(key),
    };
  }

  const session = await prisma.ai_chat_sessions.findUnique({
    where: { session_key: key },
    include: {
      messages: {
        orderBy: { created_at: 'asc' },
        take: MAX_REHYDRATED_MESSAGES,
      },
    },
  });

  if (!session) {
    return {
      hydrated: false,
      preferences: getClientPreferences(key),
    };
  }

  let preferences = {};
  try {
    preferences = session.preferences_json
      ? normalizePreferences(JSON.parse(session.preferences_json))
      : {};
  } catch (_) {
    preferences = {};
  }
  setClientPreferences(key, preferences);

  if (session.unit_ref) {
    conversationUnitFocus.set(key, { unitRef: session.unit_ref });
    setListingFocus(key, {
      unitRef: session.unit_ref,
      buildingRef: null,
      projectSlug: session.project_slug || null,
    });
  } else if (session.building_ref) {
    conversationBuildingFocus.set(key, { buildingRef: session.building_ref });
    setListingFocus(key, {
      buildingRef: session.building_ref,
      unitRef: null,
      projectSlug: session.project_slug || null,
    });
  } else if (session.project_slug) {
    setListingFocus(key, {
      projectSlug: session.project_slug,
      unitRef: null,
      buildingRef: null,
    });
  }

  const history = (session.messages || [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  if (history.length) {
    // Placeholder system message; controller replaces index 0 each turn.
    conversations.set(key, [{ role: 'system', content: '' }, ...history]);
  }

  return {
    hydrated: true,
    preferences: getClientPreferences(key),
    session,
  };
}

async function persistConversationTurn(prisma, {
  userKey,
  source = 'website',
  userMessage,
  assistantMessage,
  preferences = null,
  unitRef = null,
  buildingRef = null,
  projectSlug = null,
}) {
  const key = String(userKey || '').trim();
  if (!key) return null;

  const session = await ensureChatSession(prisma, key, { source });
  if (!session) return null;

  const prefs = normalizePreferences(
    preferences != null ? preferences : getClientPreferences(key),
  );
  setClientPreferences(key, prefs);

  const focus = getListingFocus(key) || {};
  const recentMessages = getChatMessages(key);
  const summary = buildConversationSummary({
    preferences: prefs,
    focus: {
      unitRef: unitRef || focus.unitRef || null,
      buildingRef: buildingRef || focus.buildingRef || null,
      projectSlug: projectSlug || focus.projectSlug || null,
    },
    recentMessages,
  });

  const operations = [
    prisma.ai_chat_sessions.update({
      where: { id: session.id },
      data: {
        source: String(source || session.source || 'website'),
        preferences_json: hasAnyPreference(prefs) ? JSON.stringify(prefs) : null,
        unit_ref: unitRef || focus.unitRef || null,
        building_ref: buildingRef || focus.buildingRef || null,
        project_slug: projectSlug || focus.projectSlug || null,
        summary: summary || null,
        last_message_at: new Date(),
      },
    }),
  ];

  if (userMessage) {
    operations.push(prisma.ai_chat_messages.create({
      data: {
        session_id: session.id,
        role: 'user',
        content: String(userMessage),
      },
    }));
  }

  if (assistantMessage) {
    operations.push(prisma.ai_chat_messages.create({
      data: {
        session_id: session.id,
        role: 'assistant',
        content: String(assistantMessage),
      },
    }));
  }

  await prisma.$transaction(operations);
  return session;
}

async function getSessionSummary(prisma, userKey) {
  const key = String(userKey || '').trim();
  if (!key) return null;

  const session = await prisma.ai_chat_sessions.findUnique({
    where: { session_key: key },
    select: {
      summary: true,
      preferences_json: true,
      unit_ref: true,
      building_ref: true,
      project_slug: true,
    },
  });

  if (!session) {
    return buildConversationSummary({
      preferences: getClientPreferences(key),
      focus: getListingFocus(key) || {},
      recentMessages: getChatMessages(key),
    });
  }

  return session.summary || buildConversationSummary({
    preferences: session.preferences_json
      ? normalizePreferences(JSON.parse(session.preferences_json))
      : getClientPreferences(key),
    focus: {
      unitRef: session.unit_ref,
      buildingRef: session.building_ref,
      projectSlug: session.project_slug,
    },
    recentMessages: getChatMessages(key),
  });
}

module.exports = {
  clientPreferencesByUser,
  getClientPreferences,
  setClientPreferences,
  clearClientPreferences,
  ensureChatSession,
  hydrateConversationFromDb,
  persistConversationTurn,
  getSessionSummary,
};
