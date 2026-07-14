const MAX_FEATURED_PROJECTS = 6;

function parseFeaturedFields(body = {}) {
  const isFeatured = Boolean(body.is_featured);
  const rawOrder = body.featured_sort_order;

  let featuredSortOrder = null;
  if (isFeatured && rawOrder !== undefined && rawOrder !== null && rawOrder !== '') {
    const parsed = parseInt(rawOrder, 10);
    if (Number.isFinite(parsed)) {
      featuredSortOrder = parsed;
    }
  }

  return {
    is_featured: isFeatured,
    featured_sort_order: isFeatured ? featuredSortOrder : null,
  };
}

async function countFeaturedProjects(prisma, excludeProjectId = null) {
  const where = { is_featured: true };

  if (excludeProjectId != null) {
    where.id = { not: excludeProjectId };
  }

  return prisma.projects.count({ where });
}

async function assertCanSetFeatured(prisma, isFeatured, excludeProjectId = null) {
  if (!isFeatured) return;

  const featuredCount = await countFeaturedProjects(prisma, excludeProjectId);
  if (featuredCount >= MAX_FEATURED_PROJECTS) {
    const error = new Error(
      `Only ${MAX_FEATURED_PROJECTS} properties can be featured on the homepage. Unfeature another property first.`
    );
    error.statusCode = 400;
    throw error;
  }
}

function sortFeaturedProjects(projects = []) {
  return [...projects].sort((left, right) => {
    const leftOrder = left.featured_sort_order;
    const rightOrder = right.featured_sort_order;

    if (leftOrder != null && rightOrder != null && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (leftOrder != null && rightOrder == null) return -1;
    if (leftOrder == null && rightOrder != null) return 1;

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function parseProjectWebsiteFields(body = {}) {
  const isPrivateOnWebsite = Boolean(body.is_private_on_website);
  const featuredFields = parseFeaturedFields(body);

  return {
    is_private_on_website: isPrivateOnWebsite,
    is_featured: featuredFields.is_featured,
    featured_sort_order: featuredFields.featured_sort_order,
  };
}

module.exports = {
  MAX_FEATURED_PROJECTS,
  parseFeaturedFields,
  parseProjectWebsiteFields,
  assertCanSetFeatured,
  sortFeaturedProjects,
};
