const express = require('express');
const { BUILDING_STATUSES } = require('../services/buildingStatuses');

const router = express.Router();

router.get('/', (req, res) => {
    res.json(BUILDING_STATUSES);
});

module.exports = router;
