// api/routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const buildingController = require('../controllers/buildingController');
const uploadProjectLogo = require('../middlewares/uploadProjectLogo');
const uploadProjectGallery = require('../middlewares/uploadProjectGallery');

// ----------------------------
// Project routes (base: /api/projects)
// ----------------------------

// Project CRUD
router.get('/public/list', projectController.getPublicListing);
router.get('/public/featured', projectController.getPublicFeatured);
router.get('/public/partners', projectController.getPublicPartners);
router.get('/public/:citySlug/:projectSlug/:listingRef', projectController.getPublicListingDetailBySegments);
router.get('/public/:citySlug/:projectSlug', projectController.getPublicDetailBySegments);
router.get('/public/:slug', projectController.getPublicDetail);
router.get('/', projectController.getAll);
router.get('/list', projectController.getAll); // optional alias
router.get('/:id', projectController.getOne);
router.post('/:id/logo', (req, res, next) => {
    uploadProjectLogo.single('logo')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Invalid upload.' });
        }
        return next();
    });
}, projectController.uploadLogo);
router.delete('/:id/logo', projectController.deleteLogo);
router.get('/:id/gallery', projectController.getGallery);
router.post('/:id/gallery', (req, res, next) => {
    uploadProjectGallery.array('images', 20)(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Invalid upload.' });
        }
        return next();
    });
}, projectController.uploadGallery);
router.patch('/:id/gallery/:assetId', projectController.updateGalleryImage);
router.delete('/:id/gallery/:assetId', projectController.deleteGalleryImage);
router.patch('/:id/cover', projectController.setCoverImage);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.post('/:id/restore', projectController.restore);
router.delete('/:id', projectController.remove);
router.get('/:id/units', projectController.getUnitsByProject);
// ----------------------------
// Nested building routes (mounted under /api/projects)
// Examples:
//   GET  /api/projects/:projectId/buildings
//   POST /api/projects/:projectId/buildings
// ----------------------------
router.get('/:projectId/buildings', buildingController.getByProject);
router.post('/:projectId/buildings', buildingController.create);


// Export
module.exports = router;
