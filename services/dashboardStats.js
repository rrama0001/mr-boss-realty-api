const { STATUS_LABELS } = require('../constants/buildingStatuses');
const { formatLeadForAdmin, resolvePropertyLabel } = require('./leadService');

const LEAD_TREND_DAYS = 30;
const RECENT_LEADS_LIMIT = 8;
const TOP_UNIT_TYPES = 8;

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDayKey(date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function emptyLeadTrend(days = LEAD_TREND_DAYS) {
  const today = startOfUtcDay(new Date());
  const trend = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);
    trend.push({ date: formatDayKey(day), count: 0 });
  }

  return trend;
}

function toCountMap(rows, keyField = 'key') {
  const map = {};
  for (const row of rows) {
    const key = row[keyField] == null || row[keyField] === '' ? 'unknown' : String(row[keyField]);
    map[key] = (map[key] || 0) + Number(row._count?._all || row._count || 0);
  }
  return map;
}

function mapWithLabels(countMap, labels = {}) {
  return Object.entries(countMap)
    .map(([key, count]) => ({
      key,
      label: labels[key] || (key === 'unknown' ? 'Unspecified' : key),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function collapseTopItems(items, limit) {
  if (items.length <= limit) return items;

  const top = items.slice(0, limit);
  const otherCount = items.slice(limit).reduce((sum, item) => sum + item.count, 0);
  if (otherCount > 0) {
    top.push({ key: 'other', label: 'Other', count: otherCount });
  }
  return top;
}

async function buildLeadStats(prisma) {
  const now = new Date();
  const trendStart = startOfUtcDay(now);
  trendStart.setUTCDate(trendStart.getUTCDate() - (LEAD_TREND_DAYS - 1));

  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const [total, last7Days, recentRows, trendRows] = await Promise.all([
    prisma.leads.count(),
    prisma.leads.count({ where: { verified_at: { gte: weekStart } } }),
    prisma.leads.findMany({
      orderBy: [{ verified_at: 'desc' }, { created_at: 'desc' }],
      take: RECENT_LEADS_LIMIT,
    }),
    prisma.leads.findMany({
      where: { verified_at: { gte: trendStart } },
      select: { verified_at: true },
      orderBy: { verified_at: 'asc' },
    }),
  ]);

  const byDay = emptyLeadTrend();
  const dayIndex = new Map(byDay.map((item, index) => [item.date, index]));

  for (const row of trendRows) {
    const key = formatDayKey(new Date(row.verified_at));
    const index = dayIndex.get(key);
    if (index != null) {
      byDay[index].count += 1;
    }
  }

  const propertyLabels = await Promise.all(
    recentRows.map((lead) => resolvePropertyLabel(prisma, lead.building_ref, lead.unit_ref)),
  );

  const recent = recentRows.map((lead, index) => formatLeadForAdmin(lead, propertyLabels[index]));

  return {
    total,
    last7Days,
    byDay,
    recent,
  };
}

async function getDashboardStats(prisma, { includeLeads = false } = {}) {
  const [
    projectsTotal,
    projectsFeatured,
    projectsPrivate,
    projectsByStatus,
    buildingsTotal,
    buildingsByStatus,
    buildingsAvailability,
    unitsTotal,
    unitsByListingType,
    unitsByType,
  ] = await Promise.all([
    prisma.projects.count(),
    prisma.projects.count({ where: { is_featured: true } }),
    prisma.projects.count({ where: { is_private_on_website: true } }),
    prisma.projects.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.buildings.count(),
    prisma.buildings.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.buildings.aggregate({
      _sum: {
        total_available_units: true,
        total_available_parking: true,
      },
    }),
    prisma.units.count(),
    prisma.units.groupBy({
      by: ['listing_type'],
      _count: { _all: true },
    }),
    prisma.units.groupBy({
      by: ['unit_type'],
      _count: { _all: true },
    }),
  ]);

  const listingTypeLabels = {
    sale: 'For Sale',
    rent: 'For Rent',
    unknown: 'Unspecified',
  };

  const unitTypeItems = collapseTopItems(
    mapWithLabels(toCountMap(unitsByType, 'unit_type')),
    TOP_UNIT_TYPES,
  );

  const listingTypeMap = toCountMap(unitsByListingType, 'listing_type');
  const forSale = listingTypeMap.sale || 0;
  const forRent = listingTypeMap.rent || 0;

  const payload = {
    generatedAt: new Date().toISOString(),
    projects: {
      total: projectsTotal,
      featured: projectsFeatured,
      privateOnWebsite: projectsPrivate,
      byStatus: mapWithLabels(toCountMap(projectsByStatus, 'status'), STATUS_LABELS),
    },
    buildings: {
      total: buildingsTotal,
      byStatus: mapWithLabels(toCountMap(buildingsByStatus, 'status'), STATUS_LABELS),
      availableUnitsReported: buildingsAvailability._sum.total_available_units || 0,
      availableParkingReported: buildingsAvailability._sum.total_available_parking || 0,
    },
    units: {
      total: unitsTotal,
      forSale,
      forRent,
      byListingType: mapWithLabels(listingTypeMap, listingTypeLabels),
      byUnitType: unitTypeItems,
    },
    leads: null,
  };

  if (includeLeads) {
    payload.leads = await buildLeadStats(prisma);
  }

  return payload;
}

module.exports = {
  getDashboardStats,
};
