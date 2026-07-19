/**
 * Build Google Earth / Maps search links from a property address.
 * Opens a search for the address (no geocoding API required).
 */
function buildAddressQuery(project = {}) {
  const location = String(project.location || '').trim();
  const city = String(project.city || '').trim();

  if (!location && !city) return '';
  if (!location) return city;
  if (!city) return location;
  if (location.toLowerCase().includes(city.toLowerCase())) return location;
  return `${location}, ${city}`;
}

function buildMapLinks(project = {}) {
  const query = buildAddressQuery(project);
  if (!query) return null;

  const encoded = encodeURIComponent(query);
  return {
    query,
    googleEarthUrl: `https://earth.google.com/web/search/${encoded}`,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}

function formatMapLinksForAi(project = {}) {
  const links = buildMapLinks(project);
  if (!links) return [];

  return [
    `Google Earth: ${links.googleEarthUrl}`,
    `Google Maps: ${links.googleMapsUrl}`,
  ];
}

module.exports = {
  buildAddressQuery,
  buildMapLinks,
  formatMapLinksForAi,
};
