const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

router.get('/stats', leadController.getStats);
router.get('/', leadController.getAll);

module.exports = router;
