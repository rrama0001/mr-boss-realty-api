const express = require('express');
const router = express.Router();
const { prisma } = require('../prisma/prismaClient');

router.get('/', async (req, res) => {
  try {
    const unitTypes = await prisma.unit_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
    res.json(unitTypes);
  } catch (err) {
    console.error('Error fetching unit types:', err);
    res.status(500).json({ error: 'Failed to fetch unit types' });
  }
});

module.exports = router;
