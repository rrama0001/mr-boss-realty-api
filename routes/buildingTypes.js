const express = require('express');
const router = express.Router();
const { prisma } = require('../prisma/prismaClient');

router.get('/', async (req, res) => {
  try {
    const buildingTypes = await prisma.building_types.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    res.json(buildingTypes);
  } catch (err) {
    console.error('Error fetching building types:', err);
    res.status(500).json({ error: 'Failed to fetch building types' });
  }
});

module.exports = router;
