const express = require('express');
const companyProfileController = require('../controllers/companyProfileController');

const router = express.Router();

router.get('/', companyProfileController.getPublicProfile);
router.put('/', companyProfileController.updateProfile);
router.post('/', companyProfileController.updateProfile);

module.exports = router;
