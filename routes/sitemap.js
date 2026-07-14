const express = require('express');
const sitemapController = require('../controllers/sitemapController');

const router = express.Router();

router.get('/robots.txt', sitemapController.getRobotsTxt);
router.get('/sitemap.xml', sitemapController.getSitemapIndex);
router.get('/sitemap-:type.xml', sitemapController.getSitemapByType);

module.exports = router;
