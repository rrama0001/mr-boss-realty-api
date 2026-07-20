const express = require('express');
const checkAccess = require('../middlewares/checkAccess');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/stats', checkAccess, dashboardController.getStats);

module.exports = router;
