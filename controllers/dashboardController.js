const { prisma } = require('../prisma/prismaClient');
const { getDashboardStats } = require('../services/dashboardStats');

exports.getStats = async (req, res) => {
  try {
    const includeLeads = req.user?.role === 'admin';
    const stats = await getDashboardStats(prisma, { includeLeads });
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
};
