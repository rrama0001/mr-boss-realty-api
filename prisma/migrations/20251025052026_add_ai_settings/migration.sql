-- CreateTable
CREATE TABLE "ai_settings" (
    "id" SERIAL NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "prompt" TEXT NOT NULL DEFAULT 'You are Mr. Boss Realty’s real estate assistant. Always answer concisely, politely, and based on available project data.',
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "max_tokens" INTEGER DEFAULT 500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
