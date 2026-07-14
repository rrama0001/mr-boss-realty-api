const { prisma } = require('../prisma/prismaClient');
const { listLeadsForAdmin, countLeadsForAdmin } = require('../services/leadService');

exports.getStats = async (req, res) => {
  try {
    const stats = await countLeadsForAdmin(prisma);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats.' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const leads = await listLeadsForAdmin(prisma);
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads.' });
  }
};
