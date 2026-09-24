-- AlterEnum: add PROCESSING and PARTIAL to PostStatus, and PROCESSING to TargetStatus
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "TargetStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- DropIndex
DROP INDEX IF EXISTS "posts_postiz_post_id_idx";

-- AlterTable: remove redundant postiz_post_id from posts
ALTER TABLE "posts" DROP COLUMN IF EXISTS "postiz_post_id";

-- DropIndex
DROP INDEX IF EXISTS "post_targets_qstash_message_id_idx";

-- AlterTable: excise legacy qstash fields and add postiz_post_id to post_targets
ALTER TABLE "post_targets" DROP COLUMN IF EXISTS "qstash_message_id";
ALTER TABLE "post_targets" DROP COLUMN IF EXISTS "dispatch_generation";
ALTER TABLE "post_targets" ADD COLUMN "postiz_post_id" TEXT;

-- CreateIndex
CREATE INDEX "post_targets_postiz_post_id_idx" ON "post_targets"("postiz_post_id");

-- CreateTable
CREATE TABLE "pending_channel_connections" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "state_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_channel_connections_state_token_key" ON "pending_channel_connections"("state_token");
CREATE INDEX "pending_channel_connections_state_token_idx" ON "pending_channel_connections"("state_token");
CREATE INDEX "pending_channel_connections_expires_at_idx" ON "pending_channel_connections"("expires_at");
CREATE INDEX "pending_channel_connections_workspace_id_user_id_idx" ON "pending_channel_connections"("workspace_id", "user_id");

-- AddForeignKey
ALTER TABLE "pending_channel_connections" ADD CONSTRAINT "pending_channel_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pending_channel_connections" ADD CONSTRAINT "pending_channel_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
