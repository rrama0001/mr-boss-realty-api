-- Persistent AI chat sessions + messages for preference memory and lead context.

CREATE TABLE "ai_chat_sessions" (
    "id" SERIAL NOT NULL,
    "session_key" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'website',
    "preferences_json" TEXT,
    "unit_ref" TEXT,
    "building_ref" TEXT,
    "project_slug" TEXT,
    "summary" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_chat_sessions_session_key_key" ON "ai_chat_sessions"("session_key");
CREATE INDEX "ai_chat_sessions_last_message_at_idx" ON "ai_chat_sessions"("last_message_at");
CREATE INDEX "ai_chat_sessions_source_idx" ON "ai_chat_sessions"("source");

CREATE TABLE "ai_chat_messages" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_chat_messages_session_id_created_at_idx" ON "ai_chat_messages"("session_id", "created_at");

ALTER TABLE "ai_chat_messages"
ADD CONSTRAINT "ai_chat_messages_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
