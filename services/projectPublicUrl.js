const { slugifyPart } = require('./projectSlug');

const PUBLIC_PRIVATE_PROJECT_SEGMENT = 'private-property';

function cityToSlug(city = '') {
  return slugifyPart(city);
}

function deriveNameSegmentFromDbSlug(dbSlug, city) {
  const citySlug = cityToSlug(city);
  if (!dbSlug) return 'property';
  if (!citySlug) return dbSlug;

  const suffix = `-${citySlug}`;
  if (dbSlug.endsWith(suffix)) {
    return dbSlug.slice(0, -suffix.length) || 'property';
  }

  const pattern = new RegExp(`^(.+)${suffix.replace(/-/g, '\\-')}-(\\d+)$`);
  const match = dbSlug.match(pattern);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return dbSlug;
}

function deriveProjectSlugSegment(project = {}) {
  if (project.is_private_on_website) {
    return PUBLIC_PRIVATE_PROJECT_SEGMENT;
  }

  const nameSegment = slugifyPart(project.project_name || project.name);
  if (nameSegment) {
    return nameSegment;
  }

  return deriveNameSegmentFromDbSlug(project.slug, project.city);
}

function getProjectUrlSegments(project = {}) {
  const citySlug = cityToSlug(project.city);

  return {
    citySlug,
    projectSlug: deriveProjectSlugSegment(project),
  };
}

function projectMatchesUrlSegments(project = {}, citySlug = '', projectSlug = '') {
  const segments = getProjectUrlSegments(project);
  return segments.citySlug === cityToSlug(citySlug)
    && segments.projectSlug === slugifyPart(projectSlug);
}

function buildPropertyDetailPath(project = {}) {
  const { citySlug, projectSlug } = getProjectUrlSegments(project);
  if (!citySlug || !projectSlug) return '/properties';
  return `/properties/${citySlug}/${projectSlug}`;
}

function buildListingDetailPath(project = {}, listingRef = '') {
  const ref = String(listingRef || '').trim();
  if (!ref) return buildPropertyDetailPath(project);

  const { citySlug, projectSlug } = getProjectUrlSegments(project);
  if (!citySlug || !projectSlug) return '/properties';
  return `/properties/${citySlug}/${projectSlug}/${ref}`;
}

async function findProjectByUrlSegments(prisma, citySlug, projectSlug, select = { id: true, slug: true }) {
  const normalizedProject = slugifyPart(projectSlug);
  const isPrivateSegment = normalizedProject === PUBLIC_PRIVATE_PROJECT_SEGMENT;

  const projects = await prisma.projects.findMany({
    where: {
      is_private_on_website: isPrivateSegment,
    },
    select: {
      ...select,
      slug: true,
      project_name: true,
      city: true,
      is_private_on_website: true,
    },
  });

  const matches = projects.filter((project) => projectMatchesUrlSegments(project, citySlug, projectSlug));

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

module.exports = {
  PUBLIC_PRIVATE_PROJECT_SEGMENT,
  cityToSlug,
  deriveNameSegmentFromDbSlug,
  deriveProjectSlugSegment,
  getProjectUrlSegments,
  projectMatchesUrlSegments,
  buildPropertyDetailPath,
  buildListingDetailPath,
  findProjectByUrlSegments,
};
