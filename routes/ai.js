const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const aiVerificationController = require("../controllers/aiVerificationController");

router.post("/reply", aiController.getReply);
router.post("/verification/consent", aiVerificationController.postConsent);
router.post("/verification/contact", aiVerificationController.postContact);
router.post("/verification/verify-otp", aiVerificationController.postVerifyOtp);
router.post("/verification/cancel", aiVerificationController.postCancel);

module.exports = router;
