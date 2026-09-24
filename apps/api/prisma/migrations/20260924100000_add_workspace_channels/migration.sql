-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'CANCELLED';

-- DropForeignKey
ALTER TABLE "post_targets" DROP CONSTRAINT "post_targets_social_account_id_fkey";

-- AlterTable
ALTER TABLE "post_targets" ADD COLUMN     "channel_id" UUID,
ALTER COLUMN "social_account_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "postiz_post_id" TEXT;

-- CreateTable
CREATE TABLE "workspace_channels" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "postiz_integration_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picture_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_channels_workspace_id_idx" ON "workspace_channels"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_channels_workspace_id_postiz_integration_id_key" ON "workspace_channels"("workspace_id", "postiz_integration_id");

-- CreateIndex
CREATE INDEX "post_targets_channel_id_idx" ON "post_targets"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_targets_post_id_channel_id_key" ON "post_targets"("post_id", "channel_id");

-- CreateIndex
CREATE INDEX "posts_postiz_post_id_idx" ON "posts"("postiz_post_id");

-- AddForeignKey
ALTER TABLE "workspace_channels" ADD CONSTRAINT "workspace_channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_social_account_id_fkey" FOREIGN KEY ("social_account_id") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "workspace_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
