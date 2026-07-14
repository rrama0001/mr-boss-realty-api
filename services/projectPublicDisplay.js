const PUBLIC_PRIVATE_PROPERTY_LABEL = 'Private Property';

function isPrivateOnWebsite(project = {}) {
  return Boolean(project.is_private_on_website);
}

/**
 * Public API: never include the real property/owner name when marked private.
 */
function getPublicProjectDisplayName(project = {}) {
  if (isPrivateOnWebsite(project)) {
    return PUBLIC_PRIVATE_PROPERTY_LABEL;
  }

  return project.project_name || '';
}

function buildPublicProjectNameFields(project = {}) {
  const privateOnWebsite = isPrivateOnWebsite(project);

  return {
    is_private_on_website: privateOnWebsite,
    project_name: privateOnWebsite ? PUBLIC_PRIVATE_PROPERTY_LABEL : (project.project_name || ''),
  };
}

module.exports = {
  PUBLIC_PRIVATE_PROPERTY_LABEL,
  isPrivateOnWebsite,
  getPublicProjectDisplayName,
  buildPublicProjectNameFields,
};
