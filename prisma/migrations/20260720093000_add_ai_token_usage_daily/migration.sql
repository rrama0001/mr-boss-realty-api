-- CreateTable
CREATE TABLE "ai_token_usage_daily" (
    "id" SERIAL NOT NULL,
    "usage_date" DATE NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_token_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_token_usage_daily_usage_date_key" ON "ai_token_usage_daily"("usage_date");

-- CreateIndex
CREATE INDEX "ai_token_usage_daily_usage_date_idx" ON "ai_token_usage_daily"("usage_date");
