const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/buildingController');
const buildingPublicController = require('../controllers/buildingPublicController');

// Public whole-building detail for website (must be before /:id)
router.get('/public/:citySlug/:projectSlug/:buildingRef', buildingPublicController.getPublicDetailBySegments);
router.get('/public/:projectSlug/:buildingRef', buildingPublicController.getPublicDetail);

// 🔹 Get units for a building
// Example: GET /api/buildings/1/units
router.get('/:id/units', buildingController.getUnits);

// 🔹 Get a building by ID
// Example: GET /api/buildings/1
router.get('/:id', buildingController.getOne);

// 🔹 Update a building by ID
// Example: PUT /api/buildings/1
router.put('/:id', buildingController.update);

// Restore before delete pattern for clarity
router.post('/:id/restore', buildingController.restore);
router.delete('/:id', buildingController.remove);

module.exports = router;
