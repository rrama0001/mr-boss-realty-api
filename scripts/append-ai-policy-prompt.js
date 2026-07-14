/**
 * Appends data privacy policy to ai_settings.prompt if missing.
 * Run: node scripts/append-ai-policy-prompt.js
 */
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const {
  appendPolicyToPrompt,
  buildDefaultAiPrompt,
  hasPolicyInPrompt,
} = require('../services/aiPolicyPrompt');

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.ai_settings.findFirst();

  if (!existing) {
    await prisma.ai_settings.create({
      data: {
        id: 1,
        model: 'gpt-4o-mini',
        prompt: buildDefaultAiPrompt(),
        temperature: 0.3,
        max_tokens: 1000,
      },
    });
    console.log('Created ai_settings with default prompt and privacy policy.');
    return;
  }

  if (hasPolicyInPrompt(existing.prompt)) {
    console.log('ai_settings.prompt already includes the privacy policy.');
    return;
  }

  const updatedPrompt = appendPolicyToPrompt(existing.prompt);

  await prisma.ai_settings.update({
    where: { id: existing.id },
    data: {
      prompt: updatedPrompt,
      updated_at: new Date(),
    },
  });

  console.log('Appended privacy policy to ai_settings.prompt.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
