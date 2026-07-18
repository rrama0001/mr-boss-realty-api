const express = require('express');
const websiteSettingsController = require('../controllers/websiteSettingsController');

const router = express.Router();

router.get('/', websiteSettingsController.getPublicSettings);
router.put('/', websiteSettingsController.updateSettings);

module.exports = router;
