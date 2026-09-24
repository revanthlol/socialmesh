export type WorkspaceRole = "OWNER" | "MEMBER";

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  timezone?: string;
  role?: WorkspaceRole;
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: {
    memberCount: number;
    postCount: number;
    mediaCount: number;
  };
}

export interface WorkspaceMember {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export type MediaKind = "IMAGE" | "VIDEO";
export type MediaStatus = "PENDING_UPLOAD" | "READY" | "REJECTED" | "DELETED";

export interface MediaAsset {
  id: string;
  workspaceId: string;
  kind: MediaKind;
  status: MediaStatus;
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  updatedAt?: string;
  viewUrl: string | null;
}

export type PostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface WorkspaceChannel {
  id: string;
  workspaceId: string;
  postizIntegrationId: string;
  provider: string;
  name: string;
  pictureUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableChannel {
  id: string; // postizIntegrationId
  provider: string;
  name: string;
  pictureUrl?: string | null;
  isActive: boolean;
  isAssignedToCurrent: boolean;
  isAssignedToOther: boolean;
  assignedWorkspacesCount: number;
}

export interface PostTargetItem {
  id: string;
  channelId: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  channel?: {
    id: string;
    postizIntegrationId: string;
    provider: string;
    name: string;
    pictureUrl?: string | null;
  } | null;
}

export interface PostMediaItem {
  position: number;
  asset: MediaAsset | null;
}

export interface Post {
  id: string;
  workspaceId: string;
  content: string;
  status: PostStatus;
  scheduledFor: string | null;
  timezone: string;
  publishedAt: string | null;
  lastErrorCode?: string | null;
  lastError?: string | null;
  postizPostId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  media: PostMediaItem[];
  targets: PostTargetItem[];
}

export interface PublishingStatus {
  isConnected: boolean;
  latencyMs?: number;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}
