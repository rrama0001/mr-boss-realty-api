const { prisma } = require('../prisma/prismaClient');
const {
  getOrCreateCompanyProfile,
  sanitizeCompanyProfileInput,
  toPublicCompanyProfile,
} = require('../services/companyProfile');

exports.getPublicProfile = async (req, res) => {
  try {
    const profile = await getOrCreateCompanyProfile(prisma);
    res.json(toPublicCompanyProfile(profile));
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ error: 'Failed to fetch company profile.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const data = sanitizeCompanyProfileInput(req.body);

    const profile = await prisma.company_profile.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        ...data,
      },
    });

    res.json(toPublicCompanyProfile(profile));
  } catch (error) {
    console.error('Error saving company profile:', error);
    res.status(500).json({
      error: 'Failed to save company profile.',
      details: error.message,
    });
  }
};
