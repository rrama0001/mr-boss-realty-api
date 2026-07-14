const conversations = new Map();
const conversationBuildingFocus = new Map();
const conversationUnitFocus = new Map();
const listingFocusByUser = new Map();

function getListingFocus(userKey) {
  return listingFocusByUser.get(userKey) || null;
}

function setListingFocus(userKey, data = {}) {
  if (!userKey) return;

  const previous = listingFocusByUser.get(userKey) || {};
  const next = {
    buildingRef: data.buildingRef ?? previous.buildingRef ?? null,
    unitRef: data.unitRef ?? previous.unitRef ?? null,
    projectSlug: data.projectSlug ?? previous.projectSlug ?? null,
  };

  if (next.buildingRef || next.unitRef || next.projectSlug) {
    listingFocusByUser.set(userKey, next);
  }
}

function clearListingFocus(userKey) {
  listingFocusByUser.delete(userKey);
}

function getChatMessages(userKey) {
  const history = conversations.get(userKey);
  if (!Array.isArray(history)) return [];

  return history.filter((message) => message.role === 'user' || message.role === 'assistant');
}

function clearConversationState(userKey) {
  conversations.delete(userKey);
  conversationBuildingFocus.delete(userKey);
  conversationUnitFocus.delete(userKey);
  clearListingFocus(userKey);
}

module.exports = {
  clearConversationState,
  clearListingFocus,
  conversationBuildingFocus,
  conversationUnitFocus,
  conversations,
  getChatMessages,
  getListingFocus,
  setListingFocus,
};
