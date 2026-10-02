-- AlterTable
ALTER TABLE "pending_channel_connections" ADD COLUMN "postiz_state" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pending_channel_connections_postiz_state_key" ON "pending_channel_connections"("postiz_state");
CREATE INDEX "pending_channel_connections_postiz_state_idx" ON "pending_channel_connections"("postiz_state");
