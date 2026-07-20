const {
  contactLast4,
  decryptContact,
  encryptContact,
  formatContactForDisplay,
  hashContact,
  maskContactLast4,
  normalizeContactForStorage,
  truncateInquiryMessage,
} = require('./contactEncryption');
const { resolveBuildingIdFromRef } = require('./buildingSlug');
const { resolveUnitIdFromRef } = require('./unitSlug');

async function resolvePropertyLabel(prisma, buildingRef, unitRef) {
  if (unitRef) {
    const unitId = await resolveUnitIdFromRef(prisma, unitRef);
    if (unitId) {
      const unit = await prisma.units.findUnique({
        where: { id: unitId },
        select: {
          room_number: true,
          unit_type: true,
          buildings: { select: { building_name: true } },
          projects: { select: { project_name: true } },
        },
      });

      if (unit) {
        const projectName = unit.projects?.project_name || 'Property';
        const buildingName = unit.buildings?.building_name || 'Building';
        return `${projectName} / ${buildingName} / ${unit.unit_type} ${unit.room_number}`;
      }
    }
  }

  if (buildingRef) {
    const buildingId = await resolveBuildingIdFromRef(prisma, buildingRef);
    if (buildingId) {
      const building = await prisma.buildings.findUnique({
        where: { id: buildingId },
        select: {
          building_name: true,
          projects: { select: { project_name: true } },
        },
      });

      if (building) {
        const projectName = building.projects?.project_name || 'Property';
        const buildingName = building.building_name || buildingRef;
        return `${projectName} / ${buildingName}`;
      }
    }
  }

  return null;
}

function resolveAdminContact(lead) {
  if (lead.contact_encrypted) {
    try {
      const decrypted = decryptContact(lead.contact_encrypted);
      return formatContactForDisplay(decrypted) || decrypted;
    } catch (error) {
      console.error('Failed to decrypt lead contact:', lead.id, error.message);
    }
  }

  return maskContactLast4(lead.contact_last4);
}

function resolveTelHref(contact) {
  const normalized = normalizeContactForStorage(contact);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `tel:+${digits.startsWith('63') ? digits : `63${digits.replace(/^0/, '')}`}`;
  }

  return null;
}

function formatLeadForAdmin(lead, propertyLabel = null) {
  const contact = resolveAdminContact(lead);

  return {
    id: lead.id,
    contact,
    contact_tel: resolveTelHref(contact),
    inquiry_message: lead.inquiry_message,
    building_ref: lead.building_ref,
    unit_ref: lead.unit_ref,
    property_label: propertyLabel,
    source: lead.source,
    verified_at: lead.verified_at,
    created_at: lead.created_at,
  };
}

async function listLeadsForAdmin(prisma) {
  const leads = await prisma.leads.findMany({
    orderBy: [{ verified_at: 'desc' }, { created_at: 'desc' }],
  });

  const propertyLabels = await Promise.all(
    leads.map((lead) => resolvePropertyLabel(prisma, lead.building_ref, lead.unit_ref)),
  );

  return leads.map((lead, index) => formatLeadForAdmin(lead, propertyLabels[index]));
}

async function countLeadsForAdmin(prisma) {
  const total = await prisma.leads.count();
  return { total, verified: total };
}

async function saveVerifiedLead(prisma, userKey, session) {
  const contact = normalizeContactForStorage(session?.contact);
  if (!contact) {
    return null;
  }

  const contactHash = hashContact(contact);
  const buildingRef = session.buildingRef || null;
  const unitRef = session.unitRef || null;
  const inquiryMessage = truncateInquiryMessage(session.pendingMessage);
  const verifiedAt = new Date();

  const existing = await prisma.leads.findFirst({
    where: {
      contact_hash: contactHash,
      building_ref: buildingRef,
    },
  });

  const data = {
    contact_hash: contactHash,
    contact_encrypted: encryptContact(contact),
    contact_last4: contactLast4(contact),
    inquiry_message: inquiryMessage,
    building_ref: buildingRef,
    unit_ref: unitRef,
    source: 'website',
    verified_at: verifiedAt,
  };

  if (existing) {
    return prisma.leads.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.leads.create({ data });
}

module.exports = {
  formatLeadForAdmin,
  resolvePropertyLabel,
  listLeadsForAdmin,
  countLeadsForAdmin,
  saveVerifiedLead,
};
