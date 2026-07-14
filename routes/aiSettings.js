// routes/aiSettings.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const {
  appendPolicyToPrompt,
  buildDefaultAiPrompt,
  ensurePolicyInPrompt,
} = require("../services/aiPolicyPrompt");

const prisma = new PrismaClient();

// ✅ Get AI settings
router.get("/", async (req, res) => {
  try {
    const settings = await prisma.ai_settings.findFirst();

    if (!settings) {
      return res.json({});
    }

    res.json({
      ...settings,
      prompt: ensurePolicyInPrompt(settings.prompt),
    });
  } catch (error) {
    console.error("❌ Error fetching AI settings:", error);
    res.status(500).json({ error: "Failed to fetch AI settings." });
  }
});

// ✅ Create or update AI settings
router.post("/", async (req, res) => {
  try {
    const { model, prompt, temperature, max_tokens } = req.body;
    const promptWithPolicy = appendPolicyToPrompt(prompt || buildDefaultAiPrompt());

    const settings = await prisma.ai_settings.upsert({
      where: { id: 1 },
      update: {
        model,
        prompt: promptWithPolicy,
        temperature,
        max_tokens,
        updated_at: new Date(), // ✅ correct timestamp field
      },
      create: {
        model,
        prompt: promptWithPolicy,
        temperature,
        max_tokens,
        created_at: new Date(), // ✅ correct timestamp field
        updated_at: new Date(), // ✅ correct timestamp field
      },
    });

    res.json(settings);
  } catch (error) {
    console.error("❌ Error saving AI settings:", error);
    res.status(500).json({
      error: "Failed to save AI settings.",
      details: error.message,
    });
  }
});

module.exports = router;
