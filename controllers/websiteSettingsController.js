const { prisma } = require('../prisma/prismaClient');
const {
  getOrCreateWebsiteSettings,
  sanitizeWebsiteSettingsInput,
  toPublicWebsiteSettings,
} = require('../services/websiteSettings');

exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await getOrCreateWebsiteSettings(prisma);
    res.json(toPublicWebsiteSettings(settings));
  } catch (error) {
    console.error('Error fetching website settings:', error);
    res.status(500).json({ error: 'Failed to fetch website settings.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = sanitizeWebsiteSettingsInput(req.body);
    const settings = await prisma.website_settings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        ...data,
      },
    });

    res.json(toPublicWebsiteSettings(settings));
  } catch (error) {
    console.error('Error saving website settings:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Failed to save website settings.',
    });
  }
};
